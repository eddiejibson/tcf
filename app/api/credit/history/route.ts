import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User } from "@/server/entities/User";
import { CreditTransaction, CreditType } from "@/server/entities/CreditTransaction";
import { DoaClaim } from "@/server/entities/DoaClaim";
import { Order } from "@/server/entities/Order";
import { getCreditBalance } from "@/server/services/credit.service";
import { In } from "typeorm";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const user = await db.getRepository(User).findOneBy({ id: auth.userId });
  if (!user?.companyId) return NextResponse.json({ balance: 0, transactions: [] });

  const txs = await db.getRepository(CreditTransaction).find({
    where: { companyId: user.companyId },
    order: { createdAt: "DESC" },
  });

  // Resolve referenced orders so the UI can render "for order #ABCD1234".
  // Two sources: ct.orderId (CREDIT_APPLIED / CREDIT_REFUND) and ct.doaClaim.orderId (DOA_CREDIT).
  const orderIds = new Set<string>();
  const claimIds = new Set<string>();
  for (const tx of txs) {
    if (tx.orderId) orderIds.add(tx.orderId);
    if (tx.doaClaimId) claimIds.add(tx.doaClaimId);
  }
  const orders = orderIds.size
    ? await db.getRepository(Order).find({ where: { id: In(Array.from(orderIds)) } })
    : [];
  const claims = claimIds.size
    ? await db.getRepository(DoaClaim).find({ where: { id: In(Array.from(claimIds)) } })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const claimById = new Map(claims.map((c) => [c.id, c]));
  // Pull the source orders for each DOA claim so we can show the credit's origin order.
  const claimOrderIds = Array.from(new Set(claims.map((c) => c.orderId).filter((id): id is string => !!id)));
  const claimOrders = claimOrderIds.length
    ? await db.getRepository(Order).find({ where: { id: In(claimOrderIds) } })
    : [];
  const claimOrderById = new Map(claimOrders.map((o) => [o.id, o]));

  const transactions = txs.map((tx) => {
    const order = tx.orderId ? orderById.get(tx.orderId) : null;
    const claim = tx.doaClaimId ? claimById.get(tx.doaClaimId) : null;
    const sourceOrder = claim?.orderId ? claimOrderById.get(claim.orderId) : null;
    const refOrder = order || sourceOrder || null;
    return {
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      createdAt: tx.createdAt,
      orderId: refOrder?.id || null,
      orderRef: refOrder ? refOrder.id.slice(0, 8).toUpperCase() : null,
      // Credit grants (DOA / positive manual) become usable on orders submitted/created
      // strictly after createdAt. DOA credits are also blocked from their source order
      // — captured by sourceOrderId so the UI can spell that out.
      availableFrom:
        tx.type === CreditType.DOA_CREDIT || (tx.type === CreditType.MANUAL_ADJUSTMENT && Number(tx.amount) > 0)
          ? tx.createdAt
          : null,
      sourceOrderId: tx.type === CreditType.DOA_CREDIT && sourceOrder ? sourceOrder.id : null,
      sourceOrderRef: tx.type === CreditType.DOA_CREDIT && sourceOrder ? sourceOrder.id.slice(0, 8).toUpperCase() : null,
    };
  });

  const balance = await getCreditBalance(user.companyId);
  return NextResponse.json({ balance, transactions });
}
