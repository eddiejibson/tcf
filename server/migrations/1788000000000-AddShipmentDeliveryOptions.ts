import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentDeliveryOptions1788000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" ADD "deliveryOptions" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "deliveryOptions"`);
  }
}
