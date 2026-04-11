import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductFeatured1773850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured" boolean NOT NULL DEFAULT false`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "featured"`);
  }
}
