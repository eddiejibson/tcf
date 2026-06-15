import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentCurrency1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" ADD "currency" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "currency"`);
  }
}
