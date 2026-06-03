import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyTrafficLight1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."companies_trafficlight_enum" AS ENUM('RED', 'AMBER', 'GREEN')`);
    await queryRunner.query(`ALTER TABLE "companies" ADD "trafficLight" "public"."companies_trafficlight_enum" NOT NULL DEFAULT 'AMBER'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "trafficLight"`);
    await queryRunner.query(`DROP TYPE "public"."companies_trafficlight_enum"`);
  }
}
