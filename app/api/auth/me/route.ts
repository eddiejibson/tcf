import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getCreditBalance } from "@/server/services/credit.service";
import { getDb } from "@/server/db/data-source";
import { User } from "@/server/entities/User";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const db = await getDb();
  const dbUser = await db.getRepository(User).findOneBy({ id: user.userId });
  const creditBalance = await getCreditBalance(user.userId);
  return NextResponse.json({ ...user, companyName: dbUser?.companyName || null, creditBalance });
}
