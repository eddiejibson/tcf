import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";
import { getCreditBalance, getCreditHistory, addManualCredit } from "@/server/services/credit.service";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block credit adjustments for admin users
  const db = await getDb();
  const targetUser = await db.getRepository(User).findOneBy({ id });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (targetUser.role === UserRole.ADMIN) {
    return NextResponse.json({ error: "Cannot adjust credit for admin users" }, { status: 400 });
  }

  const { amount, description, items } = await request.json();

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const cleanedItems = parseCreditItems(items);
  const result = await addManualCredit(id, Number(amount), description || "Manual adjustment", cleanedItems);
  return NextResponse.json(result);
}

function parseCreditItems(input: unknown) {
  if (!Array.isArray(input)) return null;
  const cleaned = input
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as { name?: unknown; quantity?: unknown; unitPrice?: unknown };
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const quantity = Number(r.quantity);
      const unitPrice = Number(r.unitPrice);
      if (!name || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null;
      return { name, quantity, unitPrice };
    })
    .filter((r): r is { name: string; quantity: number; unitPrice: number } => r !== null);
  return cleaned.length ? cleaned : null;
}
