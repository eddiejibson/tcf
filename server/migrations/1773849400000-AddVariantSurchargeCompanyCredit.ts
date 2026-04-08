import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVariantSurchargeCompanyCredit1773849400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Product variant
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variant" varchar`);

    // Surcharge on products, catalog_products, order_items
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "surcharge" decimal(5,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "catalog_products" ADD COLUMN IF NOT EXISTS "surcharge" decimal(5,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "surcharge" decimal(5,2) NOT NULL DEFAULT 0`);

    // Company credit balance
    await queryRunner.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "creditBalance" decimal(10,2) NOT NULL DEFAULT 0`);

    // Credit transactions: add companyId, make userId nullable
    await queryRunner.query(`ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "companyId" uuid`);
    await queryRunner.query(`ALTER TABLE "credit_transactions" ALTER COLUMN "userId" DROP NOT NULL`);

    // Backfill companyId on existing credit_transactions from user's company
    await queryRunner.query(`
      UPDATE "credit_transactions" ct
      SET "companyId" = u."companyId"
      FROM "users" u
      WHERE ct."userId" = u.id AND ct."companyId" IS NULL AND u."companyId" IS NOT NULL
    `);

    // Migrate user credit balances to their companies
    await queryRunner.query(`
      UPDATE "companies" c
      SET "creditBalance" = sub.total
      FROM (
        SELECT u."companyId", SUM(u."creditBalance") AS total
        FROM "users" u
        WHERE u."companyId" IS NOT NULL AND u."creditBalance" > 0
        GROUP BY u."companyId"
      ) sub
      WHERE c.id = sub."companyId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credit_transactions" ALTER COLUMN "userId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP COLUMN IF EXISTS "companyId"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "creditBalance"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "surcharge"`);
    await queryRunner.query(`ALTER TABLE "catalog_products" DROP COLUMN IF EXISTS "surcharge"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "surcharge"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "variant"`);
  }
}
