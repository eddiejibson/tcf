/**
 * Tests for the shared list parser (buildShipmentFromGrid) that backs both Excel
 * and PDF uploads. Focuses on the PDF-driven hardening: side-by-side packing lists
 * arrive as a tall grid with repeated per-section headers, spreadsheet error
 * markers, container ("BOX") rows and totals rows interleaved with products.
 */
import { describe, it, expect } from "vitest";
import { buildShipmentFromGrid } from "@/server/services/excel-parser.service";

// Mimics one band of the CF packing-list PDF after geometric reconstruction:
// letterhead noise, a title, repeated "BOX n" + column headers per section,
// #N/A placeholders and "Total fish in this box" rows around real products.
const PACKING_GRID: unknown[][] = [
  ["", "The Coral Farm Ltd", "", ""],
  ["", "FISH PACKING LIST 38", "", ""],
  ["BOX", "1", "C-1", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"],
  ["SUR-11", "Naso lituratus", "Orange-spine Unicornfish (Small 3-7cm)", "3"],
  ["WRA-5", "Halichoeres marginatus", "Dusky/Saddled Rainbowfish", "5"],
  ["", "#N/A", "#N/A", ""],
  ["", "Total fish in this box", "", "8"],
  ["BOX", "3", "C-2", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"], // repeated header
  ["SUR-1", "Acanthurus leucosternon", "Powder Blue Tang/Surgeonfish (Small 3-7cm)", "1"],
  ["", "Total fish in this box", "", "1"],
];

describe("buildShipmentFromGrid — packing list (no prices)", () => {
  const r = buildShipmentFromGrid(PACKING_GRID, "CF-Packing list-18-June-2026.pdf");

  it("extracts only the real products, dropping headers/totals/box/#N/A rows", () => {
    expect(r.items).toHaveLength(3);
    const names = r.items.map((i) => i.name);
    expect(names).toEqual([
      "Orange-spine Unicornfish (Small 3-7cm)",
      "Dusky/Saddled Rainbowfish",
      "Powder Blue Tang/Surgeonfish (Small 3-7cm)",
    ]);
    // No junk leaked through from container/header/total/error rows.
    for (const n of names) expect(n).not.toMatch(/^(#n\/a|common name|total|c-\d|box)\b/i);
  });

  it("maps COMMON NAME→name, SCIENTIFIC NAME→latin, Qty→stock and finds no price column", () => {
    expect(r.columnMappings.name).toBe(2);
    expect(r.columnMappings.latinName).toBe(1);
    expect(r.columnMappings.stock).toBe(3);
    expect(r.columnMappings.price).toBe(-1);
    expect(r.warnings).toContain("Could not detect price column");
  });

  it("carries quantity into availableQty and pulls size/variant from the name", () => {
    const fish = r.items[0];
    expect(fish.latinName).toBe("Naso lituratus");
    expect(fish.availableQty).toBe(3);
    expect(fish.price).toBeNull();
    expect(fish.size).toBe("3-7cm");
    expect(fish.variant).toBe("S");
    expect(r.items.reduce((s, i) => s + (i.availableQty || 0), 0)).toBe(9);
  });

  it("groups products under their container as category", () => {
    // Box 1's marker sits above the detected column-header row, so its items have
    // no category; subsequent in-body container rows are picked up.
    expect(r.items[0].category).toBeNull();
    expect(r.items[2].category).toBe("BOX 3 C-2");
  });

  it("keeps error markers out of the stored original row", () => {
    const original = JSON.stringify(r.items.map((i) => i.originalRow));
    expect(original).not.toContain("#N/A");
  });

  it("reads the ship date from a natural-language filename", () => {
    expect(r.shipmentDate).toBe("2026-06-18");
  });
});

describe("buildShipmentFromGrid — price list", () => {
  const PRICE_GRID: unknown[][] = [
    ["NO", "CODE", "SCIENTIFIC NAME", "COMMON NAME", "PRICE"],
    ["1", "ANT-1", "Pseudanthias ignitus", "Flame Anthias", "2.5"],
    ["2", "ANT-2", "Pseudanthias squamipinnis", "Scalefin Anthias (Male)", "1.85"],
  ];
  const r = buildShipmentFromGrid(PRICE_GRID, "list.pdf");

  it("detects the price column and parses prices", () => {
    expect(r.items).toHaveLength(2);
    expect(r.columnMappings.price).toBe(4);
    expect(r.items[0].price).toBe(2.5);
    expect(r.items[1].price).toBe(1.85);
    expect(r.items[0].name).toBe("Flame Anthias");
    expect(r.items[1].latinName).toBe("Pseudanthias squamipinnis");
  });
});

describe("buildShipmentFromGrid — container detection guards", () => {
  it("does not mistake a fish named like a container for a box header", () => {
    const grid: unknown[][] = [
      ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "PRICE"],
      ["BF-1", "Ostracion cubicus", "Boxfish", "9.5"],
      ["CC-1", "Stenopus hispidus", "Boxer Shrimp", "4"],
    ];
    const r = buildShipmentFromGrid(grid, "x.pdf");
    expect(r.items.map((i) => i.name)).toEqual(["Boxfish", "Boxer Shrimp"]);
  });
});
