import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyTags1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tags master table — reusable labels applied to companies
    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tags" PRIMARY KEY ("id")
      )
    `);
    // Case-insensitive uniqueness so "VIP" and "vip" can't both exist
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tags_name_lower" ON "tags" (LOWER("name"))`);

    // Company <-> Tag many-to-many join table
    await queryRunner.query(`
      CREATE TABLE "company_tags" (
        "companyId" uuid NOT NULL,
        "tagId" uuid NOT NULL,
        CONSTRAINT "PK_company_tags" PRIMARY KEY ("companyId", "tagId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_company_tags_companyId" ON "company_tags" ("companyId")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_tags_tagId" ON "company_tags" ("tagId")`);
    await queryRunner.query(`ALTER TABLE "company_tags" ADD CONSTRAINT "FK_company_tags_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "company_tags" ADD CONSTRAINT "FK_company_tags_tag" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company_tags" DROP CONSTRAINT "FK_company_tags_tag"`);
    await queryRunner.query(`ALTER TABLE "company_tags" DROP CONSTRAINT "FK_company_tags_company"`);
    await queryRunner.query(`DROP TABLE "company_tags"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_tags_name_lower"`);
    await queryRunner.query(`DROP TABLE "tags"`);
  }
}
