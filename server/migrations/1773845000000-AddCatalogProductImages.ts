import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogProductImages1773845000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog_product_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "catalogProductId" uuid NOT NULL,
        "imageKey" varchar NOT NULL,
        "label" varchar,
        "sortOrder" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_catalog_product_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_catalog_product_images_product" FOREIGN KEY ("catalogProductId")
          REFERENCES "catalog_products"("id") ON DELETE CASCADE
      )
    `);

    // Migrate existing imageKey data into the new table
    await queryRunner.query(`
      INSERT INTO "catalog_product_images" ("catalogProductId", "imageKey", "sortOrder")
      SELECT "id", "imageKey", 0
      FROM "catalog_products"
      WHERE "imageKey" IS NOT NULL
    `);

    // Drop the old column
    await queryRunner.query(`ALTER TABLE "catalog_products" DROP COLUMN "imageKey"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_products" ADD COLUMN "imageKey" varchar`);

    // Restore first image back to the column
    await queryRunner.query(`
      UPDATE "catalog_products" cp
      SET "imageKey" = sub."imageKey"
      FROM (
        SELECT DISTINCT ON ("catalogProductId") "catalogProductId", "imageKey"
        FROM "catalog_product_images"
        ORDER BY "catalogProductId", "sortOrder" ASC
      ) sub
      WHERE cp."id" = sub."catalogProductId"
    `);

    await queryRunner.query(`DROP TABLE "catalog_product_images"`);
  }
}
