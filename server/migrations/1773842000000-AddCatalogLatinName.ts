import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCatalogLatinName1773842000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_products" ADD "latinName" VARCHAR NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_products" DROP COLUMN "latinName"`);
  }
}
