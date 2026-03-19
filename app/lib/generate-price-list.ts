import jsPDF from "jspdf";

export interface PriceListProduct {
  name: string;
  price: number;
  type: string;
  categoryName: string;
}

const BRAND: [number, number, number] = [9, 132, 227];
const DARK: [number, number, number] = [26, 31, 38];
const GRAY: [number, number, number] = [120, 130, 145];
const LIGHT_BG: [number, number, number] = [246, 248, 252];
const BORDER: [number, number, number] = [225, 228, 235];
const WHITE: [number, number, number] = [255, 255, 255];

function fmtPrice(n: number): string {
  return `\u00A3${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export async function generatePriceList(products: PriceListProduct[]): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const m = 15;
  const cw = pw - m * 2;
  const tL = m;
  const tR = pw - m;
  const colType = tR - 30;
  const colPrice = tR - 4;
  const tableHeaderH = 7.5;
  const rowH = 6.8;

  let y = 0;
  let isFirstPage = true;

  // Group products by category
  const grouped: Record<string, PriceListProduct[]> = {};
  for (const p of products) {
    const cat = p.categoryName || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }
  const categoryNames = Object.keys(grouped).sort();

  const logo = await loadLogoDataUrl();

  const drawAccentBar = () => {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pw, 4.5, "F");
    doc.setFillColor(7, 110, 190);
    doc.rect(0, 4.5, pw, 0.6, "F");
  };

  const drawFooter = () => {
    const fY = 280;
    doc.setFillColor(...BRAND);
    doc.rect(m, fY - 2, cw, 0.4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text("All prices exclude VAT. Prices subject to change without notice.", pw / 2, fY + 2.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...BRAND);
    doc.text("THE CORAL FARM", pw / 2, fY + 7, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text("thecoralfarm.co.uk  \u00B7  Trade Portal", pw / 2, fY + 10.5, { align: "center" });
  };

  const drawFirstPageHeader = () => {
    drawAccentBar();

    if (logo) {
      doc.addImage(logo, "PNG", m, 10, 10, 15);
    }

    const logoOff = logo ? 14 : 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...DARK);
    doc.text("THE CORAL FARM", m + logoOff, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text("Premium Marine Livestock  \u00B7  Trade Portal", m + logoOff, 21);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...BRAND);
    doc.text("PRICE LIST", pw - m, 16, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    doc.text(dateStr, pw - m, 22, { align: "right" });

    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`${products.length} active products`, pw - m, 27, { align: "right" });

    // Separator
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(m, 32, pw - m, 32);

    y = 37;
  };

  const drawContinuationHeader = () => {
    drawAccentBar();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND);
    doc.text("THE CORAL FARM", m, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("PRICE LIST (continued)", pw - m, 12, { align: "right" });

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(m, 15, pw - m, 15);

    y = 19;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > 272) {
      drawFooter();
      doc.addPage();
      isFirstPage = false;
      drawContinuationHeader();
    }
  };

  const drawTableHeader = () => {
    doc.setFillColor(...BRAND);
    doc.roundedRect(tL, y, cw, tableHeaderH, 1.5, 1.5, "F");
    doc.setFillColor(...BRAND);
    doc.rect(tL, y + tableHeaderH - 1.5, cw, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...WHITE);
    const thY = y + 5;
    doc.text("PRODUCT", tL + 4, thY, { charSpace: 0.8 });
    doc.text("TYPE", colType, thY, { charSpace: 0.8 });
    doc.text("PRICE", colPrice, thY, { align: "right", charSpace: 0.8 });

    y += tableHeaderH;
  };

  // ─── START DRAWING ──────────────────────────────────────────────
  drawFirstPageHeader();

  for (let ci = 0; ci < categoryNames.length; ci++) {
    const catName = categoryNames[ci];
    const catProducts = grouped[catName];

    // Need space for: category header (8) + table header (7.5) + at least 1 row (6.8)
    ensureSpace(24);

    // ─── CATEGORY HEADER ──────────────────────────────────────────
    doc.setFillColor(30, 38, 50);
    doc.roundedRect(tL, y, cw, 8, 1.5, 1.5, "F");

    // Brand accent strip on left side
    doc.setFillColor(...BRAND);
    doc.roundedRect(tL, y, 3, 8, 1.5, 0, "F");
    doc.setFillColor(...BRAND);
    doc.rect(tL + 1.5, y, 1.5, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(catName.toUpperCase(), tL + 7, y + 5.3, { charSpace: 0.4 });

    // Item count badge
    const countText = `${catProducts.length}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    const countW = doc.getTextWidth(countText) + 5;
    const countX = tR - 4 - countW;
    doc.setFillColor(...BRAND);
    doc.roundedRect(countX, y + 2, countW, 4, 2, 2, "F");
    doc.setTextColor(...WHITE);
    doc.text(countText, countX + countW / 2, y + 5, { align: "center" });

    y += 10;

    // ─── TABLE HEADER ─────────────────────────────────────────────
    drawTableHeader();

    // ─── PRODUCT ROWS ─────────────────────────────────────────────
    for (let pi = 0; pi < catProducts.length; pi++) {
      const product = catProducts[pi];

      ensureSpace(rowH + 2);
      // Re-draw table header if we just went to a new page
      if (y < 25) {
        drawTableHeader();
      }

      // Alternating row background
      if (pi % 2 === 0) {
        doc.setFillColor(...LIGHT_BG);
        doc.rect(tL, y, cw, rowH, "F");
      }

      const rY = y + 4.5;

      // Product name
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      const maxNameW = colType - tL - 8;
      let displayName = product.name;
      if (doc.getTextWidth(displayName) > maxNameW) {
        while (doc.getTextWidth(displayName + "...") > maxNameW && displayName.length > 0) {
          displayName = displayName.slice(0, -1);
        }
        displayName += "...";
      }
      doc.text(displayName, tL + 4, rY);

      // Type
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      if (product.type === "COLONY") {
        doc.setTextColor(147, 51, 234); // purple
      } else {
        doc.setTextColor(6, 182, 212); // cyan
      }
      doc.text(product.type, colType, rY);

      // Price
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND);
      doc.text(fmtPrice(Number(product.price)), colPrice, rY, { align: "right" });

      y += rowH;
    }

    // Bottom line after category
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(tL, y, tR, y);

    y += 5;
  }

  // Footer on last page
  drawFooter();

  doc.save(`TCF-Price-List-${new Date().toISOString().slice(0, 10)}.pdf`);
}
