import { getDb } from "../db/data-source";
import { User } from "../entities/User";

export function applyDiscount(price: number, discountPercent: number): number {
  if (!discountPercent || discountPercent <= 0) return price;
  return Math.round(price * (1 - discountPercent / 100) * 100) / 100;
}

export async function getUserDiscount(userId: string): Promise<number> {
  const db = await getDb();
  const user = await db.getRepository(User).findOne({
    where: { id: userId },
    relations: ["company"],
  });
  if (!user?.company) return 0;
  return Number((user.company as any).discount) || 0;
}
