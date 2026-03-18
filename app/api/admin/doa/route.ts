import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getAllDoaClaimsGrouped } from "@/server/services/doa.service";
import { getDownloadUrl } from "@/server/services/storage.service";
import { log } from "@/server/logger";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const groups = await getAllDoaClaimsGrouped();

    const result = await Promise.all(
      groups.map(async (group) => ({
        ...group,
        claims: await Promise.all(
          group.claims.map(async (claim) => ({
            ...claim,
            items: await Promise.all(
              claim.items.map(async (item) => ({
                ...item,
                imageUrls: await Promise.all((item.imageKeys || []).map((k: string) => getDownloadUrl(k))),
              }))
            ),
          }))
        ),
      }))
    );

    return NextResponse.json(result);
  } catch (e) {
    log.error("Failed to get DOA claims", e, { route: "/api/admin/doa", method: "GET" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
