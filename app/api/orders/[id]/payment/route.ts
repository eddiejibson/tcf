import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder, hasPermission } from "@/server/middleware/auth";
import { getOrderById, deleteOrderPayment, getOrderRemainingBalance } from "@/server/services/order.service";
import { Permission } from "@/server/lib/permissions";
import { isUuid } from "@/server/utils";
import { handlePaymentAction } from "@/server/lib/payment-handler";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(user, Permission.MANAGE_PAYMENTS)) return NextResponse.json({ error: "No permission to manage payments" }, { status: 403 });

  const body = await request.json();
  const result = await handlePaymentAction(order, body, { redirectBasePath: `/orders/${id}` });
  return NextResponse.json(result.data, { status: result.status });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(user, Permission.MANAGE_PAYMENTS)) return NextResponse.json({ error: "No permission" }, { status: 403 });

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  if (paymentId) {
    await deleteOrderPayment(paymentId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "paymentId required" }, { status: 400 });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    payments: order.payments || [],
    remainingBalance: getOrderRemainingBalance(order),
    status: order.status,
  });
}
