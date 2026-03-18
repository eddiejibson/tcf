import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1773833938639 implements MigrationInterface {
    name = 'Migration1773833938639'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "doa_items" ADD "imageKeys" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`UPDATE "doa_items" SET "imageKeys" = "imageKey" WHERE "imageKey" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "doa_items" DROP COLUMN "imageKey"`);
        await queryRunner.query(`ALTER TABLE "doa_items" ALTER COLUMN "imageKeys" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "doa_items" ADD "imageKey" character varying NOT NULL DEFAULT ''`);
        await queryRunner.query(`UPDATE "doa_items" SET "imageKey" = split_part("imageKeys", ',', 1)`);
        await queryRunner.query(`ALTER TABLE "doa_items" DROP COLUMN "imageKeys"`);
        await queryRunner.query(`ALTER TABLE "doa_items" ALTER COLUMN "imageKey" DROP DEFAULT`);
    }
}
