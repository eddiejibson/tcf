import { getDb } from "../server/db/data-source";
import { Order } from "../server/entities/Order";
import { DoaClaim } from "../server/entities/DoaClaim";
import { OrderPayment } from "../server/entities/OrderPayment";
import { OrderItem } from "../server/entities/OrderItem";

const ORDER_ID = "b26d65fb-0c8a-4a90-a2d8-cbc72cc9d749";

async function main() {
  const db = await getDb();

  const order = await db.getRepository(Order).findOne({ where: { id: ORDER_ID }, withDeleted: true });
  if (!order) throw new Error("Order not found at all");
  console.log(`Order ${ORDER_ID}`);
  console.log(`  status:    ${order.status}`);
  console.log(`  deletedAt: ${order.deletedAt?.toISOString() ?? "null (already active)"}`);

  // Inventory what's associated (with deleted) BEFORE restoring
  const claims = await db.getRepository(DoaClaim).find({ where: { orderId: ORDER_ID }, withDeleted: true });
  const payments = await db.getRepository(OrderPayment).find({ where: { orderId: ORDER_ID }, withDeleted: true });
  const items = await db.getRepository(OrderItem).find({ where: { orderId: ORDER_ID } }); // items have no soft-delete

  console.log(`\nAssociated records:`);
  console.log(`  order items:   ${items.length} (never deleted — preserved)`);
  console.log(`  DOA claims:    ${claims.length} total, ${claims.filter((c) => c.deletedAt).length} currently soft-deleted`);
  for (const c of claims) console.log(`     - claim ${c.id}  status=${c.status}  deletedAt=${c.deletedAt?.toISOString() ?? "active"}`);
  console.log(`  payments:      ${payments.length} total, ${payments.filter((p) => p.deletedAt).length} currently soft-deleted`);
  for (const p of payments) console.log(`     - payment ${p.id}  ${p.method} £${p.amount} status=${p.status}  deletedAt=${p.deletedAt?.toISOString() ?? "active"}`);

  if (!order.deletedAt && claims.every((c) => !c.deletedAt) && payments.every((p) => !p.deletedAt)) {
    console.log("\nNothing is soft-deleted — already fully restored. No action taken.");
    await db.destroy();
    return;
  }

  console.log(`\nRestoring order + all its claims + all its payments...`);
  await db.transaction(async (manager) => {
    await manager.getRepository(Order).restore(ORDER_ID);
    await manager.getRepository(DoaClaim).restore({ orderId: ORDER_ID });
    await manager.getRepository(OrderPayment).restore({ orderId: ORDER_ID });
  });

  // Verify with DEFAULT queries (which exclude soft-deleted rows)
  const orderAfter = await db.getRepository(Order).findOne({ where: { id: ORDER_ID } });
  const claimsAfter = await db.getRepository(DoaClaim).count({ where: { orderId: ORDER_ID } });
  const paymentsAfter = await db.getRepository(OrderPayment).count({ where: { orderId: ORDER_ID } });

  console.log(`\n=== RESULT (via default queries, soft-deleted excluded) ===`);
  console.log(`  order visible:  ${orderAfter ? "YES ✓" : "NO ✗"}  (status=${orderAfter?.status})`);
  console.log(`  claims visible: ${claimsAfter}/${claims.length}`);
  console.log(`  payments visible: ${paymentsAfter}/${payments.length}`);
  console.log(`  order items:    ${items.length} (intact)`);

  await db.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
