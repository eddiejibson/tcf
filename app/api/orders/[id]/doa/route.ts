import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getOrderById } from "@/server/services/order.service";
import { createDoaClaim, getDoaClaimByOrderId } from "@/server/services/doa.service";
import { getDownloadUrl } from "@/server/services/storage.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const claim = await getDoaClaimByOrderId(id);
    if (!claim) return NextResponse.json(null);

    const itemsWithUrls = await Promise.all(
      claim.items.map(async (item) => ({
        ...item,
        imageUrls: await Promise.all((item.imageKeys || []).map((k: string) => getDownloadUrl(k))),
      }))
    );

    return NextResponse.json({ ...claim, items: itemsWithUrls });
  } catch (e) {
    console.error("GET /api/orders/[id]/doa error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PAID") return NextResponse.json({ error: "Order must be paid to report DOA" }, { status: 400 });

    const { items } = await request.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one DOA item is required" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.orderItemId || !item.quantity || !item.imageKeys?.length) {
        return NextResponse.json({ error: "Each item needs orderItemId, quantity, and at least one image" }, { status: 400 });
      }
    }

    const claim = await createDoaClaim(id, items);
    return NextResponse.json(claim, { status: 201 });
  } catch (e) {
    console.error("POST /api/orders/[id]/doa error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
