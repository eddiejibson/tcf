import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyName1773837000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "companyName" varchar NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyName"`);
  }
}
