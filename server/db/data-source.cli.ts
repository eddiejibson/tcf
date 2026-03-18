import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { baseDbConfig } from "./config";

export default new DataSource({
  ...baseDbConfig,
  migrations: ["server/migrations/*.ts"],
  logging: true,
});
