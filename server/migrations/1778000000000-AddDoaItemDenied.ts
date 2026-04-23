import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDoaItemDenied1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doa_items" ADD "denied" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doa_items" DROP COLUMN "denied"`);
  }
}
