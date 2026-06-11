import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/server/services/order.service";
import { audit } from "@/server/services/audit.service";
import { isUuid } from "@/server/utils";
import { handlePaymentAction } from "@/server/lib/payment-handler";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json();
  const result = await handlePaymentAction(order, body, { redirectBasePath: `/pay/${id}` });
  if (result.status < 400) {
    await audit(null, "payment.record", "order", id, { via: "quickpay", action: body.action || null, method: body.method || null, amount: body.amount ?? null });
  }
  return NextResponse.json(result.data, { status: result.status });
}
