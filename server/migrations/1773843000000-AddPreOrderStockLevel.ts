import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreOrderStockLevel1773843000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."stock_level_enum" ADD VALUE IF NOT EXISTS 'PRE_ORDER'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing values from enums
  }
}
