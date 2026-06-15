import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShipmentNotes1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" ADD "notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN "notes"`);
  }
}
