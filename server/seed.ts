import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { baseDbConfig } from "./db/config";
import { User, UserRole } from "./entities/User";

const ds = new DataSource({
  ...baseDbConfig,
  logging: true,
});

const ADMIN_EMAILS = [
  "roger@thecoralfarm.co.uk",
  "jibson@tuta.io",
];

async function seed() {
  await ds.initialize();
  const userRepo = ds.getRepository(User);

  for (const email of ADMIN_EMAILS) {
    const existing = await userRepo.findOneBy({ email });
    if (!existing) {
      await userRepo.save({ email, role: UserRole.ADMIN });
      console.log(`Admin user created: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
    }
  }

  await ds.destroy();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
