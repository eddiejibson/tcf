import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerHeadType1773844000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."catalog_product_type_enum" ADD VALUE IF NOT EXISTS 'PER_HEAD'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing values from enums
  }
}
