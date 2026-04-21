import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderDiscountApplied1777000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "discountPercent" decimal(5,2) NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discountPercent"`);
  }
}
