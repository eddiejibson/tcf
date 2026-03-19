import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogWysiwyg1773840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_products" ADD COLUMN "wysiwyg" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_products" DROP COLUMN "wysiwyg"`);
  }
}
