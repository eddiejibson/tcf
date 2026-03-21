import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeOrderUserIdNullable1773849100000 implements MigrationInterface {
  name = "MakeOrderUserIdNullable1773849100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "userId" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "userId" SET NOT NULL`);
  }
}
