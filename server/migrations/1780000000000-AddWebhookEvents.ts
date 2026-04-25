import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWebhookEvents1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "provider" varchar NOT NULL,
        "eventId" varchar NOT NULL,
        "eventType" varchar,
        CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_events_provider_eventId" UNIQUE ("provider", "eventId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_events_provider_event" ON "webhook_events" ("provider", "eventId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_webhook_events_provider_event"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
  }
}
