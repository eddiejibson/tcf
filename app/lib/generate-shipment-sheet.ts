import ExcelJS from "exceljs";

export interface ShipmentExportData {
  shipmentName: string;
  deadline: string;
  shipmentDate: string;
  freightCostPerBox: number;
  products: {
    id: string;
    name: string;
    latinName: string | null;
    variant: string | null;
    size: string | null;
    price: number;
    qtyPerBox: number;
    availableQty: number | null;
  }[];
}

// Palette — matches the invoice/app brand
const BRAND = "FF0984E3";
const DARK = "FF0D1117";
const CARD = "FF161B22";
const ROW_ALT = "FF1C2128";
const BORDER_CLR = "FF30363D";
const TEXT = "FFE6EDF3";
const TEXT_DIM = "FF8B949E";
const TEXT_MUTED = "FF484F58";
const ACCENT = "FF0984E3";
const WHITE = "FFFFFFFF";

type Fill = ExcelJS.Fill;
type Border = Partial<ExcelJS.Borders>;

const darkFill: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
const cardFill: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD } };
const altFill: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ALT } };
const brandFill: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
const hairBorder: Border = { bottom: { style: "hair", color: { argb: BORDER_CLR } } };
const thinBorder: Border = { bottom: { style: "thin", color: { argb: BORDER_CLR } } };

function applyRow(row: ExcelJS.Row, fill: Fill, border: Border, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = fill;
    cell.border = border;
  }
}

export async function generateShipmentSheet(data: ShipmentExportData): Promise<void> {
  const COLS = 11; // A-K, col K is hidden helper for box calc
  const wb = new ExcelJS.Workbook();
  wb.creator = "The Coral Farm";

  const ws = wb.addWorksheet("Order Sheet", {
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { width: 8 },   // A: Product ID (narrow, for matching only)
    { width: 36 },  // B: Name
    { width: 24 },  // C: Latin Name
    { width: 15 },  // D: Variant
    { width: 15 },  // E: Size
    { width: 11 },  // F: Price
    { width: 9 },   // G: Qty/Box
    { width: 9 },   // H: Available
    { width: 9 },   // I: Qty
    { width: 13 },  // J: Line Total
    { width: 0, hidden: true },  // K: Helper (boxes per row)
  ];

  // ─── ROW 1: BRAND BAR ───
  ws.mergeCells("A1:J1");
  const r1 = ws.getRow(1);
  r1.height = 6;
  applyRow(r1, brandFill, {}, COLS);

  // ─── ROW 2: TITLE ───
  ws.mergeCells("A2:J2");
  const r2 = ws.getRow(2);
  r2.height = 36;
  r2.getCell(1).value = "  THE CORAL FARM";
  r2.getCell(1).font = { bold: true, size: 18, color: { argb: WHITE }, name: "Calibri" };
  r2.getCell(1).alignment = { vertical: "middle" };
  applyRow(r2, darkFill, {}, COLS);

  // ─── ROW 3: SUBTITLE ───
  ws.mergeCells("A3:J3");
  const r3 = ws.getRow(3);
  r3.height = 20;
  r3.getCell(1).value = "  Order Sheet";
  r3.getCell(1).font = { size: 10, color: { argb: ACCENT }, name: "Calibri" };
  r3.getCell(1).alignment = { vertical: "middle" };
  applyRow(r3, darkFill, thinBorder, COLS);

  // ─── ROW 4: BLANK ───
  const r4 = ws.getRow(4);
  r4.height = 8;
  applyRow(r4, cardFill, {}, COLS);

  // ─── ROW 5-6: META ───
  const metaFont = (bold: boolean) => ({ size: 10, bold, color: { argb: bold ? TEXT_DIM : TEXT }, name: "Calibri" as const });

  const r5 = ws.getRow(5);
  r5.height = 20;
  r5.getCell(1).value = "  Shipment";  r5.getCell(1).font = metaFont(true);
  r5.getCell(2).value = data.shipmentName;  r5.getCell(2).font = metaFont(false);
  r5.getCell(5).value = "Deadline";  r5.getCell(5).font = metaFont(true);
  r5.getCell(6).value = data.deadline;  r5.getCell(6).font = metaFont(false);
  applyRow(r5, cardFill, {}, COLS);

  const r6 = ws.getRow(6);
  r6.height = 20;
  r6.getCell(1).value = "  Freight/Box";  r6.getCell(1).font = metaFont(true);
  r6.getCell(2).value = data.freightCostPerBox;  r6.getCell(2).font = metaFont(false);
  r6.getCell(2).numFmt = "£#,##0.00";
  r6.getCell(5).value = "Ships";  r6.getCell(5).font = metaFont(true);
  r6.getCell(6).value = data.shipmentDate;  r6.getCell(6).font = metaFont(false);
  applyRow(r6, cardFill, thinBorder, COLS);

  // ─── ROW 7: SPACER ───
  const r7 = ws.getRow(7);
  r7.height = 6;
  applyRow(r7, darkFill, {}, COLS);

  // ─── ROW 8: TABLE HEADER ───
  const headers = ["ID", "Name", "Latin Name", "Variant", "Size", "Price", "Qty/Box", "Avail", "Qty", "Total"];
  const hr = ws.addRow(headers);
  hr.height = 24;
  for (let c = 1; c <= COLS; c++) {
    const cell = hr.getCell(c);
    cell.font = { bold: true, size: 9, color: { argb: WHITE }, name: "Calibri" };
    cell.fill = brandFill;
    cell.alignment = { vertical: "middle", horizontal: c >= 6 ? "right" : "left" };
  }

  // ─── PRODUCT ROWS ───
  const firstDataRow = 9;
  data.products.forEach((p, i) => {
    const er = firstDataRow + i;
    const qtyBox = p.qtyPerBox > 1 ? p.qtyPerBox : null;
    const avail = p.availableQty !== null && p.availableQty !== undefined ? p.availableQty : null;

    const row = ws.addRow([
      p.id,
      p.name,
      p.latinName || "",
      p.variant || "",
      p.size || "",
      p.price,
      qtyBox !== null ? qtyBox : "—",
      avail !== null ? avail : "—",
      null,
      { formula: `IFERROR(IF(I${er}="","",F${er}*I${er}),"")` },
    ]);

    row.height = 22;
    const bg = i % 2 === 0 ? cardFill : altFill;
    applyRow(row, bg, hairBorder, COLS);

    // Text styling per column
    row.getCell(1).font = { size: 8, color: { argb: TEXT_MUTED }, name: "Calibri" }; // ID dim
    row.getCell(2).font = { size: 10, bold: true, color: { argb: TEXT }, name: "Calibri" }; // Name bold
    row.getCell(3).font = { size: 9, italic: true, color: { argb: TEXT_DIM }, name: "Calibri" }; // Latin italic
    row.getCell(4).font = { size: 9, color: { argb: TEXT_DIM }, name: "Calibri" }; // Variant
    row.getCell(5).font = { size: 9, color: { argb: TEXT_DIM }, name: "Calibri" }; // Size
    row.getCell(6).font = { size: 10, color: { argb: TEXT }, name: "Calibri" }; // Price
    row.getCell(6).numFmt = "£#,##0.00";
    row.getCell(6).alignment = { horizontal: "right" };
    row.getCell(7).font = { size: 9, color: { argb: TEXT_MUTED }, name: "Calibri" }; // Qty/Box
    row.getCell(7).alignment = { horizontal: "right" };
    row.getCell(8).font = { size: 9, color: { argb: TEXT_MUTED }, name: "Calibri" }; // Available
    row.getCell(8).alignment = { horizontal: "right" };

    // Qty column — the one they fill in — make it stand out
    row.getCell(9).font = { size: 11, bold: true, color: { argb: ACCENT }, name: "Calibri" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1A26" } };
    row.getCell(9).border = {
      left: { style: "thin", color: { argb: ACCENT } },
      right: { style: "thin", color: { argb: ACCENT } },
      bottom: { style: "hair", color: { argb: BORDER_CLR } },
    };

    // Line Total
    row.getCell(10).font = { size: 10, bold: true, color: { argb: ACCENT }, name: "Calibri" };
    row.getCell(10).numFmt = "£#,##0.00";
    row.getCell(10).alignment = { horizontal: "right" };

    // Hidden col K: boxes for this row = IF qty filled AND qtyPerBox is number > 1, qty/qtyPerBox, else 0
    row.getCell(11).value = { formula: `IFERROR(IF(AND(ISNUMBER(I${er}),ISNUMBER(G${er}),G${er}>1),I${er}/G${er},0),0)` } as ExcelJS.CellFormulaValue;
  });

  const lastDataRow = firstDataRow + data.products.length - 1;

  // ─── GAP ROW ───
  const gapRow = ws.addRow([]);
  gapRow.height = 10;
  applyRow(gapRow, darkFill, {}, COLS);

  // ─── SUMMARY ───
  const qtyRange = `I${firstDataRow}:I${lastDataRow}`;
  const totalRange = `J${firstDataRow}:J${lastDataRow}`;
  const qtyBoxRange = `G${firstDataRow}:G${lastDataRow}`;

  const summaryStartRow = lastDataRow + 2;

  const helperRange = `K${firstDataRow}:K${lastDataRow}`;

  const summaryDefs: { label: string; formula?: string; fmt: string; bold?: boolean; color?: string }[] = [
    { label: "Items Ordered", formula: `IFERROR(SUM(${qtyRange}),0)`, fmt: "#,##0" },
    { label: "Subtotal", formula: `IFERROR(SUM(${totalRange}),0)`, fmt: "£#,##0.00" },
    { label: "Est. Boxes", formula: `IFERROR(CEILING(SUM(${helperRange}),1),0)`, fmt: "#,##0" },
    { label: "Est. Freight", fmt: "£#,##0.00" },
    { label: "VAT (20%)", fmt: "£#,##0.00" },
    { label: "Grand Total", fmt: "£#,##0.00", bold: true, color: ACCENT },
  ];

  summaryDefs.forEach((def, i) => {
    const rowNum = summaryStartRow + i;
    const row = ws.getRow(rowNum);
    row.height = 22;
    applyRow(row, darkFill, {}, COLS);

    // Label in col I
    row.getCell(9).value = def.label;
    row.getCell(9).font = { size: 10, bold: def.bold, color: { argb: def.bold ? WHITE : TEXT_DIM }, name: "Calibri" };
    row.getCell(9).alignment = { horizontal: "right", vertical: "middle" };

    // Value in col J
    if (def.formula) {
      row.getCell(10).value = { formula: def.formula } as ExcelJS.CellFormulaValue;
    }
    row.getCell(10).numFmt = def.fmt;
    row.getCell(10).font = { size: def.bold ? 12 : 10, bold: def.bold, color: { argb: def.color || TEXT }, name: "Calibri" };
    row.getCell(10).alignment = { horizontal: "right", vertical: "middle" };

    // Grand total gets a top border
    if (def.bold) {
      row.getCell(9).border = { top: { style: "thin", color: { argb: BORDER_CLR } } };
      row.getCell(10).border = { top: { style: "thin", color: { argb: BORDER_CLR } } };
    }
  });

  // Wire up freight/VAT/total formulas (need row refs)
  const subtotalRowNum = summaryStartRow + 1;
  const boxesRowNum = summaryStartRow + 2;
  const freightRowNum = summaryStartRow + 3;
  const vatRowNum = summaryStartRow + 4;
  const grandRowNum = summaryStartRow + 5;

  ws.getCell(freightRowNum, 10).value = { formula: `IFERROR(J${boxesRowNum}*B6,0)` } as ExcelJS.CellFormulaValue;
  ws.getCell(vatRowNum, 10).value = { formula: `IFERROR((J${subtotalRowNum}+J${freightRowNum})*0.2,J${subtotalRowNum}*0.2)` } as ExcelJS.CellFormulaValue;
  ws.getCell(grandRowNum, 10).value = { formula: `IFERROR(J${subtotalRowNum}+J${freightRowNum}+J${vatRowNum},J${subtotalRowNum}*1.2)` } as ExcelJS.CellFormulaValue;

  // ─── FOOTER ───
  const footerRow = ws.getRow(grandRowNum + 2);
  ws.mergeCells(grandRowNum + 2, 1, grandRowNum + 2, COLS);
  footerRow.getCell(1).value = "  thecoralfarm.co.uk  ·  Trade Portal";
  footerRow.getCell(1).font = { size: 8, color: { argb: TEXT_MUTED }, name: "Calibri" };
  footerRow.getCell(1).alignment = { vertical: "middle" };
  applyRow(footerRow, darkFill, {}, COLS);

  // ─── WRITE TO BROWSER ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TCF-${data.shipmentName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}-Order.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── IMPORT ───
import * as XLSX from "xlsx";

export interface ParsedShipmentOrder {
  productId: string;
  name: string;
  quantity: number;
}

export function parseShipmentOrderSheet(buffer: ArrayBuffer): ParsedShipmentOrder[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  // Find the header row — look for "Name" and "Qty" together
  let headerRow = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c) => String(c || "")).join("|");
    if ((/Product ID|^ID$/i.test(rowStr)) && /\bQty\b/i.test(rowStr)) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return [];

  const headers = (data[headerRow] || []).map((h) => String(h || "").trim());
  const idCol = headers.findIndex((h) => /Product ID|^ID$/i.test(h));
  const nameCol = headers.findIndex((h) => /^Name$/i.test(h));
  // Match exactly "Qty" — not "Qty/Box", not "Total"
  let qtyCol = -1;
  for (let c = headers.length - 1; c >= 0; c--) {
    if (/^Qty$/i.test(headers[c])) { qtyCol = c; break; }
  }

  if (idCol === -1 || qtyCol === -1) return [];

  const items: ParsedShipmentOrder[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const productId = String(row[idCol] || "").trim();
    const name = nameCol !== -1 ? String(row[nameCol] || "").trim() : "";
    const rawQty = row[qtyCol];

    if (!productId || productId === "—") continue;

    const qty = typeof rawQty === "number" ? rawQty : parseInt(String(rawQty || "0"));
    if (!qty || qty <= 0) continue;

    items.push({ productId, name, quantity: qty });
  }

  return items;
}
