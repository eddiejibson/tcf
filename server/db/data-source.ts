import "reflect-metadata";
import { DataSource } from "typeorm";
import { baseDbConfig } from "./config";

const AppDataSource = new DataSource({
  ...baseDbConfig,
  logging: false,
  extra: {
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  },
});

let initialized = false;

export async function getDb(): Promise<DataSource> {
  if (!initialized) {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    initialized = true;
  }
  return AppDataSource;
}
