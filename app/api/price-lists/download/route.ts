import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PASSWORD = "RlQ8UG";

export async function POST(request: NextRequest) {
  try {
    const { password, filename } = await request.json();

    if (password !== PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "price-lists", sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    const contentType =
      ext === ".xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
