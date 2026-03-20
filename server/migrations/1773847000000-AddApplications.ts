import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApplications1773847000000 implements MigrationInterface {
  name = "AddApplications1773847000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."applications_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`
    );

    await queryRunner.query(`
      CREATE TABLE "applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "companyName" character varying NOT NULL,
        "companyNumber" character varying,
        "contactName" character varying NOT NULL,
        "contactEmail" character varying NOT NULL,
        "phone" character varying,
        "licenseFileKey" character varying,
        "shopPhotoKeys" jsonb NOT NULL DEFAULT '[]',
        "additionalInfo" text,
        "status" "public"."applications_status_enum" NOT NULL DEFAULT 'PENDING',
        "rejectionReason" text,
        "userId" uuid,
        CONSTRAINT "PK_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_applications_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."applications_status_enum"`
    );
  }
}
