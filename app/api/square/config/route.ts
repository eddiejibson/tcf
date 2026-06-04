import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getLocationId } from "@/server/services/payment.service";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appId = process.env.SQUARE_APP_ID;

  // The Square Web Payments SDK rejects a missing or wrong-environment
  // application ID with the opaque WebKit error "The string did not match the
  // expected pattern." Catch the misconfiguration here and return a clear
  // message instead of letting the browser SDK throw it at the buyer.
  if (!appId) {
    console.error("[square/config] SQUARE_APP_ID is not set");
    return NextResponse.json(
      { error: "Card payments are not configured. Please contact support." },
      { status: 500 },
    );
  }

  // The appId prefix is the source of truth for the environment: sandbox app
  // IDs start with "sandbox-", production app IDs start with "sq0idp-". Drive
  // the client SDK off this so the loaded SDK build always matches the appId,
  // and verify the rest of the server config agrees.
  const appEnvironment = appId.startsWith("sandbox-") ? "sandbox" : "production";
  const serverEnvironment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  if (appEnvironment !== serverEnvironment) {
    console.error(
      `[square/config] environment mismatch: SQUARE_APP_ID is a '${appEnvironment}' key but ` +
      `SQUARE_ENVIRONMENT is '${serverEnvironment}'. The app ID, access token, and ` +
      `SQUARE_ENVIRONMENT must all belong to the same Square environment.`,
    );
    return NextResponse.json(
      { error: "Card payments are misconfigured (environment mismatch). Please contact support." },
      { status: 500 },
    );
  }

  let locationId: string;
  try {
    locationId = await getLocationId();
  } catch (e) {
    // A wrong/missing access token (or one from the other environment) lands
    // here as a Square API error — surface it cleanly rather than as a 500.
    console.error("[square/config] failed to resolve location:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Card payments are temporarily unavailable. Please try again or contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    appId,
    locationId,
    environment: appEnvironment,
  });
}
