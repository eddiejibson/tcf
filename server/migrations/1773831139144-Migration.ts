import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1773831139144 implements MigrationInterface {
    name = 'Migration1773831139144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "availableQty" integer`);
        await queryRunner.query(`CREATE TYPE "public"."orders_paymentmethod_enum" AS ENUM('BANK_TRANSFER', 'CARD')`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "paymentMethod" "public"."orders_paymentmethod_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "paymentReference" character varying`);
        await queryRunner.query(`UPDATE "orders" SET "status" = 'SUBMITTED' WHERE "status" = 'APPROVED'`);
        await queryRunner.query(`ALTER TYPE "public"."orders_status_enum" RENAME TO "orders_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID', 'EXPIRED')`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."orders_status_enum" USING "status"::"text"::"public"."orders_status_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum_old" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."orders_status_enum_old" USING "status"::"text"::"public"."orders_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."orders_status_enum_old" RENAME TO "orders_status_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentReference"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentMethod"`);
        await queryRunner.query(`DROP TYPE "public"."orders_paymentmethod_enum"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "availableQty"`);
    }

}
