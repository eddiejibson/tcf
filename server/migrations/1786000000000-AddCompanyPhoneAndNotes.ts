import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyPhoneAndNotes1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phone is now a first-class company attribute. Previously it was only captured
    // on the application and lost after approval, making it very hard to find.
    // salesNotes are internal, admin-only and must never be returned to customers.
    // IF NOT EXISTS keeps this safe if the columns were already added out-of-band.
    await queryRunner.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "phone" varchar`);
    await queryRunner.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "salesNotes" text`);

    // Backfill phone onto existing companies from their most recent linked
    // application (matched via the application's user, by id or contact email).
    await queryRunner.query(`
      UPDATE "companies" c
      SET "phone" = sub."phone"
      FROM (
        SELECT DISTINCT ON (u."companyId")
          u."companyId" AS company_id,
          a."phone" AS "phone"
        FROM "applications" a
        JOIN "users" u
          ON (u."id" = a."userId" OR LOWER(u."email") = LOWER(a."contactEmail"))
        WHERE a."phone" IS NOT NULL
          AND a."phone" <> ''
          AND u."companyId" IS NOT NULL
        ORDER BY u."companyId", a."createdAt" DESC
      ) sub
      WHERE c."id" = sub.company_id
        AND (c."phone" IS NULL OR c."phone" = '')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "salesNotes"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "phone"`);
  }
}
