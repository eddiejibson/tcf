import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreditTransactionItems1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credit_transactions" ADD "items" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credit_transactions" DROP COLUMN "items"`);
  }
}
