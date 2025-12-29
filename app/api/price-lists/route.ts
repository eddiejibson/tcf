import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PASSWORD = "RlQ8UG";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const priceListsDir = path.join(process.cwd(), "price-lists");

    if (!fs.existsSync(priceListsDir)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(priceListsDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".xlsx" || ext === ".xls";
    });

    const fileDetails = files.map((file) => {
      const filePath = path.join(priceListsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    });

    return NextResponse.json({ files: fileDetails });
  } catch {
    return NextResponse.json(
      { error: "Failed to read price lists" },
      { status: 500 }
    );
  }
}
