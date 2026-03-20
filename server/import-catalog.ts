import "dotenv/config";
import "reflect-metadata";
import { DataSource, ILike, IsNull } from "typeorm";
import { baseDbConfig } from "./db/config";
import { Category } from "./entities/Category";
import { CatalogProduct } from "./entities/CatalogProduct";
import fs from "fs";
import path from "path";

interface ImportItem {
  name: string;
  price: number;
  type: "COLONY" | "FRAG";
  parentCategory: string;
  category: string;
  stockMode: "EXACT" | "ROUGH";
  imageKey: string | null;
  stockQty: number | null;
  stockLevel: string | null;
  latinName: string | null;
  active: boolean;
  wysiwyg: boolean;
}

async function main() {
  const ds = new DataSource({ ...baseDbConfig, logging: false });
  await ds.initialize();
  console.log("Connected to database");

  const catRepo = ds.getRepository(Category);
  const prodRepo = ds.getRepository(CatalogProduct);

  // Clear existing products (null out FK refs from order_items first)
  await ds.query(`UPDATE "order_items" SET "catalogProductId" = NULL WHERE "catalogProductId" IS NOT NULL`);
  const deleted = await prodRepo.createQueryBuilder().delete().from(CatalogProduct).execute();
  console.log(`Cleared ${deleted.affected} existing catalog products`);

  // Ensure all stock_level_enum values exist
  for (const val of ["LOW", "AVERAGE", "HIGH", "OUT_OF_STOCK", "PRE_ORDER"]) {
    try {
      await ds.query(`ALTER TYPE "public"."stock_level_enum" ADD VALUE IF NOT EXISTS '${val}'`);
    } catch {
      // already exists
    }
  }
  console.log("Ensured stock_level_enum values are up to date");

  const items: ImportItem[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "import.json"), "utf-8")
  );
  console.log(`Loaded ${items.length} items from import.json`);

  // Cache for resolved category IDs: "parent::child" -> uuid
  const categoryCache = new Map<string, string>();
  let createdParents = 0;
  let createdChildren = 0;
  let createdProducts = 0;

  for (const item of items) {
    const cacheKey = `${item.parentCategory}::${item.category}`;

    if (!categoryCache.has(cacheKey)) {
      // 1. Find or create parent category
      let parent = await catRepo.findOne({
        where: { name: ILike(item.parentCategory), parentId: IsNull() },
      });
      // Also try with explicit null
      if (!parent) {
        parent = await catRepo
          .createQueryBuilder("c")
          .where("LOWER(c.name) = LOWER(:name)", { name: item.parentCategory })
          .andWhere("c.parentId IS NULL")
          .getOne();
      }
      if (!parent) {
        parent = catRepo.create({ name: item.parentCategory, parentId: null, sortOrder: 0 });
        parent = await catRepo.save(parent);
        console.log(`  Created parent category: ${parent.name} (${parent.id})`);
        createdParents++;
      }

      // 2. Find or create child category under this parent
      let child = await catRepo
        .createQueryBuilder("c")
        .where("LOWER(c.name) = LOWER(:name)", { name: item.category })
        .andWhere("c.parentId = :parentId", { parentId: parent.id })
        .getOne();

      if (!child) {
        child = catRepo.create({ name: item.category, parentId: parent.id, sortOrder: 0 });
        child = await catRepo.save(child);
        console.log(`  Created child category: ${child.name} under ${parent.name} (${child.id})`);
        createdChildren++;
      }

      categoryCache.set(cacheKey, child.id);
    }

    const categoryId = categoryCache.get(cacheKey)!;

    const product = prodRepo.create({
      name: item.name,
      latinName: item.latinName || null,
      price: item.price,
      type: item.type as CatalogProduct["type"],
      categoryId,
      imageKey: item.imageKey || null,
      stockMode: item.stockMode as CatalogProduct["stockMode"],
      stockQty: item.stockQty ?? null,
      stockLevel: (item.stockLevel as CatalogProduct["stockLevel"]) ?? null,
      active: item.active,
      wysiwyg: item.wysiwyg,
    });

    await prodRepo.save(product);
    createdProducts++;
  }

  console.log(`\nDone!`);
  console.log(`  Parent categories created: ${createdParents}`);
  console.log(`  Child categories created: ${createdChildren}`);
  console.log(`  Products imported: ${createdProducts}`);

  await ds.destroy();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
