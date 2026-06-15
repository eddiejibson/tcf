import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFractionalBags1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "packOptions" jsonb`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD "fractionalBagsEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "packFraction" character varying`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "bagCount" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "bagCount"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "packFraction"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "fractionalBagsEnabled"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "packOptions"`);
  }
}
