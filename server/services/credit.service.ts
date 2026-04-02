import { getDb } from "../db/data-source";
import { CreditTransaction, CreditType } from "../entities/CreditTransaction";
import { Company } from "../entities/Company";
import { User } from "../entities/User";
import { Order } from "../entities/Order";

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

export async function applyCredit(orderId: string, companyId: string, amount: number) {
  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const orderRepo = db.getRepository(Order);
  const txRepo = db.getRepository(CreditTransaction);

  const company = await companyRepo.findOneByOrFail({ id: companyId });
  const order = await orderRepo.findOneByOrFail({ id: orderId });

  const balance = Number(company.creditBalance) || 0;
  const toApply = Math.min(amount, balance);
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
