import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { parseExcelBuffer } from "@/server/services/excel-parser.service";
import type { ColumnMapping } from "@/app/lib/types";

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcelBuffer(buffer, file.name, columnOverrides);

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Excel parse error:", e);
    return NextResponse.json({ error: "Failed to parse Excel file" }, { status: 500 });
  }
}
