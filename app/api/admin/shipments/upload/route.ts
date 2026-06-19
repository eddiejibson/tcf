import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { parseExcelBuffer } from "@/server/services/excel-parser.service";
import { parsePdfBuffer, PdfParseError } from "@/server/services/pdf-grid.service";
import type { ColumnMapping } from "@/app/lib/types";
import { log } from "@/server/logger";

// pdfjs runs on the server (Node), never the edge runtime.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    let columnOverrides: Partial<ColumnMapping> | undefined;
    const overridesStr = formData.get("columnOverrides") as string | null;
    if (overridesStr) {
      try { columnOverrides = JSON.parse(overridesStr); } catch { /* ignore */ }
    }

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = isPdf
      ? await parsePdfBuffer(buffer, file.name, columnOverrides)
      : parseExcelBuffer(buffer, file.name, columnOverrides);

    return NextResponse.json(parsed);
  } catch (e) {
    // Surface actionable problems (password-protected, scanned, corrupt) to the admin;
    // keep generic 500 for unexpected internal failures.
    if (e instanceof PdfParseError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    log.error("List parse failed", e, { route: "/api/admin/shipments/upload", method: "POST" });
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
