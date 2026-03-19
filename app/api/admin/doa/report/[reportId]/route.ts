import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaReport, getDoaReportDownloadUrl } from "@/server/services/doa.service";
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

    const downloadUrl = await getDoaReportDownloadUrl(reportId);

    return NextResponse.json({ ...report, downloadUrl });
  } catch (e) {
    log.error("Failed to get DOA report", e, { route: "/api/admin/doa/report/[reportId]", method: "GET" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
