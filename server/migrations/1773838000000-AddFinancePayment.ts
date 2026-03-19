import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinancePayment1773838000000 implements MigrationInterface {
    name = 'AddFinancePayment1773838000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."orders_paymentmethod_enum" ADD VALUE IF NOT EXISTS 'FINANCE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Cannot remove enum values in PostgreSQL without recreating the type
    }
}
