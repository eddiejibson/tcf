import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { generateDoaReport } from "@/server/services/doa.service";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { shipmentId } = await request.json();
    if (!shipmentId) return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });

    const report = await generateDoaReport(shipmentId);
    return NextResponse.json(report, { status: 201 });
  } catch (e) {
    log.error("Failed to generate DOA report", e, { route: "/api/admin/doa/report", method: "POST" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
