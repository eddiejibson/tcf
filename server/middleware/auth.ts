import { cookies } from "next/headers";
import { verifySession, JwtPayload } from "../services/auth.service";
import { Permission } from "../lib/permissions";
import { getDb } from "../db/data-source";
import { User } from "../entities/User";

export async function requireAuth(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tcf_session")?.value;
  if (!token) return null;
  try {
    const payload = await verifySession(token);
    // Old JWTs won't have companyRole — hydrate from DB
    if (payload.companyRole === undefined) {
      const db = await getDb();
      const dbUser = await db.getRepository(User).findOneBy({ id: payload.userId });
      if (dbUser) {
        payload.companyId = dbUser.companyId || null;
        payload.companyRole = dbUser.companyRole || null;
        payload.permissions = dbUser.permissions || null;
      }
    }
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<JwtPayload | null> {
  const user = await requireAuth();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export function hasPermission(user: JwtPayload, permission: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.companyRole === "OWNER") return true;
  // Users without a companyRole (not in the permission system) keep full access
  if (!user.companyRole) return true;
  // Only MEMBERs are restricted by their permissions array
  return user.permissions?.includes(permission) ?? false;
}

export async function requirePermission(permission: Permission): Promise<JwtPayload | null> {
  const user = await requireAuth();
  if (!user) return null;
  if (!hasPermission(user, permission)) return null;
  return user;
}

export function canAccessOrder(
  user: JwtPayload,
  order: { userId: string | null; user?: { companyId?: string | null } | null }
): boolean {
  if (user.role === "ADMIN") return true;
  if (order.userId === user.userId) return true;
  // Same company + VIEW_ORDERS permission
  if (user.companyId && order.user?.companyId === user.companyId && hasPermission(user, Permission.VIEW_ORDERS)) {
    return true;
  }
  return false;
}
