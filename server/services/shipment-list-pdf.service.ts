import fs from "fs";
import path from "path";
import { getDb } from "../db/data-source";
import { Shipment } from "../entities/Shipment";
import { Product } from "../entities/Product";

const BRAND: [number, number, number] = [9, 132, 227];
const DARK: [number, number, number] = [13, 17, 23];
const CARD: [number, number, number] = [22, 27, 34];
const ROW_ALT: [number, number, number] = [28, 33, 40];
const BORDER: [number, number, number] = [48, 54, 61];
const TEXT: [number, number, number] = [230, 237, 243];
const TEXT_DIM: [number, number, number] = [139, 148, 158];
const TEXT_MUTED: [number, number, number] = [110, 118, 129];
const WHITE: [number, number, number] = [255, 255, 255];

function fmtPrice(n: number): string {
  return `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function loadLogoDataUrl(): string | null {
  try {
    const logoPath = path.join(process.cwd(), "public/images/logo-invoice.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface ShipmentListPdfData {
  shipmentName: string;
  deadline: string;
  shipmentDate: string;
  freightCostPerBox: number;
  products: {
    name: string;
    latinName: string | null;
    variant: string | null;
    size: string | null;
    price: number;
    qtyPerBox: number | null;
    availableQty: number | null;
  }[];
}

export async function generateShipmentListPdfBuffer(data: ShipmentListPdfData): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pw = 297;
  const ph = 210;
  const m = 12;
  const cw = pw - m * 2;

  // Fill entire page dark
  const paintPage = () => {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pw, ph, "F");
  };
  paintPage();

  // ─── BRAND BAR ────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pw, 2.5, "F");

  // ─── HEADER BAND ──────────────────────────────────────────────────────
  doc.setFillColor(...CARD);
  doc.rect(0, 2.5, pw, 24, "F");

  const logo = loadLogoDataUrl();
  if (logo) {
    doc.addImage(logo, "PNG", m, 7, 10, 15);
  }
  const logoOffset = logo ? 14 : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text("THE CORAL FARM", m + logoOffset, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND);
  doc.text("AVAILABLE LIST", m + logoOffset, 19, { charSpace: 1.5 });

  // Right side: shipment name + deadline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(data.shipmentName, pw - m, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DIM);
  doc.text(`Deadline: ${data.deadline}  ·  Ships: ${data.shipmentDate}  ·  Freight/Box: ${fmtPrice(data.freightCostPerBox)}`, pw - m, 19, { align: "right" });

  // ─── COLUMN LAYOUT ───────────────────────────────────────────────────
  // Total content width: cw (~273mm)
  // Name+Latin: 110, Variant: 50, Size: 35, Price: 26, Qty/Box: 22, Available: 30
  const colName = m;
  const colVariant = m + 110;
  const colSize = m + 160;
  const colPrice = m + 215;     // right-aligned end
  const colQtyBox = m + 240;    // center
  const colAvail = m + 270;     // right-aligned end (or center)

  let y = 32;

  const drawTableHeader = () => {
    const headerH = 9;
    doc.setFillColor(...BRAND);
    doc.rect(m, y, cw, headerH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    const ty = y + 5.8;
    doc.text("ITEM", colName + 2, ty, { charSpace: 0.8 });
    doc.text("VARIANT", colVariant, ty, { charSpace: 0.8 });
    doc.text("SIZE", colSize, ty, { charSpace: 0.8 });
    doc.text("PRICE", colPrice, ty, { align: "right", charSpace: 0.8 });
    doc.text("QTY/BOX", colQtyBox, ty, { align: "center", charSpace: 0.8 });
    doc.text("AVAILABLE", colAvail, ty, { align: "right", charSpace: 0.8 });

    y += headerH;
  };

  drawTableHeader();

  // ─── ROWS ─────────────────────────────────────────────────────────────
  const rowH = 9;
  const bottomLimit = ph - 14;

  data.products.forEach((p, i) => {
    if (y + rowH > bottomLimit) {
      // Footer for current page
      drawFooter();
      doc.addPage();
      paintPage();
      // Header bar on continuation page
      doc.setFillColor(...BRAND);
      doc.rect(0, 0, pw, 2.5, "F");
      doc.setFillColor(...CARD);
      doc.rect(0, 2.5, pw, 14, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text("THE CORAL FARM", m, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_DIM);
      doc.text(`${data.shipmentName}  ·  Available List (continued)`, pw - m, 11, { align: "right" });
      y = 22;
      drawTableHeader();
    }

    // Row background
    doc.setFillColor(...(i % 2 === 0 ? CARD : ROW_ALT));
    doc.rect(m, y, cw, rowH, "F");

    // Hair border
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(m, y + rowH, m + cw, y + rowH);

    const ty = y + 5.5;

    // Name (bold) + Latin subline (italic dim)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const maxNameW = colVariant - colName - 4;
    let displayName = p.name;
    if (doc.getTextWidth(displayName) > maxNameW) {
      while (doc.getTextWidth(displayName + "...") > maxNameW && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += "...";
    }
    if (p.latinName) {
      doc.text(displayName, colName + 2, ty - 1);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_DIM);
      let latin = p.latinName;
      while (doc.getTextWidth(latin) > maxNameW && latin.length > 0) {
        latin = latin.slice(0, -1);
      }
      doc.text(latin, colName + 2, ty + 3);
    } else {
      doc.text(displayName, colName + 2, ty + 1);
    }

    // Variant
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DIM);
    doc.text(p.variant || "—", colVariant, ty + 1);

    // Size
    doc.text(p.size || "—", colSize, ty + 1);

    // Price (brand color, bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND);
    doc.text(fmtPrice(p.price), colPrice, ty + 1, { align: "right" });

    // Qty/Box
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(p.qtyPerBox && p.qtyPerBox > 1 ? String(p.qtyPerBox) : "—", colQtyBox, ty + 1, { align: "center" });

    // Available
    const availText = p.availableQty !== null && p.availableQty !== undefined ? String(p.availableQty) : "—";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(availText, colAvail, ty + 1, { align: "right" });

    y += rowH;
  });

  // Final footer
  drawFooter();

  function drawFooter() {
    const fy = ph - 8;
    doc.setFillColor(...BRAND);
    doc.rect(m, fy - 1, cw, 0.4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${data.products.length} products  ·  Prices exclude VAT`, m, fy + 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...BRAND);
    doc.text("thecoralfarm.co.uk", pw / 2, fy + 3, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Trade Portal", pw - m, fy + 3, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function getShipmentListPdfData(shipmentId: string): Promise<ShipmentListPdfData> {
  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOneByOrFail({ id: shipmentId });
  const products = await db.getRepository(Product).find({ where: { shipmentId } });

  return {
    shipmentName: shipment.name,
    deadline: fmtDate(shipment.deadline),
    shipmentDate: fmtDate(shipment.shipmentDate),
    freightCostPerBox: Number(shipment.freightCost),
    products: products.map((p) => ({
      name: p.name,
      latinName: p.latinName,
      variant: p.variant,
      size: p.size,
      price: Number(p.price),
      qtyPerBox: p.qtyPerBox,
      availableQty: p.availableQty,
    })),
  };
}
