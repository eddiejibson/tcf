import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/server/services/storage.service";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const key = `applications/uploads/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadBuffer(key, buffer, file.type);

    return NextResponse.json({ key, name: file.name });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
