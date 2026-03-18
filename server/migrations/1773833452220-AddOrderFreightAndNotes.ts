import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderFreightAndNotes1773833452220 implements MigrationInterface {
    name = 'AddOrderFreightAndNotes1773833452220'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "freightCharge" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "adminNotes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "adminNotes"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "freightCharge"`);
    }

}
