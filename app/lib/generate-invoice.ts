import jsPDF from "jspdf";

export interface InvoiceItem {
  name: string;
  latinName?: string | null;
  categoryName?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  orderRef: string;
  date: string;
  status: string;
  customerEmail: string;
  customerCompanyName?: string | null;
  shipmentName: string | null;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  shipping: number;
  freight?: number;
  credit?: number;
  total: number;
  includeShipping: boolean;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}

const BRAND: [number, number, number] = [9, 132, 227];
const DARK: [number, number, number] = [26, 31, 38];
const GRAY: [number, number, number] = [120, 130, 145];
const LIGHT_BG: [number, number, number] = [246, 248, 252];
const BORDER: [number, number, number] = [225, 228, 235];
const WHITE: [number, number, number] = [255, 255, 255];

function fmtPrice(n: number): string {
  return `\u00A3${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/images/logo.png");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoice(data: InvoiceData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const m = 20;
  const cw = pw - m * 2;

  // ─── TOP ACCENT BAR ──────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pw, 5, "F");

  // Subtle secondary accent strip
  doc.setFillColor(7, 110, 190);
  doc.rect(0, 5, pw, 0.8, "F");

  // ─── LOGO ─────────────────────────────────────────────────────────────
  const logo = await loadLogoDataUrl();
  if (logo) {
    doc.addImage(logo, "PNG", m, 12, 11, 16.5);
  }

  // ─── COMPANY NAME & DETAILS ───────────────────────────────────────────
  const logoOffset = logo ? 15 : 0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...DARK);
  doc.text("THE CORAL FARM", m + logoOffset, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Premium Marine Livestock  \u00B7  Trade Portal", m + logoOffset, 23);

  doc.setFontSize(7.5);
  doc.text("VAT: 486315274", m + logoOffset, 27.5);

  // ─── INVOICE TITLE (right) ────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...BRAND);
  doc.text("INVOICE", pw - m, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(`#${data.orderRef}`, pw - m, 24, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(data.date, pw - m, 29, { align: "right" });

  // Status badge
  const statusText = data.status;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const stW = doc.getTextWidth(statusText) + 7;
  const stX = pw - m - stW;
  const stY = 33.5;

  const statusColorMap: Record<string, [number, number, number]> = {
    PAID: [16, 185, 129],
    ACCEPTED: [34, 197, 94],
    SUBMITTED: [59, 130, 246],
    REJECTED: [239, 68, 68],
    EXPIRED: [249, 115, 22],
    DRAFT: [156, 163, 175],
  };
  doc.setFillColor(...(statusColorMap[data.status] || statusColorMap.DRAFT));
  doc.roundedRect(stX, stY - 3.5, stW, 5.5, 1.5, 1.5, "F");
  doc.setTextColor(...WHITE);
  doc.text(statusText, stX + 3.5, stY + 0.3);

  // ─── SEPARATOR LINE ──────────────────────────────────────────────────
  let y = 42;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(m, y, pw - m, y);

  // ─── INFO COLUMNS ────────────────────────────────────────────────────
  y = 50;
  const col2X = m + cw / 2 + 5;

  // Bill To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND);
  const labelTracking = 1.5;
  doc.text("BILL TO", m, y, { charSpace: labelTracking });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  if (data.customerCompanyName) {
    doc.text(data.customerCompanyName, m, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(data.customerEmail, m, y + 11);
  } else {
    doc.text(data.customerEmail, m, y + 6);
  }

  // Shipment
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND);
  doc.text("SHIPMENT", col2X, y, { charSpace: labelTracking });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(data.shipmentName || "Direct Order", col2X, y + 6);

  // Payment info row
  if (data.paymentMethod) {
    const payLabel = data.paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : data.paymentMethod === "FINANCE" ? "Finance (iwocaPay)" : "Card Payment";
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Payment: ${payLabel}`, m, y + 12);
    if (data.paymentReference) {
      doc.text(`Ref: ${data.paymentReference}`, col2X, y + 12);
    }
  }

  // ─── ITEMS TABLE ──────────────────────────────────────────────────────
  y = data.paymentMethod ? 74 : 68;

  const tL = m;
  const tR = pw - m;
  const colPrice = tR - 55;
  const colQty = tR - 30;
  const colTotal = tR - 4;

  // Table header
  const headerH = 9;
  doc.setFillColor(...BRAND);
  doc.roundedRect(tL, y, cw, headerH, 2, 2, "F");

  // Cover bottom corners with a rect so only top is rounded
  doc.setFillColor(...BRAND);
  doc.rect(tL, y + headerH - 2, cw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...WHITE);
  const thY = y + 5.8;
  doc.text("ITEM", tL + 5, thY, { charSpace: 0.8 });
  doc.text("PRICE", colPrice, thY, { align: "right", charSpace: 0.8 });
  doc.text("QTY", colQty, thY, { align: "center", charSpace: 0.8 });
  doc.text("TOTAL", colTotal, thY, { align: "right", charSpace: 0.8 });

  y += headerH;

  // Table rows
  doc.setFontSize(9);

  data.items.forEach((item, i) => {
    const hasSubline = !!(item.latinName || item.categoryName);
    const rowH = hasSubline ? 12 : 8;

    // Check if we need a new page
    if (y + rowH > 240) {
      doc.addPage();
      y = 20;

      // Redraw header on new page
      doc.setFillColor(...BRAND);
      doc.rect(tL, y, cw, headerH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...WHITE);
      const newThY = y + 5.8;
      doc.text("ITEM", tL + 5, newThY, { charSpace: 0.8 });
      doc.text("PRICE", colPrice, newThY, { align: "right", charSpace: 0.8 });
      doc.text("QTY", colQty, newThY, { align: "center", charSpace: 0.8 });
      doc.text("TOTAL", colTotal, newThY, { align: "right", charSpace: 0.8 });
      y += headerH;
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(tL, y, cw, rowH, "F");
    }

    const rY = y + (hasSubline ? 4.5 : 5.3);

    // Item name
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const maxNameW = colPrice - tL - 20;
    let displayName = item.name;
    if (doc.getTextWidth(displayName) > maxNameW) {
      while (doc.getTextWidth(displayName + "...") > maxNameW && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += "...";
    }
    doc.text(displayName, tL + 5, rY);

    // Latin name / category subtitle
    if (hasSubline) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      const parts: string[] = [];
      if (item.categoryName) parts.push(item.categoryName);
      if (item.latinName) parts.push(item.latinName);
      doc.text(parts.join(" · "), tL + 5, rY + 4);
    }

    // Price
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(fmtPrice(item.unitPrice), colPrice, rY, { align: "right" });

    // Qty
    doc.setTextColor(...GRAY);
    doc.text(String(item.quantity), colQty, rY, { align: "center" });

    // Line total
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(fmtPrice(item.quantity * item.unitPrice), colTotal, rY, { align: "right" });

    y += rowH;
  });

  // Table bottom border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(tL, y, tR, y);

  // ─── TOTALS ───────────────────────────────────────────────────────────
  y += 10;
  const totLabelX = tR - 65;
  const totValueX = colTotal;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, totLabelX, y);
    doc.setTextColor(...DARK);
    doc.text(value, totValueX, y, { align: "right" });
    y += 6.5;
  };

  drawTotalRow("Subtotal", fmtPrice(data.subtotal));
  if (data.freight && data.freight > 0) {
    drawTotalRow("Freight", fmtPrice(data.freight));
  }
  if (data.includeShipping) {
    drawTotalRow("Shipping", fmtPrice(data.shipping));
  }
  drawTotalRow("VAT (20%)", fmtPrice(data.vat));
  if (data.credit && data.credit > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text("Account Credit", totLabelX, y);
    doc.text(`-${fmtPrice(data.credit)}`, totValueX, y, { align: "right" });
    y += 6.5;
  }

  // Totals separator
  y += 1;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(totLabelX, y, totValueX, y);
  y += 7;

  // Grand total highlight box
  const gtBoxX = totLabelX - 5;
  const gtBoxW = totValueX - totLabelX + 10;
  doc.setFillColor(...BRAND);
  doc.roundedRect(gtBoxX, y - 5, gtBoxW, 11, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL", totLabelX, y + 1.5);
  doc.text(fmtPrice(data.total), totValueX, y + 1.5, { align: "right" });

  // ─── BANK DETAILS SECTION ─────────────────────────────────────────────
  y += 20;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND);
  doc.text("PAYMENT DETAILS", m, y, { charSpace: labelTracking });

  y += 7;
  const bankRows = [
    ["Account Holder", "THE CORAL FARM LTD"],
    ["Sort Code", "04-29-09"],
    ["Account Number", "48775908"],
    ["Reference", `#${data.orderRef}`],
  ];

  doc.setFontSize(8);
  bankRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(`${label}:`, m, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(value, m + 38, y);
    y += 5.5;
  });

  // ─── FOOTER ───────────────────────────────────────────────────────────
  const fY = 278;

  // Footer accent line
  doc.setFillColor(...BRAND);
  doc.rect(m, fY - 2, cw, 0.5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("Thank you for your business!", pw / 2, fY + 4, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND);
  doc.text("THE CORAL FARM", pw / 2, fY + 9, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text("thecoralfarm.co.uk  \u00B7  Trade Portal", pw / 2, fY + 13, { align: "center" });

  // ─── SAVE ─────────────────────────────────────────────────────────────
  doc.save(`TCF-Invoice-${data.orderRef}.pdf`);
}
