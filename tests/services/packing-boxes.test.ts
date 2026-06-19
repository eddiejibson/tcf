/**
 * Box-structured PDF packing lists: extractPackingBoxes() pulls boxes + their
 * destination codes from the grid, groupBoxesIntoOrders() groups boxes (default by
 * code) into orders with duplicate products merged, and regrouping (moving a box)
 * re-derives the orders.
 */
import { describe, it, expect } from "vitest";
import {
  extractPackingBoxes,
  groupBoxesIntoOrders,
  mergePackingItems,
  defaultBoxGroupKey,
} from "@/app/lib/parse-packing-list";

// CF-style grid: letterhead, box markers with C-codes, repeated headers, a product
// whose CODE is literally "BOX-2" (a boxfish — must NOT be read as a box marker),
// a duplicate product across boxes, and a totals row.
const GRID: unknown[][] = [
  ["", "The Coral Farm Ltd", "", ""],
  ["BOX", "1", "C-1", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"],
  ["SUR-11", "Naso lituratus", "Orange-spine Unicornfish", "3"],
  ["BOX-2", "Ostracion meleagris", "Whitespotted Boxfish", "1"],
  ["", "Total fish in this box", "", "4"],
  ["BOX", "2", "C-1", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"],
  ["SUR-11", "Naso lituratus", "Orange-spine Unicornfish", "2"], // dup of box 1
  ["WRA-5", "Halichoeres marginatus", "Dusky Rainbowfish", "5"],
  ["BOX", "3", "C-2", ""],
  ["CODE", "SCIENTIFIC NAME", "COMMON NAME", "Qty"],
  ["ANG-7", "Pygoplites diacanthus", "Regal Angelfish", "4"],
];

describe("extractPackingBoxes", () => {
  const { boxes, columnMappings } = extractPackingBoxes(GRID);

  it("detects each box with its destination code, ignoring product codes that start with BOX", () => {
    expect(boxes.map((b) => b.label)).toEqual(["BOX 1", "BOX 2", "BOX 3"]);
    expect(boxes.map((b) => b.code)).toEqual(["C-1", "C-1", "C-2"]);
    // The "BOX-2" boxfish is a product inside BOX 1, not a fourth box.
    expect(boxes.some((b) => b.label === "BOX-2")).toBe(false);
    expect(boxes[0].items.map((i) => i.name)).toContain("Whitespotted Boxfish");
  });

  it("maps COMMON NAME to name and Qty to quantity, and sums to the full total", () => {
    expect(columnMappings.name).toBe(2);
    expect(columnMappings.qty).toBe(3);
    const total = boxes.reduce((s, b) => s + b.items.reduce((a, i) => a + i.quantity, 0), 0);
    expect(total).toBe(15);
  });
});

describe("groupBoxesIntoOrders (default by code)", () => {
  const { boxes } = extractPackingBoxes(GRID);
  const orders = groupBoxesIntoOrders(boxes, boxes.map(defaultBoxGroupKey));

  it("groups boxes by code and merges duplicate products across them", () => {
    expect(orders.map((o) => o.label)).toEqual(["C-1", "C-2"]);
    const c1 = orders[0];
    // BOX 1 + BOX 2 share "Orange-spine Unicornfish" → merged to 3+2 = 5.
    const orange = c1.items.find((i) => i.name === "Orange-spine Unicornfish");
    expect(orange?.quantity).toBe(5);
    expect(c1.items.reduce((s, i) => s + i.quantity, 0)).toBe(11);
    expect(orders[1].items.reduce((s, i) => s + i.quantity, 0)).toBe(4);
  });
});

describe("regrouping by moving a box", () => {
  const { boxes } = extractPackingBoxes(GRID);

  it("re-derives orders when a box's group key changes", () => {
    // Move BOX 2 (index 1) from C-1 into C-2.
    const keys = boxes.map(defaultBoxGroupKey);
    keys[1] = "C-2";
    const orders = groupBoxesIntoOrders(boxes, keys);
    expect(orders.map((o) => o.label)).toEqual(["C-1", "C-2"]);
    expect(orders[0].items.reduce((s, i) => s + i.quantity, 0)).toBe(4); // BOX 1 only
    expect(orders[1].items.reduce((s, i) => s + i.quantity, 0)).toBe(11); // BOX 3 + BOX 2
  });
});

describe("mergePackingItems", () => {
  it("sums quantities for the same name+size and keeps the first cost", () => {
    const merged = mergePackingItems([
      { name: "Clownfish", size: "S", quantity: 2, unitCost: null },
      { name: "Clownfish", size: "S", quantity: 3, unitCost: 4 },
      { name: "Clownfish", size: "M", quantity: 1, unitCost: null },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ name: "Clownfish", size: "S", quantity: 5, unitCost: 4 });
    expect(merged[1]).toMatchObject({ size: "M", quantity: 1 });
  });
});
