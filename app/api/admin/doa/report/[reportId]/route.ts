import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaReport, getDoaReportDownloadUrl } from "@/server/services/doa.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { reportId } = await params;
    const report = await getDoaReport(reportId);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const downloadUrl = await getDoaReportDownloadUrl(reportId);

    return NextResponse.json({ ...report, downloadUrl });
  } catch (e) {
    console.error("GET /api/admin/doa/report/[reportId] error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
