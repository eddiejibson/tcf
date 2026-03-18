import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreditSystem1773834500000 implements MigrationInterface {
    name = 'AddCreditSystem1773834500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add creditBalance to users
        await queryRunner.query(`ALTER TABLE "users" ADD "creditBalance" numeric(10,2) NOT NULL DEFAULT 0`);

        // Add creditApplied and useCredit to orders
        await queryRunner.query(`ALTER TABLE "orders" ADD "creditApplied" numeric(10,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "useCredit" boolean NOT NULL DEFAULT false`);

        // Create credit_type enum
        await queryRunner.query(`CREATE TYPE "public"."credit_transactions_type_enum" AS ENUM('DOA_CREDIT', 'MANUAL_ADJUSTMENT', 'CREDIT_APPLIED', 'CREDIT_REFUND')`);

        // Create credit_transactions table
        await queryRunner.query(`
            CREATE TABLE "credit_transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userId" uuid NOT NULL,
                "type" "public"."credit_transactions_type_enum" NOT NULL,
                "amount" numeric(10,2) NOT NULL,
                "description" character varying NOT NULL,
                "orderId" uuid,
                "doaClaimId" uuid,
                CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id")
            )
        `);

        // Add foreign keys
        await queryRunner.query(`ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_credit_transactions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_credit_transactions_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_credit_transactions_doa_claim" FOREIGN KEY ("doaClaimId") REFERENCES "doa_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_credit_transactions_doa_claim"`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_credit_transactions_order"`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_credit_transactions_user"`);
        await queryRunner.query(`DROP TABLE "credit_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."credit_transactions_type_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "useCredit"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "creditApplied"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "creditBalance"`);
    }
}
