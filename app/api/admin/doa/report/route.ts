import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { generateDoaReport } from "@/server/services/doa.service";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { shipmentId } = await request.json();
  if (!shipmentId) return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });

  try {
    const report = await generateDoaReport(shipmentId);
    return NextResponse.json(report, { status: 201 });
  } catch (e: unknown) {
    console.error("Failed to generate DOA report:", e);
    const message = e instanceof Error ? e.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
