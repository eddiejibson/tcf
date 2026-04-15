/**
 * Estimate freight from items with known box quantities.
 * Items with null/undefined/0 qtyPerBox are excluded (unknown).
 */
export function estimateFreight(
  items: { quantity: number; qtyPerBox: number | null | undefined }[],
  freightCostPerBox: number,
): { totalBoxes: number; freight: number; hasUnknownBoxItems: boolean } {
  let boxes = 0;
  let hasUnknownBoxItems = false;

  for (const item of items) {
    if (item.quantity === 0) continue;
    if (item.qtyPerBox && item.qtyPerBox > 1) {
      boxes += item.quantity / item.qtyPerBox;
    } else {
      hasUnknownBoxItems = true;
    }
  }

  const totalBoxes = Math.ceil(boxes);
  const freight = totalBoxes > 0 && freightCostPerBox > 0 ? freightCostPerBox * totalBoxes : 0;

  return { totalBoxes, freight, hasUnknownBoxItems };
}
