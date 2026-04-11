// eslint-disable-next-line @typescript-eslint/no-require-imports
const mjml2html = require("mjml");
import { getDb } from "../db/data-source";
import { Shipment } from "../entities/Shipment";
import { Product } from "../entities/Product";
import { User, UserRole } from "../entities/User";
import { sendWithRetry, from } from "./email.service";
import { log } from "../logger";

export interface ShipmentEmailData {
  shipmentName: string;
  deadline: string;
  deadlineRaw: string;
  shipmentDate: string;
  freightCost: number;
  productCount: number;
  featuredProducts: {
    name: string;
    latinName: string | null;
    variant: string | null;
    size: string | null;
    price: number;
  }[];
}

function fmtPrice(n: number): string {
  return `\u00A3${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysUntil(d: Date | string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LOGO_URL = "https://thecoralfarm.co.uk/images/logo.png";

function buildGallery(imageUrls: string[]): string {
  if (imageUrls.length === 0) return "";
  // Show up to 3 images in a row
  const imgs = imageUrls.slice(0, 3);
  const colWidth = Math.floor(100 / imgs.length) + "%";
  const columns = imgs.map((url) => `
    <mj-column width="${colWidth}" padding="4px">
      <mj-image src="${url}" alt="" border-radius="12px" padding="0" fluid-on-mobile="true" />
    </mj-column>
  `).join("");

  return `
    <mj-section background-color="#161B22" padding="0 24px 16px 24px">
      ${columns}
    </mj-section>
  `;
}

function buildProductCards(products: ShipmentEmailData["featuredProducts"]): string {
  if (products.length === 0) return "";

  // Use table-based layout for equal height cards
  const cards = products.map((p) => {
    const details = [p.variant, p.size].filter(Boolean).join(" \u00B7 ");
    return `
      <td style="width:50%;padding:6px;vertical-align:top;">
        <div style="background-color:#1E2430;border-radius:12px;padding:16px 16px 16px 16px;min-height:100px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#E6EDF3;line-height:1.3;">${esc(p.name)}</p>
          ${p.latinName ? `<p style="margin:3px 0 0;font-size:11px;color:#8B949E;font-style:italic;">${esc(p.latinName)}</p>` : ""}
          ${details ? `<p style="margin:4px 0 0;font-size:11px;color:#6E7681;">${esc(details)}</p>` : ""}
          <p style="margin:10px 0 0;font-size:16px;font-weight:700;color:#0984E3;">${fmtPrice(p.price)}</p>
        </div>
      </td>
    `;
  });

  // Build rows of 2
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(`<tr>${cards[i]}${cards[i + 1] || '<td style="width:50%;padding:6px;"></td>'}</tr>`);
  }

  return `
    <mj-section background-color="#161B22" padding="0 24px">
      <mj-column>
        <mj-text font-size="10px" color="#0984E3" font-weight="700" letter-spacing="2px" text-transform="uppercase" padding="24px 0 12px 0">Our Top Picks</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#161B22" padding="0 18px 8px 18px">
      <mj-column>
        <mj-table padding="0" cellpadding="0" cellspacing="0" width="100%">
          ${rows.join("")}
        </mj-table>
      </mj-column>
    </mj-section>
  `;
}

function renderAnnouncementMjml(data: ShipmentEmailData, intro: string, baseUrl: string, shipmentId: string, imageUrls: string[]): string {
  const gallery = buildGallery(imageUrls);
  const topPicks = buildProductCards(data.featuredProducts);

  return `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" />
          <mj-text line-height="1.5" />
          <mj-body background-color="#0D1117" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#0D1117">
        <mj-section background-color="#0984E3" padding="0"><mj-column><mj-spacer height="4px" /></mj-column></mj-section>

        <!-- Header with logo -->
        <mj-section background-color="#161B22" padding="28px 24px 20px 24px">
          <mj-column width="40px" padding="0 12px 0 0">
            <mj-image src="${LOGO_URL}" alt="TCF" width="32px" padding="0" />
          </mj-column>
          <mj-column padding="0">
            <mj-text font-size="20px" font-weight="800" color="#FFFFFF" padding="0">THE CORAL FARM</mj-text>
            <mj-text font-size="10px" color="#0984E3" padding="2px 0 0 0" letter-spacing="1.5px">TRADE PORTAL</mj-text>
          </mj-column>
        </mj-section>

        ${gallery}

        <!-- Hero -->
        <mj-section background-color="#161B22" padding="4px 24px 28px 24px">
          <mj-column>
            <mj-text font-size="24px" font-weight="700" color="#FFFFFF" padding="0" line-height="1.2">New Shipment Available</mj-text>
            <mj-text font-size="14px" color="#8B949E" padding="12px 0 0 0">${esc(intro).split(/\n\n+/).map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br>")}</p>`).join("")}</mj-text>
          </mj-column>
        </mj-section>

        <mj-section background-color="#161B22" padding="0 24px"><mj-column><mj-divider border-color="#30363D" border-width="1px" padding="0" /></mj-column></mj-section>

        <!-- Details -->
        <mj-section background-color="#161B22" padding="20px 24px">
          <mj-column width="50%">
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Shipment</mj-text>
            <mj-text font-size="15px" color="#FFFFFF" font-weight="600" padding="4px 0 14px 0">${esc(data.shipmentName)}</mj-text>
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Products</mj-text>
            <mj-text font-size="15px" color="#FFFFFF" font-weight="600" padding="4px 0 0 0">${data.productCount}</mj-text>
          </mj-column>
          <mj-column width="50%">
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Order Deadline</mj-text>
            <mj-text font-size="15px" color="#F59E0B" font-weight="600" padding="4px 0 14px 0">${esc(data.deadline)}</mj-text>
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Freight / Box</mj-text>
            <mj-text font-size="15px" color="#FFFFFF" font-weight="600" padding="4px 0 0 0">${fmtPrice(data.freightCost)}</mj-text>
          </mj-column>
        </mj-section>

        ${topPicks}

        <!-- CTA -->
        <mj-section background-color="#0D1117" padding="28px 24px">
          <mj-column>
            <mj-button background-color="#0984E3" color="#FFFFFF" font-size="15px" font-weight="600" border-radius="12px" padding="0" inner-padding="14px 36px" href="${baseUrl}/login?to=/shipments/${shipmentId}">
              View Shipment &amp; Order
            </mj-button>
            <mj-text font-size="12px" color="#484F58" padding="14px 0 0 0" align="center">Log in to the trade portal to browse all products and place your order.</mj-text>
          </mj-column>
        </mj-section>

        <mj-section background-color="#0D1117" padding="0 24px 28px 24px">
          <mj-column>
            <mj-divider border-color="#21262D" border-width="1px" padding="0 0 14px 0" />
            <mj-text font-size="11px" color="#484F58" align="center" padding="0">The Coral Farm \u00B7 Premium Marine Livestock \u00B7 thecoralfarm.co.uk</mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;
}

function renderReminderMjml(data: ShipmentEmailData, intro: string, baseUrl: string, shipmentId: string, imageUrls: string[]): string {
  const days = daysUntil(data.deadlineRaw);
  const urgency = days <= 1 ? "Final Day!" : days <= 3 ? `${days} Days Left` : `${days} Days Remaining`;
  const gallery = buildGallery(imageUrls);
  const topPicks = buildProductCards(data.featuredProducts);

  return `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" />
          <mj-text line-height="1.5" />
          <mj-body background-color="#0D1117" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#0D1117">
        <mj-section background-color="#F59E0B" padding="0"><mj-column><mj-spacer height="4px" /></mj-column></mj-section>

        <!-- Header with logo -->
        <mj-section background-color="#161B22" padding="28px 24px 20px 24px">
          <mj-column width="40px" padding="0 12px 0 0">
            <mj-image src="${LOGO_URL}" alt="TCF" width="32px" padding="0" />
          </mj-column>
          <mj-column padding="0">
            <mj-text font-size="20px" font-weight="800" color="#FFFFFF" padding="0">THE CORAL FARM</mj-text>
            <mj-text font-size="10px" color="#0984E3" padding="2px 0 0 0" letter-spacing="1.5px">TRADE PORTAL</mj-text>
          </mj-column>
        </mj-section>

        ${gallery}

        <!-- Hero -->
        <mj-section background-color="#161B22" padding="4px 24px 24px 24px">
          <mj-column>
            <mj-text font-size="12px" font-weight="700" color="#F59E0B" padding="0 0 6px 0" letter-spacing="1.5px" text-transform="uppercase">${urgency}</mj-text>
            <mj-text font-size="24px" font-weight="700" color="#FFFFFF" padding="0" line-height="1.2">Order Deadline Approaching</mj-text>
            <mj-text font-size="14px" color="#8B949E" padding="12px 0 0 0">${esc(intro).split(/\n\n+/).map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br>")}</p>`).join("")}</mj-text>
          </mj-column>
        </mj-section>

        <mj-section background-color="#161B22" padding="0 24px"><mj-column><mj-divider border-color="#30363D" border-width="1px" padding="0" /></mj-column></mj-section>

        <!-- Details -->
        <mj-section background-color="#161B22" padding="20px 24px">
          <mj-column width="50%">
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Shipment</mj-text>
            <mj-text font-size="15px" color="#FFFFFF" font-weight="600" padding="4px 0 0 0">${esc(data.shipmentName)}</mj-text>
          </mj-column>
          <mj-column width="50%">
            <mj-text font-size="10px" color="#6E7681" text-transform="uppercase" letter-spacing="1px" padding="0">Deadline</mj-text>
            <mj-text font-size="15px" color="#F59E0B" font-weight="600" padding="4px 0 0 0">${esc(data.deadline)}</mj-text>
          </mj-column>
        </mj-section>

        ${topPicks}

        <!-- CTA -->
        <mj-section background-color="#0D1117" padding="28px 24px">
          <mj-column>
            <mj-button background-color="#F59E0B" color="#000000" font-size="15px" font-weight="700" border-radius="12px" padding="0" inner-padding="14px 36px" href="${baseUrl}/login?to=/shipments/${shipmentId}">
              Place Your Order Now
            </mj-button>
            <mj-text font-size="12px" color="#484F58" padding="14px 0 0 0" align="center">Don't miss out \u2014 log in now to secure your order before the deadline.</mj-text>
          </mj-column>
        </mj-section>

        <mj-section background-color="#0D1117" padding="0 24px 28px 24px">
          <mj-column>
            <mj-divider border-color="#21262D" border-width="1px" padding="0 0 14px 0" />
            <mj-text font-size="11px" color="#484F58" align="center" padding="0">The Coral Farm \u00B7 Premium Marine Livestock \u00B7 thecoralfarm.co.uk</mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;
}

export function renderShipmentEmail(
  type: "announcement" | "deadline_reminder",
  data: ShipmentEmailData,
  intro: string,
  shipmentId: string,
  imageUrls: string[] = [],
): { html: string; subject: string } {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "https://thecoralfarm.co.uk";

  const mjmlString = type === "announcement"
    ? renderAnnouncementMjml(data, intro, baseUrl, shipmentId, imageUrls)
    : renderReminderMjml(data, intro, baseUrl, shipmentId, imageUrls);

  const { html } = mjml2html(mjmlString, { minify: true });

  const subject = type === "announcement"
    ? `New Shipment: ${data.shipmentName} \u2014 The Coral Farm`
    : `Order Deadline: ${data.shipmentName} \u2014 ${daysUntil(data.deadlineRaw)} days left`;

  return { html, subject };
}

export async function getShipmentEmailData(shipmentId: string): Promise<ShipmentEmailData & { id: string }> {
  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOneByOrFail({ id: shipmentId });
  const products = await db.getRepository(Product).find({ where: { shipmentId } });
  const featured = products.filter((p) => p.featured);

  return {
    id: shipment.id,
    shipmentName: shipment.name,
    deadline: fmtDate(shipment.deadline),
    deadlineRaw: shipment.deadline instanceof Date ? shipment.deadline.toISOString() : String(shipment.deadline),
    shipmentDate: fmtDate(shipment.shipmentDate),
    freightCost: Number(shipment.freightCost),
    productCount: products.length,
    featuredProducts: featured.map((p) => ({
      name: p.name,
      latinName: p.latinName,
      variant: p.variant,
      size: p.size,
      price: Number(p.price),
    })),
  };
}

export async function sendShipmentEmail(
  shipmentId: string,
  type: "announcement" | "deadline_reminder",
  intro: string,
  subjectOverride?: string,
  testEmails?: string[],
  imageUrls?: string[],
): Promise<{ sent: number; failed: number }> {
  const data = await getShipmentEmailData(shipmentId);
  const { html, subject } = renderShipmentEmail(type, data, intro, shipmentId, imageUrls);
  const finalSubject = subjectOverride || subject;

  let recipients: string[];
  if (testEmails && testEmails.length > 0) {
    recipients = testEmails;
  } else {
    const db = await getDb();
    const users = await db.getRepository(User).find({ where: { role: UserRole.USER } });
    recipients = users.map((u) => u.email);
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += 3) {
    const batch = recipients.slice(i, i + 3);
    const promises = batch.map((email) =>
      sendWithRetry({
        from: from(),
        to: email,
        subject: finalSubject,
        html,
        text: `${data.shipmentName} \u2014 ${intro}\n\nView shipment: ${process.env.MAGIC_LINK_BASE_URL}/login?to=/shipments/${shipmentId}`,
      })
        .then(() => { sent++; })
        .catch((e) => {
          failed++;
          log.error("Shipment email send failed", e, { meta: { email, shipmentId } });
        }),
    );
    await Promise.all(promises);
    if (i + 3 < recipients.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return { sent, failed };
}
