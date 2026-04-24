import "reflect-metadata";
import { getDb } from "../server/db/data-source";
import { DoaClaim } from "../server/entities/DoaClaim";
import { Shipment } from "../server/entities/Shipment";
import { syncDoaCreditForClaim } from "../server/services/doa.service";
import { getCreditBalance, getCompanyIdForUser } from "../server/services/credit.service";

async function main() {
  const shipmentName = process.argv[2];
  if (!shipmentName) throw new Error("Usage: tsx scripts/backfill-doa-credit.ts <shipment name>");

  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOneByOrFail({ name: shipmentName });
  console.log(`Shipment: ${shipment.name} (${shipment.id})`);

  const claims = await db.getRepository(DoaClaim).find({
    where: { order: { shipmentId: shipment.id } },
    relations: ["order"],
  });
  console.log(`Found ${claims.length} DOA claims`);

  for (const claim of claims) {
    const before = claim.order?.userId
      ? await (async () => {
          const cid = await getCompanyIdForUser(claim.order.userId!);
          return cid ? await getCreditBalance(cid) : null;
        })()
      : null;

    await syncDoaCreditForClaim(claim.id);

    const after = claim.order?.userId
      ? await (async () => {
          const cid = await getCompanyIdForUser(claim.order.userId!);
          return cid ? await getCreditBalance(cid) : null;
        })()
      : null;

    console.log(`claim ${claim.id} (order ${claim.orderId}): balance ${before} → ${after}`);
  }

  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
