import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentFreightCurrency1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" ADD "freightCurrency" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "freightCurrency"`);
  }
}
