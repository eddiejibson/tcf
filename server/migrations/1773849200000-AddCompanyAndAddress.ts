import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyAndAddress1773849200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create companies table
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "companyNumber" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      )
    `);

    // Create address type enum
    await queryRunner.query(`
      CREATE TYPE "addresses_type_enum" AS ENUM ('BILLING', 'SHIPPING')
    `);

    // Create addresses table
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "type" "addresses_type_enum" NOT NULL,
        "line1" varchar NOT NULL,
        "line2" varchar,
        "city" varchar NOT NULL,
        "county" varchar,
        "postcode" varchar NOT NULL,
        "country" varchar NOT NULL DEFAULT 'United Kingdom',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_addresses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_addresses_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    // Add companyId to users
    await queryRunner.query(`
      ALTER TABLE "users" ADD "companyId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "FK_users_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL
    `);

    // Add address JSONB fields to applications
    await queryRunner.query(`
      ALTER TABLE "applications" ADD "billingAddress" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "applications" ADD "shippingAddress" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "shippingAddress"`);
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "billingAddress"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_company"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyId"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
    await queryRunner.query(`DROP TYPE "addresses_type_enum"`);
    await queryRunner.query(`DROP TABLE "companies"`);
  }
}
