import { cookies } from "next/headers";
import { verifySession, JwtPayload } from "../services/auth.service";

export async function requireAuth(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tcf_session")?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<JwtPayload | null> {
  const user = await requireAuth();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
