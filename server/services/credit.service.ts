import { getDb } from "../db/data-source";
import { CreditTransaction, CreditType } from "../entities/CreditTransaction";
import { Company } from "../entities/Company";
import { User } from "../entities/User";
import { Order } from "../entities/Order";
import { DoaClaim } from "../entities/DoaClaim";

/** Get the companyId for a user, or null if not linked */
export async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const db = await getDb();
  const user = await db.getRepository(User).findOneBy({ id: userId });
  return user?.companyId || null;
}

export async function getCreditBalance(companyId: string): Promise<number> {
  const db = await getDb();
  const company = await db.getRepository(Company).findOneBy({ id: companyId });
  return Number(company?.creditBalance) || 0;
}

export async function getCreditBalanceForUser(userId: string): Promise<number> {
  const companyId = await getCompanyIdForUser(userId);
  if (!companyId) return 0;
  return getCreditBalance(companyId);
}

export async function getCreditHistory(companyId: string): Promise<CreditTransaction[]> {
  const db = await getDb();
  return db.getRepository(CreditTransaction).find({
    where: { companyId },
    order: { createdAt: "DESC" },
  });
}

export async function addManualCredit(companyId: string, amount: number, description: string) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const txRepo = db.getRepository(CreditTransaction);

  const company = await companyRepo.findOneByOrFail({ id: companyId });

  const tx = txRepo.create({
    companyId,
    userId: null,
    type: CreditType.MANUAL_ADJUSTMENT,
    amount,
    description: description || "Manual adjustment",
  });
  await txRepo.save(tx);

  company.creditBalance = Number(company.creditBalance) + amount;
  await companyRepo.save(company);

  return { transaction: tx, newBalance: Number(company.creditBalance) };
}

export async function addDoaCredit(companyId: string, amount: number, description: string, doaClaimId: string) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const txRepo = db.getRepository(CreditTransaction);

  const company = await companyRepo.findOneByOrFail({ id: companyId });

  const tx = txRepo.create({
    companyId,
    userId: null,
    type: CreditType.DOA_CREDIT,
    amount,
    description,
    doaClaimId,
  });
  await txRepo.save(tx);

  company.creditBalance = Number(company.creditBalance) + amount;
  await companyRepo.save(company);

  return { transaction: tx, newBalance: Number(company.creditBalance) };
}

/**
 * Idempotent, delta-aware credit sync for a DOA claim.
 * Reconciles the net of all existing DOA_CREDIT transactions for this claim
 * against `desiredAmount` by posting only the delta. Safe to call repeatedly
 * as approve/deny state changes.
 */
export async function syncDoaCredit(
  companyId: string,
  doaClaimId: string,
  desiredAmount: number,
  description: string
) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const txRepo = db.getRepository(CreditTransaction);

  const existing = await txRepo.find({
    where: { doaClaimId, type: CreditType.DOA_CREDIT },
  });
  const existingNet = existing.reduce((sum, t) => sum + Number(t.amount), 0);
  const delta = Number((desiredAmount - existingNet).toFixed(2));
  if (delta === 0) return { delta: 0, newBalance: await getCreditBalance(companyId) };

  const company = await companyRepo.findOneByOrFail({ id: companyId });

  const tx = txRepo.create({
    companyId,
    userId: null,
    type: CreditType.DOA_CREDIT,
    amount: delta,
    description,
    doaClaimId,
  });
  await txRepo.save(tx);

  company.creditBalance = Number(company.creditBalance) + delta;
  await companyRepo.save(company);

  return { delta, newBalance: Number(company.creditBalance) };
}

/**
 * Sum of DOA credit a company has earned from a specific order's own claims.
 * This amount cannot be applied back to that same order.
 */
export async function getCreditEarnedFromOrder(companyId: string, orderId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getRepository(CreditTransaction)
    .createQueryBuilder("ct")
    .leftJoin(DoaClaim, "dc", "dc.id = ct.doaClaimId")
    .where("ct.companyId = :companyId", { companyId })
    .andWhere("ct.type = :type", { type: CreditType.DOA_CREDIT })
    .andWhere("dc.orderId = :orderId", { orderId })
    .select("COALESCE(SUM(ct.amount), 0)", "total")
    .getRawOne<{ total: string }>();
  return Number(row?.total) || 0;
}

/**
 * Sum of positive manual credit grants that were posted AFTER the order was
 * created. Manual credit only applies to orders placed from that point on.
 */
export async function getManualCreditAfter(companyId: string, orderCreatedAt: Date): Promise<number> {
  const db = await getDb();
  const row = await db.getRepository(CreditTransaction)
    .createQueryBuilder("ct")
    .where("ct.companyId = :companyId", { companyId })
    .andWhere("ct.type = :type", { type: CreditType.MANUAL_ADJUSTMENT })
    .andWhere("ct.amount > 0")
    .andWhere("ct.createdAt > :createdAt", { createdAt: orderCreatedAt })
    .select("COALESCE(SUM(ct.amount), 0)", "total")
    .getRawOne<{ total: string }>();
  return Number(row?.total) || 0;
}

export async function getCreditApplicableToOrder(companyId: string, orderId: string): Promise<number> {
  const db = await getDb();
  const order = await db.getRepository(Order).findOneBy({ id: orderId });
  if (!order) return 0;

  const balance = await getCreditBalance(companyId);
  const doaFromThisOrder = await getCreditEarnedFromOrder(companyId, orderId);
  const manualAfterOrder = await getManualCreditAfter(companyId, order.createdAt);
  return Math.max(0, balance - doaFromThisOrder - manualAfterOrder);
}

export async function applyCredit(orderId: string, companyId: string, amount: number) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const orderRepo = db.getRepository(Order);
  const txRepo = db.getRepository(CreditTransaction);

  const company = await companyRepo.findOneByOrFail({ id: companyId });
  const order = await orderRepo.findOneByOrFail({ id: orderId });

  const balance = Number(company.creditBalance) || 0;
  const excluded = await getCreditEarnedFromOrder(companyId, orderId);
  const applicable = Math.max(0, balance - excluded);
  const toApply = Math.min(amount, applicable);
  if (toApply <= 0) return { creditApplied: 0, newBalance: balance };

  const tx = txRepo.create({
    companyId,
    userId: order.userId,
    type: CreditType.CREDIT_APPLIED,
    amount: -toApply,
    description: `Credit applied to order #${orderId.slice(0, 8).toUpperCase()}`,
    orderId,
  });
  await txRepo.save(tx);

  company.creditBalance = balance - toApply;
  await companyRepo.save(company);

  order.creditApplied = toApply;
  order.useCredit = true;
  await orderRepo.save(order);

  return { creditApplied: toApply, newBalance: Number(company.creditBalance) };
}

export async function refundCredit(orderId: string, companyId: string) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const orderRepo = db.getRepository(Order);
  const txRepo = db.getRepository(CreditTransaction);

  const order = await orderRepo.findOneByOrFail({ id: orderId });
  const creditApplied = Number(order.creditApplied) || 0;
  if (creditApplied <= 0) return;

  const company = await companyRepo.findOneByOrFail({ id: companyId });

  const tx = txRepo.create({
    companyId,
    userId: order.userId,
    type: CreditType.CREDIT_REFUND,
    amount: creditApplied,
    description: `Credit refunded from order #${orderId.slice(0, 8).toUpperCase()}`,
    orderId,
  });
  await txRepo.save(tx);

  company.creditBalance = Number(company.creditBalance) + creditApplied;
  await companyRepo.save(company);

  order.creditApplied = 0;
  order.useCredit = false;
  await orderRepo.save(order);
}

export async function removeAppliedCredit(orderId: string, companyId: string) {
  return refundCredit(orderId, companyId);
}
