import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getUploadUrl, uploadBuffer } from "@/server/services/storage.service";
import { v4 as uuid } from "uuid";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = request.headers.get("content-type") || "";
    const isProxy = contentType.includes("multipart/form-data");

    if (isProxy) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

      const ext = file.name.split(".").pop() || "jpg";
      const key = `doa-images/${user.userId}/${uuid()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadBuffer(key, buffer, file.type || "image/jpeg");

      return NextResponse.json({ key });
    }

    const body = await request.json();
    if (!body.contentType || !body.filename) {
      return NextResponse.json({ error: "contentType and filename are required" }, { status: 400 });
    }

    const ext = body.filename.split(".").pop() || "jpg";
    const key = `doa-images/${user.userId}/${uuid()}.${ext}`;
    const url = await getUploadUrl(key, body.contentType);

    return NextResponse.json({ url, key });
  } catch (e) {
    log.error("Upload signed URL failed", e, { route: "/api/upload/signed-url", method: "POST" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
