import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { getDb } from "../db/data-source";
import { User } from "../entities/User";
import { MagicLink } from "../entities/MagicLink";
import { sendMagicLink } from "./email.service";

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const JWT_EXPIRY = "7d";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

export async function requestMagicLink(email: string): Promise<boolean> {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const user = await userRepo.findOneBy({ email: email.toLowerCase().trim() });
  if (!user) return false;

  const linkRepo = db.getRepository(MagicLink);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  await linkRepo.save({ token, userId: user.id, expiresAt });

  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/verify?token=${token}`;
  await sendMagicLink(user.email, url);

  return true;
}

export async function verifyMagicToken(token: string): Promise<User | null> {
  const db = await getDb();
  const linkRepo = db.getRepository(MagicLink);

  const link = await linkRepo.findOne({
    where: { token },
    relations: ["user"],
  });

  if (!link) return null;
  if (link.usedAt) return null;
  if (link.expiresAt < new Date()) return null;

  await linkRepo.update(link.id, { usedAt: new Date() });
  return link.user;
}

export async function createSession(user: User): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
  } as JwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as JwtPayload;
}
