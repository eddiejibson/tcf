import fs from "fs";
import path from "path";
import { DataSourceOptions } from "typeorm";
import { User } from "../entities/User";
import { MagicLink } from "../entities/MagicLink";
import { Shipment } from "../entities/Shipment";
import { Product } from "../entities/Product";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";

const ca = fs.readFileSync(
  path.join(process.cwd(), "server", "db", "ca-certificate.crt")
).toString();

export const entities = [User, MagicLink, Shipment, Product, Order, OrderItem];

export const baseDbConfig: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca },
  entities,
  synchronize: false,
};
