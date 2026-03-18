import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1773833218924 implements MigrationInterface {
    name = 'Migration1773833218924'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."doa_claims_status_enum" AS ENUM('PENDING', 'REVIEWED', 'REPORTED')`);
        await queryRunner.query(`CREATE TABLE "doa_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "status" "public"."doa_claims_status_enum" NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_fb496496a47180b9792f83bd9c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "doa_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "claimId" uuid NOT NULL, "orderItemId" uuid NOT NULL, "quantity" integer NOT NULL, "imageKey" character varying NOT NULL, "approved" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_2473db10f1c6b0f4be0e7915fb8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "doa_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shipmentId" uuid NOT NULL, "reportText" text NOT NULL, "zipKey" character varying, CONSTRAINT "PK_4c168e1ef54d0e91a00622a3024" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "doa_claims" ADD CONSTRAINT "FK_bf94bb0c428fc4dc4e74581551a" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doa_items" ADD CONSTRAINT "FK_41fe551d901e49065cf05471e67" FOREIGN KEY ("claimId") REFERENCES "doa_claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doa_items" ADD CONSTRAINT "FK_34a54f917573689ae0f3ec6962f" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doa_reports" ADD CONSTRAINT "FK_57ae136e866f469ebf5d4b536f0" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "doa_reports" DROP CONSTRAINT "FK_57ae136e866f469ebf5d4b536f0"`);
        await queryRunner.query(`ALTER TABLE "doa_items" DROP CONSTRAINT "FK_34a54f917573689ae0f3ec6962f"`);
        await queryRunner.query(`ALTER TABLE "doa_items" DROP CONSTRAINT "FK_41fe551d901e49065cf05471e67"`);
        await queryRunner.query(`ALTER TABLE "doa_claims" DROP CONSTRAINT "FK_bf94bb0c428fc4dc4e74581551a"`);
        await queryRunner.query(`DROP TABLE "doa_reports"`);
        await queryRunner.query(`DROP TABLE "doa_items"`);
        await queryRunner.query(`DROP TABLE "doa_claims"`);
        await queryRunner.query(`DROP TYPE "public"."doa_claims_status_enum"`);
    }

}
