import "reflect-metadata";
import "dotenv/config";
import { getDb } from "../server/db/data-source";
import { Product } from "../server/entities/Product";

async function main() {
  const db = await getDb();
  const repo = db.getRepository(Product);
  const id = "3bbde5cc-d2d7-45d2-8562-300170320b0a";
  const total = await repo.count({ where: { shipmentId: id } });
  const withSize = await repo.createQueryBuilder("p").where("p.shipmentId = :id AND p.size IS NOT NULL", { id }).getCount();
  const withVariant = await repo.createQueryBuilder("p").where("p.shipmentId = :id AND p.variant IS NOT NULL", { id }).getCount();
  const sample = await repo.createQueryBuilder("p").where("p.shipmentId = :id AND (p.size IS NOT NULL OR p.variant IS NOT NULL)", { id }).limit(5).getMany();
  console.log({ total, withSize, withVariant });
  for (const p of sample) console.log(`  ${p.name} | size=${p.size} variant=${p.variant}`);
  await db.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
