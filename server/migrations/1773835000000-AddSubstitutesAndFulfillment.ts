import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubstitutesAndFulfillment1773835000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add substitute columns to order_items
    await queryRunner.query(`ALTER TABLE "order_items" ADD "substituteProductId" uuid`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "substituteName" varchar`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_substitute_product" FOREIGN KEY ("substituteProductId") REFERENCES "products"("id") ON DELETE SET NULL`);

    // Add AWAITING_FULFILLMENT to order status enum
    await queryRunner.query(`ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'AWAITING_FULFILLMENT' AFTER 'SUBMITTED'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_substitute_product"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "substituteName"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "substituteProductId"`);
  }
}
