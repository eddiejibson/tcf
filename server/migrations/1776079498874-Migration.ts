import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1776079498874 implements MigrationInterface {
    name = 'Migration1776079498874'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_payments_status_enum" AS ENUM('PENDING', 'AWAITING_CONFIRMATION', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "order_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "method" "public"."orders_paymentmethod_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "reference" character varying, "status" "public"."order_payments_status_enum" NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_bc14b014a69d39c7bbc4a154b69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "order_payments" ADD CONSTRAINT "FK_abca480893311e20150f01b2f15" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_payments" DROP CONSTRAINT "FK_abca480893311e20150f01b2f15"`);
        await queryRunner.query(`DROP TABLE "order_payments"`);
        await queryRunner.query(`DROP TYPE "public"."order_payments_status_enum"`);
    }
}
