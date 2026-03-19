import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";
import { getCreditBalance, getCreditHistory, addManualCredit } from "@/server/services/credit.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [balance, transactions] = await Promise.all([
    getCreditBalance(id),
    getCreditHistory(id),
  ]);

  return NextResponse.json({ balance, transactions });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Block credit adjustments for admin users
  const db = await getDb();
  const targetUser = await db.getRepository(User).findOneBy({ id });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (targetUser.role === UserRole.ADMIN) {
    return NextResponse.json({ error: "Cannot adjust credit for admin users" }, { status: 400 });
  }

  const { amount, description } = await request.json();

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const result = await addManualCredit(id, Number(amount), description || "Manual adjustment");
  return NextResponse.json(result);
}
