import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
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

  const { amount, description } = await request.json();

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const result = await addManualCredit(id, Number(amount), description || "Manual adjustment");
  return NextResponse.json(result);
}
