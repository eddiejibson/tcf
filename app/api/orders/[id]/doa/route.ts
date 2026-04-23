import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder, hasPermission } from "@/server/middleware/auth";
import { getOrderById } from "@/server/services/order.service";
import { createDoaClaim, getDoaClaimByOrderId } from "@/server/services/doa.service";
import { claimWithGroupUrls } from "@/server/services/doa-serialize";
import { Permission } from "@/server/lib/permissions";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!hasPermission(user, Permission.VIEW_DOA)) return NextResponse.json({ error: "No permission to view DOA claims" }, { status: 403 });

    const claim = await getDoaClaimByOrderId(id);
    if (!claim) return NextResponse.json(null);

    return NextResponse.json(await claimWithGroupUrls(claim));
  } catch (e) {
    log.error("Failed to get DOA claim", e, { route: "/api/orders/[id]/doa", method: "GET" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!hasPermission(user, Permission.CREATE_DOA)) return NextResponse.json({ error: "No permission to submit DOA claims" }, { status: 403 });
    const doaAllowed =
      order.status === "PAID" ||
      (order.status === "ACCEPTED" && !!order.shipmentId);
    if (!doaAllowed) {
      return NextResponse.json(
        { error: "Order must be paid, or accepted with a shipment attached, to report DOA" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Accept either the new {groups:[{imageKeys, items:[{orderItemId, quantity}]}]}
    // shape or the legacy {items:[{orderItemId, quantity, imageKeys}]} shape —
    // each legacy item becomes its own single-item group.
    let groups: { imageKeys: string[]; items: { orderItemId: string; quantity: number }[] }[];
    if (Array.isArray(body.groups)) {
      groups = body.groups;
    } else if (Array.isArray(body.items)) {
      groups = body.items.map((it: { orderItemId: string; quantity: number; imageKeys: string[] }) => ({
        imageKeys: it.imageKeys || [],
        items: [{ orderItemId: it.orderItemId, quantity: it.quantity }],
      }));
    } else {
      return NextResponse.json({ error: "Provide groups or items array" }, { status: 400 });
    }

    if (groups.length === 0) {
      return NextResponse.json({ error: "At least one photo group is required" }, { status: 400 });
    }

    for (const group of groups) {
      if (!Array.isArray(group.imageKeys) || group.imageKeys.length === 0) {
        return NextResponse.json({ error: "Each group needs at least one photo" }, { status: 400 });
      }
      if (!Array.isArray(group.items) || group.items.length === 0) {
        return NextResponse.json({ error: "Each group needs at least one item" }, { status: 400 });
      }
      for (const item of group.items) {
        if (!item.orderItemId || !item.quantity) {
          return NextResponse.json({ error: "Each item needs orderItemId and quantity" }, { status: 400 });
        }
      }
    }

    const claim = await createDoaClaim(id, groups);
    return NextResponse.json(claim, { status: 201 });
  } catch (e) {
    log.error("Failed to create DOA claim", e, { route: "/api/orders/[id]/doa", method: "POST" });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
