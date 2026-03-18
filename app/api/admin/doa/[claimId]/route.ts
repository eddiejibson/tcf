import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaClaimById, updateDoaItemApprovals, approveAllItemsForClaim } from "@/server/services/doa.service";
import { getDownloadUrl } from "@/server/services/storage.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { claimId } = await params;
  const claim = await getDoaClaimById(claimId);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const itemsWithUrls = await Promise.all(
    claim.items.map(async (item) => ({
      ...item,
      imageUrls: await Promise.all(item.imageKeys.map((k: string) => getDownloadUrl(k))),
    }))
  );

  return NextResponse.json({ ...claim, items: itemsWithUrls });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
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

  const itemsWithUrls = await Promise.all(
    claim.items.map(async (item) => ({
      ...item,
      imageUrls: await Promise.all(item.imageKeys.map((k: string) => getDownloadUrl(k))),
    }))
  );

  return NextResponse.json({ ...claim, items: itemsWithUrls });
}
