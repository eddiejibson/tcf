import { getDb } from "../db/data-source";
import { CreditTransaction, CreditType } from "../entities/CreditTransaction";
import { User } from "../entities/User";
import { Order } from "../entities/Order";

export async function getCreditBalance(userId: string): Promise<number> {
  const db = await getDb();
  const user = await db.getRepository(User).findOneByOrFail({ id: userId });
  return Number(user.creditBalance) || 0;
}

export async function getCreditHistory(userId: string): Promise<CreditTransaction[]> {
  const db = await getDb();
  return db.getRepository(CreditTransaction).find({
    where: { userId },
    order: { createdAt: "DESC" },
  });
}

export async function addManualCredit(userId: string, amount: number, description: string) {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const txRepo = db.getRepository(CreditTransaction);

  const user = await userRepo.findOneByOrFail({ id: userId });

  const tx = txRepo.create({
    userId,
    type: CreditType.MANUAL_ADJUSTMENT,
    amount,
    description: description || "Manual adjustment",
  });
  await txRepo.save(tx);

  user.creditBalance = Number(user.creditBalance) + amount;
  await userRepo.save(user);

  return { transaction: tx, newBalance: user.creditBalance };
}

export async function addDoaCredit(userId: string, amount: number, description: string, doaClaimId: string) {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const txRepo = db.getRepository(CreditTransaction);

  const user = await userRepo.findOneByOrFail({ id: userId });

  const tx = txRepo.create({
    userId,
    type: CreditType.DOA_CREDIT,
    amount,
    description,
    doaClaimId,
  });
  await txRepo.save(tx);

  user.creditBalance = Number(user.creditBalance) + amount;
  await userRepo.save(user);

  return { transaction: tx, newBalance: user.creditBalance };
}

export async function applyCredit(orderId: string, userId: string, amount: number) {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const orderRepo = db.getRepository(Order);
  const txRepo = db.getRepository(CreditTransaction);

  const user = await userRepo.findOneByOrFail({ id: userId });
  const order = await orderRepo.findOneByOrFail({ id: orderId });

  const balance = Number(user.creditBalance) || 0;
  const toApply = Math.min(amount, balance);
  if (toApply <= 0) return { creditApplied: 0, newBalance: balance };

  const tx = txRepo.create({
    userId,
    type: CreditType.CREDIT_APPLIED,
    amount: -toApply,
    description: `Credit applied to order #${orderId.slice(0, 8).toUpperCase()}`,
    orderId,
  });
  await txRepo.save(tx);

  user.creditBalance = balance - toApply;
  await userRepo.save(user);

  order.creditApplied = toApply;
  order.useCredit = true;
  await orderRepo.save(order);

  return { creditApplied: toApply, newBalance: user.creditBalance };
}

export async function refundCredit(orderId: string, userId: string) {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const orderRepo = db.getRepository(Order);
  const txRepo = db.getRepository(CreditTransaction);

  const order = await orderRepo.findOneByOrFail({ id: orderId });
  const creditApplied = Number(order.creditApplied) || 0;
  if (creditApplied <= 0) return;

  const user = await userRepo.findOneByOrFail({ id: userId });

  const tx = txRepo.create({
    userId,
    type: CreditType.CREDIT_REFUND,
    amount: creditApplied,
    description: `Credit refunded from order #${orderId.slice(0, 8).toUpperCase()}`,
    orderId,
  });
  await txRepo.save(tx);

  user.creditBalance = Number(user.creditBalance) + creditApplied;
  await userRepo.save(user);

  order.creditApplied = 0;
  order.useCredit = false;
  await orderRepo.save(order);
}

export async function removeAppliedCredit(orderId: string, userId: string) {
  return refundCredit(orderId, userId);
}
