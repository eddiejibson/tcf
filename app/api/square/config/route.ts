import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getLocationId } from "@/server/services/payment.service";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locationId = await getLocationId();

  return NextResponse.json({
    appId: process.env.SQUARE_APP_ID,
    locationId,
    environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
  });
}
