import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderBoxCountFreightPerBox1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "boxCount" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "freightPerBox" decimal(10,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "freightPerBox"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "boxCount"`);
  }
}
