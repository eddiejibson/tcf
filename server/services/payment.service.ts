import { randomUUID } from "crypto";

const SQUARE_BASE_URL = process.env.SQUARE_ENVIRONMENT === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

export class SquareApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly category: string | null,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "SquareApiError";
  }
}

async function squareFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SQUARE_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Square-Version": "2026-01-22",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const err = data.errors?.[0];
    throw new SquareApiError(
      err?.detail || "Square API error",
      err?.code || null,
      err?.category || null,
      res.status,
    );
  }
  return data;
}

let cachedLocationId: string | null = null;

export async function getLocationId(): Promise<string> {
  if (cachedLocationId) return cachedLocationId;
  const data = await squareFetch("/v2/locations");
  const location = data.locations?.[0];
  if (!location) throw new Error("No Square locations found");
  cachedLocationId = location.id;
  return location.id;
}

export async function createPaymentLink(orderId: string, totalPence: number, description: string, redirectUrl: string) {
  const locationId = await getLocationId();
  const data = await squareFetch("/v2/online-checkout/payment-links", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      quick_pay: {
        name: description,
        price_money: {
          amount: totalPence,
          currency: "GBP",
        },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: redirectUrl,
      },
      payment_note: `Order ${orderId.slice(0, 8).toUpperCase()}`,
    }),
  });

  return {
    paymentLinkId: data.payment_link.id,
    url: data.payment_link.url,
    orderId: data.related_resources?.orders?.[0]?.id,
  };
}

export async function isPaymentLinkPaid(paymentLinkId: string): Promise<boolean> {
  try {
    const data = await squareFetch(`/v2/online-checkout/payment-links/${paymentLinkId}`);
    const link = data.payment_link;
    if (!link?.order_id) return false;
    const orderData = await squareFetch(`/v2/orders/${link.order_id}`);
    return orderData.order?.state === "COMPLETED";
  } catch {
    return false;
  }
}

export async function processCardPayment(
  sourceId: string,
  totalPence: number,
  orderId: string,
  verificationToken?: string,
) {
  const locationId = await getLocationId();
  const body: Record<string, unknown> = {
    idempotency_key: randomUUID(),
    source_id: sourceId,
    amount_money: {
      amount: totalPence,
      currency: "GBP",
    },
    location_id: locationId,
    reference_id: orderId,
    note: `The Coral Farm - Order #${orderId.slice(0, 8).toUpperCase()}`,
    autocomplete: true,
  };
  // SCA / 3DS: forward the verifyBuyer token so Square treats the payment as
  // strongly authenticated and the issuer doesn't decline with
  // CARD_DECLINED_VERIFICATION_REQUIRED.
  if (verificationToken) body.verification_token = verificationToken;

  const data = await squareFetch("/v2/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    paymentId: data.payment.id,
    status: data.payment.status,
  };
}

/** Map Square error codes to a user-facing message. */
export function squareErrorMessage(err: SquareApiError): string {
  switch (err.code) {
    case "CARD_DECLINED_VERIFICATION_REQUIRED":
      return "Your bank requires extra verification for this card. Please complete the security check and try again.";
    case "CARD_DECLINED_CALL_ISSUER":
      return "Your bank declined this card. Please call your card issuer or try a different card.";
    case "CARD_DECLINED":
    case "GENERIC_DECLINE":
      return "Card was declined. Please check the details or try a different card.";
    case "CARD_EXPIRED":
      return "This card has expired. Please use a different card.";
    case "CVV_FAILURE":
      return "The card's security code (CVV) is incorrect.";
    case "INVALID_EXPIRATION":
      return "The card's expiry date is invalid.";
    case "INSUFFICIENT_FUNDS":
      return "Card has insufficient funds. Please try a different card.";
    case "ALLOWABLE_PIN_TRIES_EXCEEDED":
    case "TRANSACTION_LIMIT":
      return "This transaction exceeds your card limit. Please contact your card issuer.";
    case "PAYMENT_LIMIT_EXCEEDED":
      return "Payment exceeds the allowed limit. Please try a smaller amount or contact us.";
    case "TEMPORARY_ERROR":
      return "Square is temporarily unavailable. Please try again in a moment.";
    case "VERIFY_CVV_FAILURE":
    case "VERIFY_AVS_FAILURE":
      return "Card verification failed. Please check the card details and billing address.";
    default:
      return err.message || "Payment failed. Please try again.";
  }
}

export const BANK_DETAILS = {
  accountHolder: "THE CORAL FARM LTD",
  sortCode: "04-29-09",
  accountNumber: "48775908",
  vatNumber: "486315274",
};
