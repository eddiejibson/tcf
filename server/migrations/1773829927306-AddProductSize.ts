import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductSize1773829927306 implements MigrationInterface {
    name = 'AddProductSize1773829927306'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "size" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "size"`);
    }

}
