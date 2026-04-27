import "reflect-metadata";
import "dotenv/config";
import { getDb } from "../server/db/data-source";
import { Shipment } from "../server/entities/Shipment";
import { Product } from "../server/entities/Product";

async function main() {
  const db = await getDb();
  const shipments = await db.getRepository(Shipment).find({
    where: [],
    order: { createdAt: "DESC" },
    take: 20,
  });
  console.log("Recent shipments:");
  for (const s of shipments) {
    console.log(`  ${s.id} | ${s.name} | margin=${s.margin} | src=${s.sourceFilename} | ${s.shipmentDate}`);
  }

  // Find Taiwan ones
  const taiwan = shipments.filter(
    (s) => /taiwan|ezmarine/i.test(s.name) || /taiwan|ezmarine/i.test(s.sourceFilename || ""),
  );
  console.log("\nTaiwan/Ezmarine matches:", taiwan.length);
  for (const s of taiwan) {
    const products = await db.getRepository(Product).find({ where: { shipmentId: s.id } });
    const withSize = products.filter((p) => p.size);
    const withVariant = products.filter((p) => p.variant);
    console.log(
      `  ${s.id} | ${s.name} | products=${products.length} size=${withSize.length} variant=${withVariant.length}`,
    );
    console.log("  sample products:");
    for (const p of products.slice(0, 8)) {
      console.log(`    "${p.name}" price=${p.price} size=${p.size} variant=${p.variant}`);
      console.log(`      originalRow=${JSON.stringify(p.originalRow)}`);
    }
  }
  await db.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
