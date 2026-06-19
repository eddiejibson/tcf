/**
 * Tests the PDF packing-list path: pdfPackingTableRows() reduces a noisy
 * reconstructed PDF grid to just the product table, and buildPackingListResult()
 * then extracts one clean order. Without the reduction, the letterhead/footer rows
 * read as order separators and fragment the list (dropping items).
 */
import { describe, it, expect } from "vitest";
import { pdfPackingTableRows } from "@/server/services/pdf-grid.service";
import { buildPackingListResult } from "@/app/lib/parse-packing-list";

// A reconstructed CF-style packing-list grid: letterhead, title, box markers,
// repeated headers, #N/A placeholders and per-box totals interleaved with products.
const RAW_GRID: unknown[][] = [
  ["", "The Coral Farm Ltd", "", ""],
  ["", "FISH PACKING LIST 38", "", ""],
  ["", "Email: info@thecoralfarm.co.uk", "", ""],
  ["BOX", "1", "C-1", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"],
  ["SUR-11", "Naso lituratus", "Orange-spine Unicornfish (Small 3-7cm)", "3"],
  ["WRA-5", "Halichoeres marginatus", "Dusky/Saddled Rainbowfish", "5"],
  ["", "#N/A", "#N/A", ""],
  ["", "Total fish in this box", "", "8"],
  ["BOX", "2", "C-1", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"], // repeated header
  ["WRA-3", "Halichoeres leucoxanthus", "Lemon Meringue Wrasse", "4"],
  ["", "Total fish in this box", "", "4"],
  ["", "Total fish: 12", "", ""],
];

describe("pdfPackingTableRows", () => {
  const rows = pdfPackingTableRows(RAW_GRID);

  it("keeps the header plus only the rows that carry a quantity", () => {
    expect(rows).toHaveLength(4); // header + 3 products
    expect(rows[0]).toEqual(["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"]);
  });

  it("drops letterhead, box markers, repeated headers, #N/A and totals", () => {
    const flat = JSON.stringify(rows);
    expect(flat).not.toContain("Email:");
    expect(flat).not.toContain("BOX");
    expect(flat).not.toContain("#N/A");
    expect(flat).not.toContain("Total fish");
  });
});

describe("buildPackingListResult on a reduced PDF packing grid", () => {
  const r = buildPackingListResult([{ name: "CF-Packing list", data: pdfPackingTableRows(RAW_GRID) }]);

  it("produces a single order with every product (no separator fragmentation)", () => {
    expect(r.orders).toHaveLength(1);
    const items = r.orders[0].items;
    expect(items.map((i) => i.name)).toEqual([
      "Orange-spine Unicornfish (Small 3-7cm)",
      "Dusky/Saddled Rainbowfish",
      "Lemon Meringue Wrasse",
    ]);
  });

  it("carries the per-item quantities and sums to the packing-list total", () => {
    const items = r.orders[0].items;
    expect(items.map((i) => i.quantity)).toEqual([3, 5, 4]);
    expect(items.reduce((s, i) => s + i.quantity, 0)).toBe(12);
  });

  it("maps COMMON NAME to name and Qty to quantity", () => {
    expect(r.columnMappings.name).toBe(2);
    expect(r.columnMappings.qty).toBe(3);
  });
});
