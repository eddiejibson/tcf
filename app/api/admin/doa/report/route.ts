import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { generateDoaReport } from "@/server/services/doa.service";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { shipmentId } = await request.json();
    if (!shipmentId) return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });

    const report = await generateDoaReport(shipmentId);
    return NextResponse.json(report, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/doa/report error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
