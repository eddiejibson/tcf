import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyRoleAndPermissions1773849300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "users_companyrole_enum" AS ENUM('OWNER', 'MEMBER')`);
    await queryRunner.query(`ALTER TABLE "users" ADD "companyRole" "users_companyrole_enum"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "permissions" jsonb`);
    await queryRunner.query(`ALTER TABLE "users" ADD "invitedById" uuid`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL`);

    // Backfill: existing company users become OWNER
    await queryRunner.query(`UPDATE "users" SET "companyRole" = 'OWNER' WHERE "companyId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_invitedBy"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "invitedById"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "permissions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyRole"`);
    await queryRunner.query(`DROP TYPE "users_companyrole_enum"`);
  }
}
