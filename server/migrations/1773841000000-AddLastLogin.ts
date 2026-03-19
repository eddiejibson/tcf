import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLastLogin1773841000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "lastLogin" TIMESTAMP NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLogin"`);
  }
}
