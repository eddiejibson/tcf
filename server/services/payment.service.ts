import { randomUUID } from "crypto";

const SQUARE_BASE_URL = process.env.SQUARE_ENVIRONMENT === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

async function squareFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SQUARE_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Square-Version": "2024-01-18",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.detail || "Square API error");
  return data;
}

let cachedLocationId: string | null = null;

async function getLocationId(): Promise<string> {
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

export const BANK_DETAILS = {
  accountHolder: "THE CORAL FARM LTD",
  sortCode: "04-29-09",
  accountNumber: "48775908",
  vatNumber: "486315274",
};
