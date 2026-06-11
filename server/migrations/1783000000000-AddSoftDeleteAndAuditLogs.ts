import { MigrationInterface, QueryRunner } from "typeorm";

const SOFT_DELETE_TABLES = [
  "users",
  "companies",
  "shipments",
  "orders",
  "categories",
  "doa_claims",
  "order_payments",
  "products",
  "doa_reports",
];

export class AddSoftDeleteAndAuditLogs1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of SOFT_DELETE_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "deletedAt" TIMESTAMP`);
    }
    await queryRunner.query(
      `CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "action" character varying NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" uuid,
        "actorId" uuid,
        "actorEmail" character varying,
        "meta" jsonb,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )`
    );
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityType" ON "audit_logs" ("entityType")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actorId" ON "audit_logs" ("actorId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    for (const table of SOFT_DELETE_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "deletedAt"`);
    }
  }
}
