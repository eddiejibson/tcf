import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApplicationAccountsFields1773848000000 implements MigrationInterface {
  name = "AddApplicationAccountsFields1773848000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" ADD "accountsName" character varying`);
    await queryRunner.query(`ALTER TABLE "applications" ADD "accountsEmail" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "accountsEmail"`);
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "accountsName"`);
  }
}
