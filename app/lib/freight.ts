/**
 * Estimate freight from items with known box quantities.
 * Items with qtyPerBox <= 1 (the default/unknown) are excluded.
 */
export function estimateFreight(
  items: { quantity: number; qtyPerBox: number }[],
  freightCostPerBox: number,
): { totalBoxes: number; freight: number; hasUnknownBoxItems: boolean } {
  let boxes = 0;
  let hasUnknownBoxItems = false;

  for (const item of items) {
    if (item.quantity === 0) continue;
    if (item.qtyPerBox > 1) {
      boxes += item.quantity / item.qtyPerBox;
    } else {
      hasUnknownBoxItems = true;
    }
  }

  const totalBoxes = Math.ceil(boxes);
  const freight = totalBoxes > 0 && freightCostPerBox > 0 ? freightCostPerBox * totalBoxes : 0;

  return { totalBoxes, freight, hasUnknownBoxItems };
}
