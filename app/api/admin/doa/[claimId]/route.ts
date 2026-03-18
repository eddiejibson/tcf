import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaClaimById, updateDoaItemApprovals, approveAllItemsForClaim } from "@/server/services/doa.service";
import { getDownloadUrl } from "@/server/services/storage.service";
import { log } from "@/server/logger";

async function itemsWithUrls(claim: NonNullable<Awaited<ReturnType<typeof getDoaClaimById>>>) {
  return Promise.all(
    claim.items.map(async (item) => ({
      ...item,
      imageUrls: await Promise.all((item.imageKeys || []).map((k: string) => getDownloadUrl(k))),
    }))
  );
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { claimId } = await params;
    const claim = await getDoaClaimById(claimId);
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    return NextResponse.json({ ...claim, items: await itemsWithUrls(claim) });
  } catch (e) {
    log.error("Failed to get DOA claim", e, { route: "/api/admin/doa/[claimId]", method: "GET" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { claimId } = await params;
    const body = await request.json();

    let claim;
    if (body.approveAll) {
      claim = await approveAllItemsForClaim(claimId);
    } else if (body.approvals && Array.isArray(body.approvals)) {
      claim = await updateDoaItemApprovals(claimId, body.approvals);
    } else {
      return NextResponse.json({ error: "Provide approvals array or approveAll flag" }, { status: 400 });
    }

    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    return NextResponse.json({ ...claim, items: await itemsWithUrls(claim) });
  } catch (e) {
    log.error("Failed to update DOA claim", e, { route: "/api/admin/doa/[claimId]", method: "PATCH" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
