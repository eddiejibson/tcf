import * as XLSX from "xlsx";

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

export function generateShipmentSheet(data: ShipmentExportData): void {
  const wb = XLSX.utils.book_new();

  // Column layout:
  // A=Product ID, B=Name, C=Latin Name, D=Variant, E=Size, F=Price, G=Qty/Box, H=Available, I=Qty, J=Line Total
  const HEADER_ROW = 7; // 0-indexed — row 8 in Excel (1-indexed)
  const DATA_START = HEADER_ROW + 1; // row 9
  const DATA_END = DATA_START + data.products.length - 1;

  // Summary area — 2 rows below the last product
  const SUMMARY_START = DATA_END + 2;

  const rows: (string | number | null | { f: string })[][] = [
    ["THE CORAL FARM"],
    ["Order Sheet"],
    [],
    ["Shipment", data.shipmentName, null, null, "Deadline", data.deadline],
    ["Freight/Box", data.freightCostPerBox, null, null, "Ships", data.shipmentDate],
    [],
    // Spacer row — summary labels go in col F onward (will be set below)
    [],
    // Header row
    ["Product ID", "Name", "Latin Name", "Variant", "Size", "Price (£)", "Qty/Box", "Available", "Qty", "Line Total"],
  ];

  // Product rows with Line Total formula: =F(row)*I(row)
  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    const excelRow = DATA_START + i + 1; // 1-indexed
    rows.push([
      p.id,
      p.name,
      p.latinName,
      p.variant,
      p.size,
      Number(p.price),
      p.qtyPerBox,
      p.availableQty,
      null, // Qty — user fills
      { f: `IF(I${excelRow}="","",F${excelRow}*I${excelRow})` } as never,
    ]);
  }

  // Blank row
  rows.push([]);

  // Summary rows
  const firstDataExcel = DATA_START + 1;
  const lastDataExcel = DATA_END + 1;
  const qtyRange = `I${firstDataExcel}:I${lastDataExcel}`;
  const totalRange = `J${firstDataExcel}:J${lastDataExcel}`;
  const qtyPerBoxRange = `G${firstDataExcel}:G${lastDataExcel}`;

  // Items Ordered
  rows.push([null, null, null, null, null, null, null, null, "Items Ordered", { f: `SUM(${qtyRange})` } as never]);
  // Subtotal
  rows.push([null, null, null, null, null, null, null, null, "Subtotal", { f: `SUM(${totalRange})` } as never]);
  // Est. Boxes — sum of (qty / qtyPerBox) for items where qtyPerBox > 1, rounded up
  rows.push([null, null, null, null, null, null, null, null, "Est. Boxes", { f: `CEILING(SUMPRODUCT((${qtyRange}<>"")*IF(${qtyPerBoxRange}>1,${qtyRange}/${qtyPerBoxRange},0)),1)` } as never]);
  // Est. Freight — boxes × freight/box
  const boxesCell = `J${SUMMARY_START + 3 + 1}`; // the Est. Boxes row
  rows.push([null, null, null, null, null, null, null, null, "Est. Freight", { f: `${boxesCell}*B5` } as never]);
  // VAT 20%
  const subtotalCell = `J${SUMMARY_START + 2 + 1}`;
  const freightCell = `J${SUMMARY_START + 4 + 1}`;
  rows.push([null, null, null, null, null, null, null, null, "VAT (20%)", { f: `(${subtotalCell}+${freightCell})*0.2` } as never]);
  // Grand Total
  const vatCell = `J${SUMMARY_START + 5 + 1}`;
  rows.push([null, null, null, null, null, null, null, null, "Grand Total", { f: `${subtotalCell}+${freightCell}+${vatCell}` } as never]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 10 },  // A: Product ID
    { wch: 35 },  // B: Name
    { wch: 25 },  // C: Latin Name
    { wch: 16 },  // D: Variant
    { wch: 16 },  // E: Size
    { wch: 11 },  // F: Price
    { wch: 9 },   // G: Qty/Box
    { wch: 9 },   // H: Available
    { wch: 9 },   // I: Qty
    { wch: 13 },  // J: Line Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Order Sheet");

  const filename = `TCF-${data.shipmentName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}-Order.xlsx`;
  XLSX.writeFile(wb, filename);
}

export interface ParsedShipmentOrder {
  productId: string;
  name: string;
  quantity: number;
}

export function parseShipmentOrderSheet(buffer: ArrayBuffer): ParsedShipmentOrder[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  // Find the header row (contains "Product ID" and "Qty")
  let headerRow = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c) => String(c || "")).join("|");
    if (/Product ID/i.test(rowStr) && /Qty/i.test(rowStr)) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) return [];

  const headers = (data[headerRow] || []).map((h) => String(h || "").trim());
  const idCol = headers.findIndex((h) => /Product ID/i.test(h));
  const nameCol = headers.findIndex((h) => /^Name$/i.test(h));
  // "Qty" column — not "Qty/Box", not "Line Total"
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

    if (!productId) continue;

    const qty = typeof rawQty === "number" ? rawQty : parseInt(String(rawQty || "0"));
    if (!qty || qty <= 0) continue;

    items.push({ productId, name, quantity: qty });
  }

  return items;
}
