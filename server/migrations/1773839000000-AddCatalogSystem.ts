import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogSystem1773839000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`CREATE TYPE "catalog_product_type_enum" AS ENUM ('COLONY', 'FRAG')`);
    await queryRunner.query(`CREATE TYPE "stock_mode_enum" AS ENUM ('EXACT', 'ROUGH')`);
    await queryRunner.query(`CREATE TYPE "stock_level_enum" AS ENUM ('LOW', 'AVERAGE', 'HIGH')`);

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "parentId" uuid,
        "sortOrder" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);

    // Create catalog_products table
    await queryRunner.query(`
      CREATE TABLE "catalog_products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "type" "catalog_product_type_enum" NOT NULL,
        "categoryId" uuid NOT NULL,
        "imageKey" varchar,
        "stockMode" "stock_mode_enum" NOT NULL,
        "stockQty" int,
        "stockLevel" "stock_level_enum",
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_catalog_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_catalog_products_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
      )
    `);

    // Make orders.shipmentId nullable
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "shipmentId" DROP NOT NULL`);

    // Add catalogProductId to order_items
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN "catalogProductId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_catalog_product"
      FOREIGN KEY ("catalogProductId") REFERENCES "catalog_products"("id")
    `);

    // Seed default categories
    const categories: Record<string, string[]> = {
      LPS: [
        "Acan", "Alveopora", "Blastomussa", "Bubble", "Cataphyllia", "Chalice",
        "Cynarina", "Cyphastrea", "Echinata", "Favia", "Frogspawn", "Fungia",
        "Goniopora", "Hammer", "Leptastrea", "Parascolymia", "Scolymia",
        "Symphyllia", "Torch", "Trachyphyllia", "Wellsophyllia",
      ],
      SPS: ["Acropora", "Montipora", "Stylocoeniella"],
      Softies: ["Leathers", "Mushrooms", "Polyps", "Zoa"],
      Inverts: ["Anemone", "Crabs", "Snails", "Urchins"],
    };

    let sortOrder = 0;
    for (const [parentName, children] of Object.entries(categories)) {
      // Insert parent
      const parentResult = await queryRunner.query(
        `INSERT INTO "categories" ("id", "name", "sortOrder") VALUES (uuid_generate_v4(), $1, $2) RETURNING "id"`,
        [parentName, sortOrder++]
      );
      const parentId = parentResult[0].id;

      // Insert children
      let childSort = 0;
      for (const childName of children) {
        await queryRunner.query(
          `INSERT INTO "categories" ("id", "name", "parentId", "sortOrder") VALUES (uuid_generate_v4(), $1, $2, $3)`,
          [childName, parentId, childSort++]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_catalog_product"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "catalogProductId"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "shipmentId" SET NOT NULL`);
    await queryRunner.query(`DROP TABLE "catalog_products"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "stock_level_enum"`);
    await queryRunner.query(`DROP TYPE "stock_mode_enum"`);
    await queryRunner.query(`DROP TYPE "catalog_product_type_enum"`);
  }
}
