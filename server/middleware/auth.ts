import { cookies } from "next/headers";
import { verifySession, JwtPayload } from "../services/auth.service";
import { Permission } from "../lib/permissions";

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

export function hasPermission(user: JwtPayload, permission: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.companyRole === "OWNER") return true;
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
