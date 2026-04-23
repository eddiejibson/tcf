import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDoaPhotoGroups1779000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "doa_photo_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "claimId" uuid NOT NULL,
        "imageKeys" text NOT NULL,
        CONSTRAINT "PK_doa_photo_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doa_photo_groups_claim" FOREIGN KEY ("claimId") REFERENCES "doa_claims"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`ALTER TABLE "doa_items" ADD "photoGroupId" uuid`);

    // Backfill: create one photo group per existing DoaItem, using a temp column
    // to map each new group back to its source item for a precise UPDATE.
    await queryRunner.query(`ALTER TABLE "doa_photo_groups" ADD "sourceItemId" uuid`);
    await queryRunner.query(`
      INSERT INTO "doa_photo_groups" ("id", "claimId", "imageKeys", "sourceItemId", "createdAt", "updatedAt")
      SELECT uuid_generate_v4(), "claimId", COALESCE("imageKeys", ''), "id", "createdAt", "updatedAt"
      FROM "doa_items"
    `);
    await queryRunner.query(`
      UPDATE "doa_items" di
      SET "photoGroupId" = pg."id"
      FROM "doa_photo_groups" pg
      WHERE pg."sourceItemId" = di."id"
    `);
    await queryRunner.query(`ALTER TABLE "doa_photo_groups" DROP COLUMN "sourceItemId"`);

    await queryRunner.query(`ALTER TABLE "doa_items" ALTER COLUMN "photoGroupId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "doa_items"
      ADD CONSTRAINT "FK_doa_items_photo_group"
      FOREIGN KEY ("photoGroupId") REFERENCES "doa_photo_groups"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`ALTER TABLE "doa_items" DROP COLUMN "imageKeys"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doa_items" ADD "imageKeys" text`);
    await queryRunner.query(`
      UPDATE "doa_items" di
      SET "imageKeys" = pg."imageKeys"
      FROM "doa_photo_groups" pg
      WHERE pg."id" = di."photoGroupId"
    `);
    await queryRunner.query(`ALTER TABLE "doa_items" ALTER COLUMN "imageKeys" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "doa_items" DROP CONSTRAINT "FK_doa_items_photo_group"`);
    await queryRunner.query(`ALTER TABLE "doa_items" DROP COLUMN "photoGroupId"`);
    await queryRunner.query(`DROP TABLE "doa_photo_groups"`);
  }
}
