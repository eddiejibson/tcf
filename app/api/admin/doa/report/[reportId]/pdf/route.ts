import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaReport, generateDoaReportPdfForShipment } from "@/server/services/doa.service";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { reportId } = await params;
    if (!isUuid(reportId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const report = await getDoaReport(reportId);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const result = await generateDoaReportPdfForShipment(report.shipmentId);
    if (!result) return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });

    const safeName = result.shipmentName.replace(/[^a-zA-Z0-9-_ ]/g, "_").trim() || "shipment";
    const filename = `DOA-Report-${safeName}.pdf`;

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    log.error("Failed to generate DOA report PDF", e, {
      route: "/api/admin/doa/report/[reportId]/pdf",
      method: "GET",
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
