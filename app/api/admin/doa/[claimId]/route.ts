import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDoaClaimById, updateDoaItemStates, approveAllItemsForClaim } from "@/server/services/doa.service";
import { claimWithGroupUrls } from "@/server/services/doa-serialize";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { claimId } = await params;
    if (!isUuid(claimId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const claim = await getDoaClaimById(claimId);
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    return NextResponse.json(await claimWithGroupUrls(claim));
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
    if (!isUuid(claimId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json();

    let claim;
    if (body.approveAll) {
      claim = await approveAllItemsForClaim(claimId);
    } else if (body.actions && Array.isArray(body.actions)) {
      for (const action of body.actions) {
        if (!action.itemId || !["approve", "deny", "pending"].includes(action.action)) {
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
      }
      claim = await updateDoaItemStates(claimId, body.actions);
    } else {
      return NextResponse.json({ error: "Provide actions array or approveAll flag" }, { status: 400 });
    }

    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    return NextResponse.json(await claimWithGroupUrls(claim));
  } catch (e) {
    log.error("Failed to update DOA claim", e, { route: "/api/admin/doa/[claimId]", method: "PATCH" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
