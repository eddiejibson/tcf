import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderDelivery1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryMethod" character varying`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryMiles" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryCharge" decimal(10,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryCharge"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryMiles"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryMethod"`);
  }
}
