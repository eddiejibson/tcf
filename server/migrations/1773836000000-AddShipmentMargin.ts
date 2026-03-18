import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentMargin1773836000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" ADD "margin" decimal(5,2) NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "margin"`);
  }
}
