import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderBoxLimits1773849000000 implements MigrationInterface {
  name = "AddOrderBoxLimits1773849000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "maxBoxes" integer`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "minBoxes" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "minBoxes"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "maxBoxes"`);
  }
}
