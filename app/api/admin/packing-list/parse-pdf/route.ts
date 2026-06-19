import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { pdfBufferToGrid, pdfPackingTableRows, PdfParseError } from "@/server/services/pdf-grid.service";
import { buildPackingListResult } from "@/app/lib/parse-packing-list";
import { log } from "@/server/logger";

// pdfjs runs on the server (Node), never the edge runtime.
export const runtime = "nodejs";

// Reconstructs an uploaded packing-list PDF into a cell grid and runs it through the
// same parser the Excel path uses, returning an identical PackingListResult.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const grid = await pdfBufferToGrid(buffer);
    if (grid.length === 0) {
      return NextResponse.json({ error: "No selectable text found in this PDF — it may be a scanned image. Upload the Excel version instead." }, { status: 422 });
    }

    const tableRows = pdfPackingTableRows(grid);
    const result = buildPackingListResult([{ name: file.name.replace(/\.pdf$/i, ""), data: tableRows }]);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PdfParseError) return NextResponse.json({ error: e.message }, { status: 422 });
    log.error("Packing list PDF parse failed", e, { route: "/api/admin/packing-list/parse-pdf", method: "POST" });
    return NextResponse.json({ error: "Failed to parse packing list PDF" }, { status: 500 });
  }
}
