"use client";

import CustomerPicker from "@/app/components/CustomerPicker";
import ProductSearch from "@/app/components/ProductSearch";
import {
  buildOrdersFromRawData,
  parsePackingList,
  type PackingColumnMapping,
  type PackingListItem,
  type PackingListOrder,
  type PackingListResult,
} from "@/app/lib/parse-packing-list";
import type {
  AdminShipmentDetail,
  AdminShipmentDetailOrder,
  AdminShipmentDetailProduct,
  UserListItem,
} from "@/app/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  AWAITING_FULFILLMENT: "bg-orange-500/20 text-orange-400",
  ACCEPTED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
  AWAITING_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
};

const statusLabels: Record<string, string> = {
  AWAITING_FULFILLMENT: "AWAITING FULFILLMENT",
  AWAITING_PAYMENT: "AWAITING PAYMENT",
};

// --- Product matching ---

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchScore(
  packingName: string,
  product: AdminShipmentDetailProduct,
  packingSize: string | null,
): number {
  const pn = normalize(packingName);
  const prodName = normalize(product.name);

  if (pn === prodName) return 100;
  if (prodName.includes(pn) || pn.includes(prodName)) return 80;

  // Word overlap
  const pWords = new Set(pn.split(" "));
  const prodWords = new Set(prodName.split(" "));
  const overlap = [...pWords].filter((w) => prodWords.has(w)).length;
  const maxWords = Math.max(pWords.size, prodWords.size);
  let score = maxWords > 0 ? (overlap / maxWords) * 60 : 0;

  // Size bonus
  if (packingSize && product.size) {
    const ps = normalize(packingSize);
    const prods = normalize(product.size);
    if (ps === prods) score += 20;
    else if (ps.includes(prods) || prods.includes(ps)) score += 10;
  }

  return score;
}

function findBestMatch(
  item: PackingListItem,
  products: AdminShipmentDetailProduct[],
): AdminShipmentDetailProduct | null {
  let best: AdminShipmentDetailProduct | null = null;
  let bestScore = 30; // minimum threshold
  for (const p of products) {
    const s = matchScore(item.name, p, item.size);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

// Resolve a packing order's items to a productId → qty map (using the same fuzzy product
// matcher as the item-review step). Built once per packing order and reused across every
// candidate system order during order-matching.
function resolvePackingToProductQtys(
  packingOrder: PackingListOrder,
  products: AdminShipmentDetailProduct[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of packingOrder.items) {
    const product = findBestMatch(item, products);
    if (!product) continue;
    map.set(product.id, (map.get(product.id) || 0) + item.quantity);
  }
  return map;
}

// Score similarity between a packing order (pre-resolved) and a system order by
// counting overlapping product IDs and weighting each overlap by quantity proximity.
// Returns 0 when fewer than 2 products overlap — avoids coincidental single-item matches
// between unrelated customers.
function scoreOrderByItems(
  packingByProductId: Map<string, number>,
  systemOrder: AdminShipmentDetailOrder,
): number {
  const systemByProductId = new Map<string, number>();
  for (const it of systemOrder.items) {
    if (!it.productId) continue;
    systemByProductId.set(
      it.productId,
      (systemByProductId.get(it.productId) || 0) + it.quantity,
    );
  }

  let score = 0;
  let overlap = 0;
  for (const [pid, pqty] of packingByProductId) {
    const sqty = systemByProductId.get(pid);
    if (sqty === undefined) continue;
    overlap++;
    score += 10; // base bonus per overlapping product
    const min = Math.min(pqty, sqty);
    const max = Math.max(pqty, sqty);
    if (max > 0) score += 10 * (min / max); // qty-proximity bonus, 0..10
  }

  return overlap >= 2 ? score : 0;
}

// --- Review item types ---

interface ReviewItem {
  name: string;
  size: string | null;
  quantity: number;
  unitPrice: number;
  productId: string | null;
  // Per-unit cost from the packing list (e.g. supplier U/PRICE). Used as the cost basis
  // when applying a margin to items without a matching shipment product.
  unitCost: number | null;
  // Diff info
  originalQty: number | null; // null if new item
  status: "unchanged" | "qty_changed" | "new" | "removed";
}

interface OrderMapping {
  packingOrderIndex: number;
  // "existing" = match to an existing system order (systemOrderId set)
  // "new" = create a new order for a user (userId + margin set)
  // "skip" = don't process this packing order
  type: "existing" | "new" | "skip";
  systemOrderId: string;
  userId?: string;
  margin?: number; // percentage markup for new orders (defaults to shipment margin)
}

const PACKING_MAPPING_FIELDS: {
  key: keyof PackingColumnMapping;
  label: string;
}[] = [
  { key: "name", label: "Name" },
  { key: "size", label: "Size" },
  { key: "qty", label: "Quantity" },
];

type FlowStep =
  | "idle"
  | "column_mapping"
  | "mapping"
  | "reviewing"
  | "summary"
  | "done";

type OrderDecision = "queued" | "skipped";

interface ReviewedEntry {
  items: ReviewItem[];
  decision: OrderDecision;
  freightCharge: string;
  includeShipping: boolean;
  boxes: string;
}

export default function AdminShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<AdminShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Packing list flow state
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [packingOrders, setPackingOrders] = useState<PackingListOrder[]>([]);
  const [orderMappings, setOrderMappings] = useState<OrderMapping[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  // Input for the "apply margin" controls in the review step (sits separately from the
  // mapping-step margin so admin can experiment per-order without losing the original input)
  const [reviewMargin, setReviewMargin] = useState<number>(0);
  const [reviewFreight, setReviewFreight] = useState<string>("");
  const [reviewIncludeShipping, setReviewIncludeShipping] =
    useState<boolean>(false);
  // Price per box is session-sticky — persists across orders in the current packing list
  // import so admin can set it once and have every order's freight auto-compute.
  const [pricePerBox, setPricePerBox] = useState<string>("");
  // Boxes is per-order (stored on the cache entry, restored on navigation).
  const [reviewBoxes, setReviewBoxes] = useState<string>("");
  // Cache of reviewed items keyed by packingOrderIndex (stable across navigation,
  // and works for "new" mappings that have no systemOrderId yet).
  const [reviewedOrders, setReviewedOrders] = useState<
    Map<number, ReviewedEntry>
  >(new Map());
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [applyProgress, setApplyProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  // Final-review toggles (applied in handleApplyAll):
  // - sendEmails: when false, passes skipEmail on POST+PATCH so nothing is mailed to customers
  // - applyDiscount: when true, multiplies each item's unitPrice by the customer's company
  //   discount before sending (and passes skipDiscount so the backend doesn't re-apply it)
  const [sendEmails, setSendEmails] = useState<boolean>(true);
  const [applyDiscountToTotals, setApplyDiscountToTotals] = useState<boolean>(false);
  const [adminUsers, setAdminUsers] = useState<UserListItem[]>([]);

  // Column mapping state
  const [packingHeaders, setPackingHeaders] = useState<string[]>([]);
  const [packingColumnMappings, setPackingColumnMappings] =
    useState<PackingColumnMapping>({ name: 0, size: -1, qty: -1, cost: -1 });
  const [packingWarnings, setPackingWarnings] = useState<string[]>([]);
  const packingRawRowsRef = useRef<unknown[][]>([]);
  const packingSeparatorsRef = useRef<{ rowIndex: number; label: string }[]>(
    [],
  );
  const packingHeaderRowIndexRef = useRef<number>(0);

  const fetchShipment = useCallback(async () => {
    const res = await fetch(`/api/admin/shipments/${params.id}`);
    if (res.ok) setShipment(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  // Preload admin-selectable users for the "create new order" flow in the mapping step.
  // The /api/admin/users endpoint clamps limit to 100, so we paginate to collect all users —
  // otherwise newer or older customers (past index 100) don't appear in the picker.
  useEffect(() => {
    const load = async () => {
      const collected: UserListItem[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await fetch(
          `/api/admin/users?role=USER&limit=100&page=${page}`,
        );
        if (!res.ok) break;
        const data = await res.json();
        if (!data?.users?.length) break;
        collected.push(...data.users);
        if (page >= (data.totalPages ?? 1)) break;
      }
      setAdminUsers(collected);
    };
    load().catch(() => {});
  }, []);

  const handleDeleteOrder = async (orderId: string, customer: string) => {
    const ref = `#${orderId.slice(0, 8).toUpperCase()}`;
    if (
      !confirm(
        `Delete order ${ref} (${customer})? This will permanently delete its items, payments, DOA claims, and credit transactions.`,
      )
    )
      return;
    setDeletingOrderId(orderId);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchShipment();
    }
    setDeletingOrderId(null);
  };

  // Orders that can be processed (SUBMITTED or AWAITING_FULFILLMENT)
  // Matchable targets for packing-list import. Includes ACCEPTED / AWAITING_PAYMENT / PAID
  // so admin can re-apply a later-arriving packing list to an order that's already progressed.
  // DRAFT and REJECTED are excluded — those aren't valid fulfillment targets.
  const processableOrders = useMemo(
    () =>
      shipment?.orders.filter(
        (o) =>
          o.status === "SUBMITTED" ||
          o.status === "AWAITING_FULFILLMENT" ||
          o.status === "ACCEPTED" ||
          o.status === "AWAITING_PAYMENT" ||
          o.status === "PAID",
      ) || [],
    [shipment],
  );

  // Collapse adminUsers into a "one entry per company" list for the Create-New picker:
  // OWNER is the representative (or first member if no OWNER); solo users with no company
  // pass through unchanged. This makes the picker company-centric — admin selects a
  // customer group, not an individual — matching how orders are shared across company members
  // via getCompanyOrders. We still submit to the order API as a userId (the OWNER).
  const companyPickerUsers = useMemo<UserListItem[]>(() => {
    const byCompany = new Map<string, UserListItem[]>();
    const solo: UserListItem[] = [];
    for (const u of adminUsers) {
      if (!u.companyId) {
        solo.push(u);
        continue;
      }
      const arr = byCompany.get(u.companyId) || [];
      arr.push(u);
      byCompany.set(u.companyId, arr);
    }
    const reps: UserListItem[] = [];
    for (const members of byCompany.values()) {
      const owner = members.find((m) => m.companyRole === "OWNER");
      reps.push(owner || members[0]);
    }
    // Sort: companies first (by name), then solo users (by email)
    reps.sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || ""),
    );
    solo.sort((a, b) => a.email.localeCompare(b.email));
    return [...reps, ...solo];
  }, [adminUsers]);

  // Resolve each mapping's customer discount percent (used for the "apply customer discount"
  // toggle in the final summary). Existing mappings look up by userEmail against adminUsers;
  // new mappings look up by userId. Returns 0 when no match or company has no discount.
  const getMappingDiscountPct = (m: OrderMapping): number => {
    if (m.type === "new") {
      const u = adminUsers.find((x) => x.id === m.userId);
      return u?.companyDiscount || 0;
    }
    if (m.type === "existing") {
      const sys = shipment?.orders.find((o) => o.id === m.systemOrderId);
      if (!sys) return 0;
      const u = adminUsers.find((x) => x.email.toLowerCase() === sys.userEmail.toLowerCase());
      return u?.companyDiscount || 0;
    }
    return 0;
  };

  // Orders exportable for packing list (awaiting fulfillment or already accepted)
  const exportableOrders = useMemo(
    () =>
      shipment?.orders.filter((o) =>
        [
          "SUBMITTED",
          "AWAITING_FULFILLMENT",
          "ACCEPTED",
          "AWAITING_PAYMENT",
          "PAID",
        ].includes(o.status),
      ) || [],
    [shipment],
  );

  // Orders still in draft/submitted that haven't moved to fulfillment yet
  const pendingOrders = useMemo(
    () =>
      shipment?.orders.filter(
        (o) => o.status === "DRAFT" || o.status === "SUBMITTED",
      ) || [],
    [shipment],
  );

  const handleExportPackingList = () => {
    if (!shipment || exportableOrders.length === 0) return;

    // If there are pending orders, show warning first
    if (pendingOrders.length > 0 && !showExportWarning) {
      setShowExportWarning(true);
      return;
    }
    setShowExportWarning(false);
    doExportPackingList();
  };

  const doExportPackingList = async () => {
    if (!shipment) return;

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "The Coral Farm";
    const ws = wb.addWorksheet("Packing List", {
      views: [{ showGridLines: false }],
    });

    const BRAND = "FF0984E3";
    const DARK = "FF0D1117";
    const CARD = "FF161B22";
    const ALT = "FF1C2128";
    const BORDER_C = "FF30363D";
    const WHITE = "FFFFFFFF";
    const TEXT = "FFE6EDF3";
    const DIM = "FF8B949E";

    // Check if any product has a code
    const getCode = (product: (typeof shipment.products)[0] | undefined) =>
      String(
        product?.originalRow?.["Code"] ||
          product?.originalRow?.["code"] ||
          product?.originalRow?.["CODE"] ||
          "",
      ).trim();
    const hasCode = exportableOrders.some((o) =>
      o.items.some((item) => {
        const product = shipment.products.find((p) => p.id === item.productId);
        return getCode(product).length > 0;
      }),
    );

    const COLS = hasCode ? 3 : 2;

    ws.columns = hasCode
      ? [{ width: 14 }, { width: 44 }, { width: 10 }]
      : [{ width: 50 }, { width: 10 }];

    const colRef = (n: number) => String.fromCharCode(64 + n); // 1=A, 2=B, 3=C

    // Brand bar
    ws.mergeCells(`A1:${colRef(COLS)}1`);
    const r1 = ws.getRow(1);
    r1.height = 6;
    for (let c = 1; c <= COLS; c++)
      r1.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND },
      };

    // Title
    ws.mergeCells(`A2:${colRef(COLS)}2`);
    const r2 = ws.getRow(2);
    r2.height = 30;
    r2.getCell(1).value = "  THE CORAL FARM — Packing List";
    r2.getCell(1).font = {
      bold: true,
      size: 14,
      color: { argb: WHITE },
      name: "Calibri",
    };
    r2.getCell(1).alignment = { vertical: "middle" };
    for (let c = 1; c <= COLS; c++)
      r2.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: DARK },
      };

    let rowNum = 3;

    for (const order of exportableOrders) {
      const customer = order.userCompanyName || order.userEmail;

      // Spacer
      const spacer = ws.getRow(rowNum++);
      spacer.height = 14;
      for (let c = 1; c <= COLS; c++)
        spacer.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: DARK },
        };

      // Company header — big, obvious, blue underline
      ws.mergeCells(rowNum, 1, rowNum, COLS);
      const companyRow = ws.getRow(rowNum++);
      companyRow.height = 28;
      companyRow.getCell(1).value = `  ${customer} (${order.id})`;
      companyRow.getCell(1).font = {
        bold: true,
        size: 13,
        color: { argb: WHITE },
        name: "Calibri",
      };
      companyRow.getCell(1).alignment = { vertical: "middle" };
      for (let c = 1; c <= COLS; c++) {
        companyRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CARD },
        };
        companyRow.getCell(c).border = {
          bottom: { style: "medium", color: { argb: BRAND } },
        };
      }

      // Column headers
      const headers = hasCode ? ["Code", "Name", "Qty"] : ["Name", "Qty"];
      const hRow = ws.getRow(rowNum++);
      hRow.height = 18;
      headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font = {
          bold: true,
          size: 9,
          color: { argb: DIM },
          name: "Calibri",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CARD },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: h === "Qty" ? "center" : "left",
        };
      });

      // Items — NO prices.
      order.items.forEach((item, i) => {
        const product = shipment.products.find((p) => p.id === item.productId);
        const code = getCode(product);
        const variant = product?.variant || "";
        const size = product?.size || "";
        const extras = [variant, size].filter(Boolean).join(" / ");
        const displayName = extras ? `${item.name} (${extras})` : item.name;

        const row = ws.getRow(rowNum++);
        row.height = 20;
        const bg = i % 2 === 0 ? CARD : ALT;

        if (hasCode) {
          row.getCell(1).value = code;
          row.getCell(1).font = {
            size: 9,
            color: { argb: DIM },
            name: "Calibri",
          };
          row.getCell(2).value = displayName;
          row.getCell(2).font = {
            size: 10,
            color: { argb: TEXT },
            name: "Calibri",
          };
          row.getCell(3).value = item.quantity;
          row.getCell(3).font = {
            size: 11,
            bold: true,
            color: { argb: BRAND },
            name: "Calibri",
          };
          row.getCell(3).alignment = { horizontal: "center" };
        } else {
          row.getCell(1).value = displayName;
          row.getCell(1).font = {
            size: 10,
            color: { argb: TEXT },
            name: "Calibri",
          };
          row.getCell(2).value = item.quantity;
          row.getCell(2).font = {
            size: 11,
            bold: true,
            color: { argb: BRAND },
            name: "Calibri",
          };
          row.getCell(2).alignment = { horizontal: "center" };
        }

        for (let c = 1; c <= COLS; c++) {
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
          };
          row.getCell(c).border = {
            bottom: { style: "hair", color: { argb: BORDER_C } },
          };
        }
      });

      // Box limits if any (skip if 0)
      const hasMin = order.minBoxes != null && order.minBoxes > 0;
      const hasMax = order.maxBoxes != null && order.maxBoxes > 0;
      if (hasMin || hasMax) {
        const boxRow = ws.getRow(rowNum++);
        boxRow.height = 18;
        const limits = [
          hasMin ? `Min: ${order.minBoxes}` : "",
          hasMax ? `Max: ${order.maxBoxes}` : "",
        ]
          .filter(Boolean)
          .join("  |  ");
        boxRow.getCell(2).value = `Boxes: ${limits}`;
        boxRow.getCell(2).font = {
          size: 9,
          italic: true,
          color: { argb: DIM },
          name: "Calibri",
        };
        for (let c = 1; c <= COLS; c++)
          boxRow.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: DARK },
          };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shipment.name} - Packing List.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Upload handler ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shipment) return;
    setParseError(null);

    try {
      const result: PackingListResult = await parsePackingList(file);
      if (result.rawRows.length === 0) {
        setParseError("No data found in the packing list.");
        return;
      }

      // Store raw data for remapping
      packingRawRowsRef.current = result.rawRows;
      packingSeparatorsRef.current = result.separators;
      packingHeaderRowIndexRef.current = result.headerRowIndex;
      setPackingHeaders(result.headers);
      setPackingColumnMappings(result.columnMappings);
      setPackingWarnings(result.warnings);
      setPackingOrders(result.orders);

      // Go to column mapping step
      setFlowStep("column_mapping");
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse packing list",
      );
    }

    e.target.value = "";
  };

  // --- Column mapping change ---
  const handlePackingMappingChange = (
    key: keyof PackingColumnMapping,
    value: number,
  ) => {
    const newMappings = { ...packingColumnMappings, [key]: value };
    setPackingColumnMappings(newMappings);

    // Re-parse orders with new mappings
    const newOrders = buildOrdersFromRawData(
      packingRawRowsRef.current,
      newMappings,
      packingSeparatorsRef.current,
      packingHeaderRowIndexRef.current,
    );
    setPackingOrders(newOrders);
  };

  // --- Confirm columns and proceed to order mapping ---
  const confirmColumns = () => {
    if (packingOrders.length === 0) {
      setParseError("No orders could be extracted with these column mappings.");
      return;
    }

    // Track which system orders have already been matched to avoid double-mapping
    const usedSystemOrderIds = new Set<string>();

    // Precompute each packing order's product-id-to-qty map once (used by item-similarity step).
    // Supplier-authored invoices often use sheet codes (e.g. "AQUA", "RNG") that don't map to any
    // customer identifier — matching by overlapping products is the only signal left.
    const packingProductMaps = packingOrders.map((po) =>
      resolvePackingToProductQtys(po, shipment?.products || []),
    );

    const mappings: OrderMapping[] = packingOrders.map((po, i) => {
      const labelUpper = po.label.replace(/^#/, "").toUpperCase().trim();
      const labelLower = po.label.toLowerCase().trim();
      const available = processableOrders.filter(
        (o) => !usedSystemOrderIds.has(o.id),
      );

      // 1. Hex ID prefix match
      let matched = available.find(
        (o) =>
          o.id.slice(0, 8).toUpperCase() === labelUpper ||
          o.id.toUpperCase().startsWith(labelUpper),
      );

      // 2. Full email match
      if (!matched) {
        matched = available.find((o) =>
          labelLower.includes(o.userEmail.toLowerCase()),
        );
      }

      // 3. Company name exact match (case-insensitive)
      if (!matched) {
        matched = available.find(
          (o) =>
            o.userCompanyName && o.userCompanyName.toLowerCase() === labelLower,
        );
      }

      // 4. Email username partial match
      if (!matched) {
        matched = available.find((o) => {
          const username = o.userEmail.split("@")[0].toLowerCase();
          return username.length >= 3 && labelLower.includes(username);
        });
      }

      // 5. Fuzzy company name — tokenize both, 2+ word overlap = match
      if (!matched) {
        const labelWords = new Set(
          labelLower
            .replace(/[^a-z0-9]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length >= 2),
        );
        if (labelWords.size >= 2) {
          matched = available.find((o) => {
            if (!o.userCompanyName) return false;
            const companyWords = new Set(
              o.userCompanyName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, " ")
                .split(/\s+/)
                .filter((w) => w.length >= 2),
            );
            const overlap = [...labelWords].filter((w) =>
              companyWords.has(w),
            ).length;
            return overlap >= 2;
          });
        }
      }

      // 6. Item-similarity fallback — pick the order with the most overlapping products.
      // Requires ≥2 overlapping product IDs to win (see scoreOrderByItems); weighted by qty proximity.
      if (!matched) {
        let bestScore = 0;
        let bestCandidate: AdminShipmentDetailOrder | undefined;
        for (const o of available) {
          const score = scoreOrderByItems(packingProductMaps[i], o);
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = o;
          }
        }
        if (bestCandidate) matched = bestCandidate;
      }

      // 7. Positional fallback — use next available order by position
      if (!matched) {
        matched = available[0] || processableOrders[i];
      }

      const systemOrderId = matched?.id || "";
      if (systemOrderId) {
        usedSystemOrderIds.add(systemOrderId);
      }

      return {
        packingOrderIndex: i,
        type: systemOrderId ? ("existing" as const) : ("skip" as const),
        systemOrderId,
      };
    });
    setOrderMappings(mappings);
    setFlowStep("mapping");
  };

  // --- Order mapping step ---
  const updateMappingExisting = (
    packingIndex: number,
    systemOrderId: string,
  ) => {
    setOrderMappings((prev) =>
      prev.map((m) =>
        m.packingOrderIndex === packingIndex
          ? {
              ...m,
              type: systemOrderId ? "existing" : "skip",
              systemOrderId,
              userId: undefined,
              margin: undefined,
            }
          : m,
      ),
    );
  };

  const switchMappingToNew = (packingIndex: number) => {
    setOrderMappings((prev) =>
      prev.map((m) =>
        m.packingOrderIndex === packingIndex
          ? {
              ...m,
              type: "new",
              systemOrderId: "",
              userId: m.userId,
              margin: m.margin ?? Number(shipment?.margin),
            }
          : m,
      ),
    );
  };

  const switchMappingToExisting = (packingIndex: number) => {
    setOrderMappings((prev) =>
      prev.map((m) =>
        m.packingOrderIndex === packingIndex
          ? {
              ...m,
              type: m.systemOrderId ? "existing" : "skip",
              userId: undefined,
              margin: undefined,
            }
          : m,
      ),
    );
  };

  const updateMappingUser = (packingIndex: number, userId: string) => {
    setOrderMappings((prev) =>
      prev.map((m) =>
        m.packingOrderIndex === packingIndex ? { ...m, userId } : m,
      ),
    );
  };

  const updateMappingMargin = (packingIndex: number, margin: number) => {
    setOrderMappings((prev) =>
      prev.map((m) =>
        m.packingOrderIndex === packingIndex ? { ...m, margin } : m,
      ),
    );
  };

  const startReview = () => {
    const validMappings = orderMappings.filter(
      (m) =>
        (m.type === "existing" && m.systemOrderId) ||
        (m.type === "new" && m.userId),
    );
    if (validMappings.length === 0) return;
    setOrderMappings(validMappings);
    setReviewedOrders(new Map());
    setCurrentReviewIndex(0);
    buildReviewItems(validMappings[0]);
    setFlowStep("reviewing");
  };

  // Rebase a shipment price from shipment.margin onto a target margin.
  // Shipment products are already priced as cost × (1 + shipment.margin/100),
  // so recovering cost and re-applying reduces to price × (100+target) / (100+shipment).
  const rebasePriceToMargin = (price: number, targetMargin: number): number => {
    const shipMargin = Number(shipment?.margin ?? 0);
    const denom = 100 + shipMargin;
    if (denom <= 0) return price;
    return (price * (100 + targetMargin)) / denom;
  };

  // --- Build review items for a mapping ---
  const buildReviewItems = (mapping: OrderMapping) => {
    if (!shipment) return;
    const packingOrder = packingOrders[mapping.packingOrderIndex];
    if (!packingOrder) return;

    // Default the review-step margin control: use mapping.margin for new-order flows,
    // otherwise the shipment's margin (what the existing prices were computed at).
    setReviewMargin(mapping.margin ?? Number(shipment.margin));

    // Default freight/shipping: existing orders keep their current values; new orders start blank.
    // Boxes is always blank per-order (admin fills it in; freight auto-derives from ppb × boxes).
    setReviewBoxes("");
    if (mapping.type === "existing") {
      const sysOrder = shipment.orders.find(
        (o) => o.id === mapping.systemOrderId,
      );
      setReviewFreight(
        sysOrder?.freightCharge != null ? String(sysOrder.freightCharge) : "",
      );
      setReviewIncludeShipping(sysOrder?.includeShipping ?? false);
    } else {
      setReviewFreight("");
      setReviewIncludeShipping(false);
    }

    // New-order mode: no system order to diff; every packing item is "new" and prices
    // are rebased from shipment.margin to the admin-specified margin.
    if (mapping.type === "new") {
      const targetMargin = mapping.margin ?? Number(shipment.margin);
      const items: ReviewItem[] = packingOrder.items.map((pi) => {
        const product = findBestMatch(pi, shipment.products);
        const basePrice = product ? Number(product.price) : 0;
        // Price priority: product (rebased margin) → packing list cost (add margin) → 0 (manual)
        const unitPrice = product
          ? rebasePriceToMargin(basePrice, targetMargin)
          : pi.unitCost != null
            ? pi.unitCost * (1 + targetMargin / 100)
            : 0;
        return {
          name: pi.name,
          size: pi.size,
          quantity: pi.quantity,
          unitPrice,
          productId: product?.id || null,
          unitCost: pi.unitCost,
          originalQty: null,
          status: "new",
        };
      });
      setReviewItems(items);
      return;
    }

    const systemOrder = shipment.orders.find(
      (o) => o.id === mapping.systemOrderId,
    );
    if (!systemOrder) return;

    const items: ReviewItem[] = [];
    const matchedOriginalIds = new Set<string>();

    for (const pi of packingOrder.items) {
      const product = findBestMatch(pi, shipment.products);
      const productId = product?.id || null;
      const unitPrice = product ? Number(product.price) : 0;

      const originalItem = systemOrder.items.find((oi) => {
        if (productId && oi.productId === productId) return true;
        return normalize(oi.name) === normalize(pi.name);
      });

      if (originalItem) {
        matchedOriginalIds.add(originalItem.id);
        const qtyChanged = pi.quantity !== originalItem.quantity;
        items.push({
          name: pi.name,
          size: pi.size,
          quantity: pi.quantity,
          unitPrice: unitPrice || Number(originalItem.unitPrice),
          productId,
          unitCost: pi.unitCost,
          originalQty: originalItem.quantity,
          status: qtyChanged ? "qty_changed" : "unchanged",
        });
      } else {
        items.push({
          name: pi.name,
          size: pi.size,
          quantity: pi.quantity,
          unitPrice,
          productId,
          unitCost: pi.unitCost,
          originalQty: null,
          status: "new",
        });
      }
    }

    for (const oi of systemOrder.items) {
      if (!matchedOriginalIds.has(oi.id)) {
        items.push({
          name: oi.name,
          size: null,
          quantity: 0,
          unitPrice: Number(oi.unitPrice),
          productId: oi.productId,
          unitCost: null,
          originalQty: oi.quantity,
          status: "removed",
        });
      }
    }

    setReviewItems(items);
  };

  // --- Review step: edit handlers ---
  const updateReviewItem = (
    index: number,
    field: keyof ReviewItem,
    value: string | number,
  ) => {
    setReviewItems((prev) => {
      const updated = [...prev];
      if (field === "quantity")
        updated[index] = { ...updated[index], quantity: Number(value) || 0 };
      else if (field === "unitPrice")
        updated[index] = { ...updated[index], unitPrice: Number(value) || 0 };
      else if (field === "name")
        updated[index] = { ...updated[index], name: String(value) };
      return updated;
    });
  };

  const removeReviewItem = (index: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const restoreRemovedItem = (index: number) => {
    setReviewItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: updated[index].originalQty || 1,
        status: "unchanged",
      };
      return updated;
    });
  };

  const addReviewItem = () => {
    setReviewItems((prev) => [
      ...prev,
      {
        name: "",
        size: null,
        quantity: 1,
        unitPrice: 0,
        productId: null,
        unitCost: null,
        originalQty: null,
        status: "new",
      },
    ]);
  };

  // Apply a margin to item prices. Two scopes supported:
  // - "all": recomputes every item's unitPrice (strips existing margin, applies the new one)
  // - "new": only recomputes items with status === "new" (leaves existing items untouched)
  // Price basis per item: product.price rebased, OR packing-list unitCost × margin, OR skipped.
  const applyMarginToReview = (marginPercent: number, scope: "all" | "new") => {
    setReviewItems((prev) =>
      prev.map((item) => {
        if (item.status === "removed") return item;
        if (scope === "new" && item.status !== "new") return item;

        const product =
          item.productId && shipment
            ? shipment.products.find((p) => p.id === item.productId)
            : null;

        let nextPrice = item.unitPrice;
        if (product) {
          nextPrice = rebasePriceToMargin(Number(product.price), marginPercent);
        } else if (item.unitCost != null && item.unitCost > 0) {
          nextPrice = item.unitCost * (1 + marginPercent / 100);
        } else {
          return item; // no cost basis; leave as-is for admin to set manually
        }
        return { ...item, unitPrice: nextPrice };
      }),
    );
  };

  // Freight auto-compute: whenever price-per-box or boxes changes AND both are set,
  // snap reviewFreight to their product. Admin can still manually override freight after;
  // that stands until they touch ppb or boxes again.
  const recomputeFreight = (ppb: string, boxes: string) => {
    const ppbNum = parseFloat(ppb);
    const boxesNum = parseFloat(boxes);
    if (
      !isNaN(ppbNum) &&
      !isNaN(boxesNum) &&
      ppbNum > 0 &&
      boxesNum > 0
    ) {
      setReviewFreight((ppbNum * boxesNum).toFixed(2));
    } else if (ppb === "" || boxes === "") {
      // Clear derived freight only if one side has been cleared — preserves manual overrides
      // when the admin simply hasn't entered box counts yet.
      if (boxes === "") setReviewFreight("");
    }
  };

  const handlePricePerBoxChange = (value: string) => {
    setPricePerBox(value);
    recomputeFreight(value, reviewBoxes);
  };

  const handleBoxesChange = (value: string) => {
    setReviewBoxes(value);
    recomputeFreight(pricePerBox, value);
  };

  // Persist the current review's items + decision into the cache, then move position
  // (or jump to the summary). The next index's items are restored from cache (preserving
  // edits across navigation) or freshly built from the diff.
  const commitAndMove = (
    decision: OrderDecision,
    delta: number | "summary",
  ) => {
    const snapshot = new Map(reviewedOrders);
    snapshot.set(currentReviewIndex, {
      items: reviewItems,
      decision,
      freightCharge: reviewFreight,
      includeShipping: reviewIncludeShipping,
      boxes: reviewBoxes,
    });
    setReviewedOrders(snapshot);

    if (delta === "summary") {
      setFlowStep("summary");
      return;
    }
    const nextIndex = currentReviewIndex + delta;
    if (nextIndex < 0 || nextIndex >= orderMappings.length) return;

    const cached = snapshot.get(nextIndex);
    if (cached) {
      setReviewItems(cached.items);
      setReviewFreight(cached.freightCharge);
      setReviewIncludeShipping(cached.includeShipping);
      setReviewBoxes(cached.boxes);
    } else {
      buildReviewItems(orderMappings[nextIndex]);
    }
    setCurrentReviewIndex(nextIndex);
  };

  const handleQueueNext = () => {
    const isLast = currentReviewIndex >= orderMappings.length - 1;
    commitAndMove("queued", isLast ? "summary" : 1);
  };

  const handleSkipOrder = () => {
    const isLast = currentReviewIndex >= orderMappings.length - 1;
    commitAndMove("skipped", isLast ? "summary" : 1);
  };

  const handlePrevious = () => {
    if (currentReviewIndex === 0) return;
    const existing = reviewedOrders.get(currentReviewIndex);
    commitAndMove(existing?.decision ?? "queued", -1);
  };

  // Jump from summary back into a specific order for further edits.
  const jumpToReview = (index: number) => {
    if (index < 0 || index >= orderMappings.length) return;
    // Persist whichever order we're currently editing before jumping.
    if (flowStep === "reviewing") {
      const existing = reviewedOrders.get(currentReviewIndex);
      setReviewedOrders((prev) => {
        const updated = new Map(prev);
        updated.set(currentReviewIndex, {
          items: reviewItems,
          decision: existing?.decision ?? "queued",
          freightCharge: reviewFreight,
          includeShipping: reviewIncludeShipping,
          boxes: reviewBoxes,
        });
        return updated;
      });
    }
    const cached = reviewedOrders.get(index);
    if (cached) {
      setReviewItems(cached.items);
      setReviewFreight(cached.freightCharge);
      setReviewIncludeShipping(cached.includeShipping);
      setReviewBoxes(cached.boxes);
    } else {
      buildReviewItems(orderMappings[index]);
    }
    setCurrentReviewIndex(index);
    setFlowStep("reviewing");
  };

  // --- Bulk apply: first point where server-side commits (and emails) happen ---
  // Existing orders: PATCH to ACCEPTED → customer gets invoice email.
  // New orders: POST with skipEmail, then PATCH to ACCEPTED with skipEmail — silent,
  // so the admin can notify the customer explicitly later.
  const handleApplyAll = async () => {
    if (!shipment) return;
    const queued: {
      mapping: OrderMapping;
      items: ReviewItem[];
      freightCharge: number | null;
      includeShipping: boolean;
    }[] = [];
    for (let i = 0; i < orderMappings.length; i++) {
      const entry = reviewedOrders.get(i);
      if (!entry || entry.decision !== "queued") continue;
      const active = entry.items.filter(
        (it) => it.status !== "removed" && it.quantity > 0,
      );
      if (active.length === 0) continue;
      const freightNum =
        entry.freightCharge.trim() === ""
          ? null
          : parseFloat(entry.freightCharge);
      queued.push({
        mapping: orderMappings[i],
        items: active,
        freightCharge:
          freightNum != null && !isNaN(freightNum) ? freightNum : null,
        includeShipping: entry.includeShipping,
      });
    }
    if (queued.length === 0) return;

    const existingCount = queued.filter(
      (q) => q.mapping.type === "existing",
    ).length;
    const newCount = queued.length - existingCount;
    const lines = [
      `Apply ${queued.length} order${queued.length !== 1 ? "s" : ""}?`,
    ];
    if (existingCount > 0)
      lines.push(
        `• ${existingCount} existing order${existingCount !== 1 ? "s" : ""} → invoice email sent`,
      );
    if (newCount > 0)
      lines.push(
        `• ${newCount} new order${newCount !== 1 ? "s" : ""} created silently (no email)`,
      );
    if (!confirm(lines.join("\n"))) return;

    setApplying(true);
    setApplyProgress({ done: 0, total: queued.length });
    const accepted = new Set<string>();

    for (let i = 0; i < queued.length; i++) {
      const { mapping, items, freightCharge, includeShipping } = queued[i];
      // Customer discount is persisted as Order.discountPercent — the totals calculation
      // applies it at subtotal level, so unit prices go through untouched.
      const discountPct = applyDiscountToTotals ? getMappingDiscountPct(mapping) : 0;
      const payloadItems = items.map((it) => ({
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));

      try {
        let targetOrderId = mapping.systemOrderId;
        const isNewOrder = mapping.type === "new";

        if (isNewOrder) {
          if (!mapping.userId) {
            setApplyProgress({ done: i + 1, total: queued.length });
            continue;
          }
          const createRes = await fetch(`/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shipmentId: shipment.id,
              forUserId: mapping.userId,
              skipEmail: true, // always silent at DRAFT creation; notification gated by sendEmails on the PATCH
              skipDiscount: true, // admin has already set final prices; backend must not re-apply
              items: payloadItems,
            }),
          });
          if (!createRes.ok) {
            setApplyProgress({ done: i + 1, total: queued.length });
            continue;
          }
          const created = await createRes.json();
          targetOrderId = created.id;
        }

        const res = await fetch(`/api/admin/orders/${targetOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payloadItems,
            status: "ACCEPTED",
            freightCharge,
            includeShipping,
            // Persist the discount % on the order so order detail / invoice views can show
            // "N% customer discount applied" — 0 when the toggle is off, customer's company
            // discount when on. Unit prices sent above are already the post-discount values.
            discountPercent: discountPct,
            // sendEmails=false → silent for both existing and new; sendEmails=true → existing
            // orders get the normal accept/changes email, new orders still skip (DRAFT→ACCEPTED
            // via this PATCH would otherwise trigger the admin-created template).
            ...(!sendEmails || isNewOrder ? { skipEmail: true } : {}),
          }),
        });
        if (res.ok) accepted.add(targetOrderId);
      } catch {
        // Per-order failures don't halt the batch.
      }
      setApplyProgress({ done: i + 1, total: queued.length });
    }

    setAcceptedOrderIds(accepted);
    setApplying(false);
    setApplyProgress(null);
    setFlowStep("done");
    await fetchShipment();
  };

  const handleDiscardAll = () => {
    const queuedCount = Array.from(reviewedOrders.values()).filter(
      (v) => v.decision === "queued",
    ).length;
    const msg =
      queuedCount > 0
        ? `Discard ${queuedCount} queued order${queuedCount !== 1 ? "s" : ""}? Nothing will be applied and no customers will be notified.`
        : `Discard this packing list import? Nothing will be applied.`;
    if (!confirm(msg)) return;
    resetFlow();
  };

  const resetFlow = () => {
    setFlowStep("idle");
    setPackingOrders([]);
    setOrderMappings([]);
    setCurrentReviewIndex(0);
    setReviewItems([]);
    setReviewFreight("");
    setReviewIncludeShipping(false);
    setPricePerBox("");
    setReviewBoxes("");
    setReviewedOrders(new Map());
    setAcceptedOrderIds(new Set());
    setApplyProgress(null);
    setParseError(null);
    setPackingHeaders([]);
    setPackingColumnMappings({ name: 0, size: -1, qty: -1, cost: -1 });
    setPackingWarnings([]);
    packingRawRowsRef.current = [];
    packingSeparatorsRef.current = [];
  };

  // --- Current review context ---
  const currentMapping =
    flowStep === "reviewing" ? orderMappings[currentReviewIndex] : null;
  const currentPackingOrder = currentMapping
    ? packingOrders[currentMapping.packingOrderIndex]
    : null;
  const currentSystemOrder =
    currentMapping && currentMapping.type === "existing"
      ? shipment?.orders.find((o) => o.id === currentMapping.systemOrderId)
      : null;
  const currentNewOrderUser =
    currentMapping && currentMapping.type === "new"
      ? adminUsers.find((u) => u.id === currentMapping.userId)
      : null;

  // Preview items count for column mapping step
  const totalParsedItems = useMemo(
    () => packingOrders.reduce((sum, o) => sum + o.items.length, 0),
    [packingOrders],
  );

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  if (!shipment)
    return <div className="p-4 md:p-8 text-white/40">Shipment not found</div>;

  return (
    <div className="p-4 md:p-8">
      {/* Back button */}
      <button
        onClick={() => router.push("/admin/shipments")}
        className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Shipments
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {shipment.name}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-amber-400 text-sm">
              Deadline:{" "}
              {new Date(shipment.deadline).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="text-white/40 text-sm">
              Arrives:{" "}
              {new Date(shipment.shipmentDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPackingList}
            disabled={exportableOrders.length === 0}
            className="px-4 py-1.5 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-all flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Packing List
          </button>
          <Link
            href={`/admin/shipments/${shipment.id}/email`}
            className="px-4 py-1.5 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            Send Notification
          </Link>
          <Link
            href={`/shipments/${shipment.id}?admin=true`}
            className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Order
          </Link>
          <Link
            href={`/admin/shipments/${shipment.id}/edit`}
            className="px-4 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all"
          >
            Edit Shipment
          </Link>
          <span
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${statusColors[shipment.status] || "bg-white/10 text-white/60"}`}
          >
            {shipment.status}
          </span>
        </div>
      </div>

      {/* Shipment details */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">
              Freight Cost
            </p>
            <p className="text-white font-semibold">
              {formatPrice(Number(shipment.freightCost))}
            </p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">
              Margin
            </p>
            <p className="text-white font-semibold">
              {Number(shipment.margin)}%
            </p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">
              Products
            </p>
            <p className="text-white font-semibold">
              {shipment.products.length}
            </p>
          </div>
        </div>
      </div>

      {/* Top Picks */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h3 className="text-white font-semibold text-sm">Top Picks</h3>
            <span className="text-white/30 text-xs">
              ({shipment.products.filter((p) => p.featured).length} featured)
            </span>
          </div>
        </div>
        {shipment.products.filter((p) => p.featured).length === 0 && (
          <p className="text-white/30 text-xs mb-3">
            Search and add products to feature in emails and for customers.
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {shipment.products
            .filter((p) => p.featured)
            .map((p) => (
              <span
                key={p.id}
                className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-medium flex items-center gap-1.5"
              >
                {p.name}
                <button
                  onClick={async () => {
                    await fetch(
                      `/api/admin/shipments/${shipment.id}/featured`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: p.id,
                          featured: false,
                        }),
                      },
                    );
                    fetchShipment();
                  }}
                  className="text-amber-400/50 hover:text-amber-400 transition-colors"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
        </div>
        <ProductSearch
          products={shipment.products.filter((p) => !p.featured)}
          onSelect={async (p) => {
            await fetch(`/api/admin/shipments/${shipment.id}/featured`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: p.id, featured: true }),
            });
            fetchShipment();
          }}
          compact
          placeholder="Search to add top picks..."
        />
      </div>

      {/* Packing list flow */}
      {flowStep === "idle" && (
        <>
          {/* Orders list */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden mb-6">
            <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/10">
              <h3 className="text-white font-semibold">
                Orders ({shipment.orders.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {exportableOrders.length > 0 && (
                  <button
                    onClick={handleExportPackingList}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Export Packing List
                  </button>
                )}
                {processableOrders.length > 0 && (
                  <label className="px-4 py-2 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all cursor-pointer">
                    Upload Packing List
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {shipment.orders.length === 0 ? (
              <div className="p-12 text-center text-white/30">
                No orders for this shipment
              </div>
            ) : (
              <div>
                {shipment.orders.map((o) => (
                  <div
                    key={o.id}
                    className="border-b border-white/5 flex items-center hover:bg-white/5 transition-colors"
                  >
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex-1 px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-xs font-mono">
                              #{o.id.slice(0, 8).toUpperCase()}
                            </span>
                            <p className="text-white text-sm font-medium">
                              {o.userCompanyName || o.userEmail}
                            </p>
                          </div>
                          {o.userCompanyName && (
                            <p className="text-white/30 text-xs">
                              {o.userEmail}
                            </p>
                          )}
                          <p className="text-white/40 text-xs mt-0.5">
                            {o.itemCount} items - {formatPrice(o.total)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${statusColors[o.status] || "bg-white/10 text-white/60"}`}
                      >
                        {statusLabels[o.status] || o.status}
                      </span>
                    </Link>
                    <button
                      onClick={() =>
                        handleDeleteOrder(
                          o.id,
                          o.userCompanyName || o.userEmail || "no customer",
                        )
                      }
                      disabled={deletingOrderId === o.id}
                      className="mr-4 md:mr-6 p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete order"
                    >
                      {deletingOrderId === o.id ? (
                        <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showExportWarning && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[16px] p-4 mb-6">
              <p className="text-amber-400 text-sm font-medium mb-2">
                There {pendingOrders.length === 1 ? "is" : "are"}{" "}
                {pendingOrders.length} order
                {pendingOrders.length !== 1 ? "s" : ""} still in{" "}
                {pendingOrders
                  .map((o) => o.status)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join("/")}{" "}
                status.
              </p>
              <p className="text-amber-400/60 text-xs mb-3">
                These orders won&apos;t be included in the export. Are you sure
                you want to continue?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowExportWarning(false);
                    doExportPackingList();
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-medium rounded-lg transition-all"
                >
                  Export Anyway
                </button>
                <button
                  onClick={() => setShowExportWarning(false)}
                  className="px-3 py-1.5 text-white/40 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {parseError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[16px] p-4 mb-6">
              <p className="text-red-400 text-sm">{parseError}</p>
            </div>
          )}
        </>
      )}

      {/* Column mapping step */}
      {flowStep === "column_mapping" && (
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-white font-semibold">
                  Review Column Mappings
                </h3>
                <p className="text-white/50 text-sm mt-1">
                  Verify which columns contain the product name, size, and
                  quantity
                </p>
              </div>
              <button
                onClick={resetFlow}
                className="text-white/50 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>

            {packingWarnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                {packingWarnings.map((w, i) => (
                  <p key={i} className="text-amber-400/80 text-xs">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Column mapping dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {PACKING_MAPPING_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">
                    {label}
                  </label>
                  <select
                    value={packingColumnMappings[key]}
                    onChange={(e) =>
                      handlePackingMappingChange(key, parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[#0984E3]/50 appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                    }}
                  >
                    <option value={-1} className="bg-[#1a1f26] text-white/50">
                      Not mapped
                    </option>
                    {packingHeaders.map((h, i) =>
                      h ? (
                        <option
                          key={i}
                          value={i}
                          className="bg-[#1a1f26] text-white"
                        >
                          {h}
                        </option>
                      ) : null,
                    )}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview: show first few rows with current mapping */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
                <p className="text-white/50 text-xs font-medium">
                  Preview — {packingOrders.length} order
                  {packingOrders.length !== 1 ? "s" : ""} detected,{" "}
                  {totalParsedItems} items total
                </p>
              </div>

              {/* Show all detected headers as a reference row */}
              <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02] overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {packingHeaders.map((h, i) => {
                    const isMapped =
                      packingColumnMappings.name === i ||
                      packingColumnMappings.size === i ||
                      packingColumnMappings.qty === i;
                    const mappedAs =
                      packingColumnMappings.name === i
                        ? "Name"
                        : packingColumnMappings.size === i
                          ? "Size"
                          : packingColumnMappings.qty === i
                            ? "Qty"
                            : null;
                    return h ? (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${isMapped ? "bg-[#0984E3]/20 text-[#0984E3]" : "bg-white/5 text-white/30"}`}
                      >
                        {h}
                        {mappedAs ? ` → ${mappedAs}` : ""}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Show a preview of parsed items from the first order */}
              {packingOrders.length > 0 && (
                <div className="max-h-[250px] overflow-auto">
                  {packingOrders.slice(0, 3).map((order, oi) => (
                    <div key={oi}>
                      {packingOrders.length > 1 && (
                        <div className="px-4 py-1.5 bg-white/[0.03] border-b border-white/5">
                          <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                            Order: {order.label} ({order.items.length} items)
                          </p>
                        </div>
                      )}
                      {order.items.slice(0, 5).map((item, ii) => (
                        <div
                          key={ii}
                          className="px-4 py-2 border-b border-white/5 flex items-center gap-4"
                        >
                          <div className="flex-1">
                            <p className="text-white/80 text-xs truncate">
                              {item.name}
                            </p>
                          </div>
                          {item.size && (
                            <div className="w-16">
                              <p className="text-white/40 text-xs">
                                {item.size}
                              </p>
                            </div>
                          )}
                          <div className="w-12 text-right">
                            <p className="text-white/60 text-xs font-medium">
                              {item.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 5 && (
                        <div className="px-4 py-1.5 text-white/20 text-[10px]">
                          ...and {order.items.length - 5} more items
                        </div>
                      )}
                    </div>
                  ))}
                  {packingOrders.length > 3 && (
                    <div className="px-4 py-2 text-white/20 text-xs">
                      ...and {packingOrders.length - 3} more orders
                    </div>
                  )}
                </div>
              )}

              {packingOrders.length === 0 && (
                <div className="p-8 text-center text-white/30 text-sm">
                  No items detected with current column mappings. Try adjusting
                  the mappings above.
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={confirmColumns}
                disabled={packingOrders.length === 0 || totalParsedItems === 0}
                className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
              >
                Continue to Order Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order mapping step */}
      {flowStep === "mapping" && (
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-white font-semibold">
                  Map Packing List Orders
                </h3>
                <p className="text-white/50 text-sm mt-1">
                  Match to an existing order, or create a new one for a customer
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFlowStep("column_mapping")}
                  className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm transition-colors"
                >
                  Back to Columns
                </button>
                <button
                  onClick={resetFlow}
                  className="text-white/50 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {packingOrders.map((po, i) => {
                const mapping = orderMappings.find(
                  (m) => m.packingOrderIndex === i,
                );
                const mode = mapping?.type ?? "skip";
                const isNew = mode === "new";
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-3 p-4 bg-white/[0.03] rounded-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">
                          Packing List: {po.label}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {po.items.length} items
                        </p>
                      </div>
                      {/* Mode tabs */}
                      <div className="inline-flex bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => switchMappingToExisting(i)}
                          className={`px-3 py-1 rounded-md transition-colors ${!isNew ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
                        >
                          Match existing
                        </button>
                        <button
                          type="button"
                          onClick={() => switchMappingToNew(i)}
                          className={`px-3 py-1 rounded-md transition-colors ${isNew ? "bg-green-500/20 text-green-400" : "text-white/50 hover:text-white"}`}
                        >
                          Create new
                        </button>
                      </div>
                    </div>

                    {!isNew ? (
                      <select
                        value={mapping?.systemOrderId || ""}
                        onChange={(e) =>
                          updateMappingExisting(i, e.target.value)
                        }
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#1a1f26] text-white/50">
                          -- Skip this order --
                        </option>
                        {processableOrders.map((o) => (
                          <option
                            key={o.id}
                            value={o.id}
                            className="bg-[#1a1f26] text-white"
                          >
                            #{o.id.slice(0, 8).toUpperCase()} —{" "}
                            {o.userCompanyName || o.userEmail} ({o.itemCount}{" "}
                            items, {formatPrice(o.total)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                        <CustomerPicker
                          users={companyPickerUsers}
                          value={mapping?.userId || ""}
                          onChange={(id) => updateMappingUser(i, id)}
                          placeholder="Select company..."
                        />
                        <div className="flex items-center gap-2 px-3 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-white/40 text-xs">Margin</span>
                          <input
                            type="number"
                            step="0.1"
                            value={
                              mapping?.margin ?? Number(shipment?.margin ?? 0)
                            }
                            onChange={(e) =>
                              updateMappingMargin(
                                i,
                                Number(e.target.value) || 0,
                              )
                            }
                            className="w-full bg-transparent text-white text-sm text-right focus:outline-none"
                          />
                          <span className="text-white/40 text-xs">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={startReview}
                disabled={
                  !orderMappings.some(
                    (m) =>
                      (m.type === "existing" && m.systemOrderId) ||
                      (m.type === "new" && m.userId),
                  )
                }
                className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
              >
                Start Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review step */}
      {flowStep === "reviewing" &&
        currentPackingOrder &&
        (currentSystemOrder || currentNewOrderUser) && (
          <div className="space-y-6">
            {/* Preview banner — nothing is applied until the final summary step */}
            <div className="bg-[#0984E3]/10 border border-[#0984E3]/30 rounded-[16px] px-4 py-3 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-[#0984E3] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-[#0984E3] text-sm font-medium flex-1">
                Preview mode — nothing is saved or sent to customers until you
                click Apply All on the summary.
              </p>
            </div>

            {/* Progress bar */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">
                  Order {currentReviewIndex + 1} of {orderMappings.length} —{" "}
                  {currentSystemOrder ? (
                    <>
                      <span className="font-mono text-white/60">
                        #{currentSystemOrder.id.slice(0, 8).toUpperCase()}
                      </span>{" "}
                      {currentSystemOrder.userCompanyName ||
                        currentSystemOrder.userEmail}
                    </>
                  ) : currentNewOrderUser ? (
                    <>
                      <span className="text-green-400 font-medium">NEW</span>{" "}
                      {currentNewOrderUser.companyName ||
                        currentNewOrderUser.email}
                      {currentMapping?.margin != null && (
                        <span className="text-white/40 ml-2">
                          @ {currentMapping.margin}% margin
                        </span>
                      )}
                    </>
                  ) : null}
                </p>
                <button
                  onClick={handleDiscardAll}
                  className="text-white/50 hover:text-red-400 text-sm transition-colors"
                >
                  Discard
                </button>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-[#0984E3] h-1.5 rounded-full transition-all"
                  style={{
                    width: `${(currentReviewIndex / orderMappings.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Review items table */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
              <div className="p-4 md:p-6 border-b border-white/10">
                <h3 className="text-white font-semibold">
                  Review Items — Packing List &quot;{currentPackingOrder.label}
                  &quot;
                </h3>
                <p className="text-white/50 text-sm mt-1">
                  Edit items and prices. Use Previous/Next to move between
                  orders; changes are held locally.
                </p>
              </div>

              {/* Margin apply controls */}
              <div className="px-4 md:px-6 py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center gap-3">
                <span className="text-white/50 text-xs uppercase tracking-wider font-medium">
                  Apply margin
                </span>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                  <input
                    type="number"
                    step="0.1"
                    value={reviewMargin}
                    onChange={(e) =>
                      setReviewMargin(Number(e.target.value) || 0)
                    }
                    className="w-16 bg-transparent text-white text-sm text-right focus:outline-none"
                  />
                  <span className="text-white/40 text-xs">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => applyMarginToReview(reviewMargin, "all")}
                  className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] hover:bg-[#0984E3]/30 text-xs font-medium rounded-lg transition-colors"
                >
                  Apply to whole order
                </button>
                <button
                  type="button"
                  onClick={() => applyMarginToReview(reviewMargin, "new")}
                  className="px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium rounded-lg transition-colors"
                >
                  Apply to new items only
                </button>
                <span className="text-white/30 text-[11px] ml-auto">
                  EDDIE NOTE: Items without a matching product add unit cost in
                  the packing list so can be rebased.
                </span>
              </div>

              <div className="overflow-x-auto">
                {/* Column headers */}
                <div className="min-w-[600px] px-4 md:px-6 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
                  <div className="w-8"></div>
                  <div className="flex-1">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                      Item
                    </p>
                  </div>
                  <div className="w-24">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                      Price
                    </p>
                  </div>
                  <div className="w-20 text-center">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                      Original
                    </p>
                  </div>
                  <div className="w-20 text-center">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                      New Qty
                    </p>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                      Total
                    </p>
                  </div>
                  <div className="w-16"></div>
                </div>

                {/* Items */}
                <div className="max-h-[500px] overflow-auto">
                  {reviewItems.map((item, index) => {
                    const rowBg =
                      item.status === "new"
                        ? "bg-green-500/5"
                        : item.status === "removed"
                          ? "bg-red-500/5"
                          : item.status === "qty_changed"
                            ? "bg-amber-500/5"
                            : "";

                    const statusIcon =
                      item.status === "new" ? (
                        <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">
                          +
                        </span>
                      ) : item.status === "removed" ? (
                        <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">
                          -
                        </span>
                      ) : item.status === "qty_changed" ? (
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                          ~
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-white/5 text-white/20 flex items-center justify-center text-xs">
                          =
                        </span>
                      );

                    return (
                      <div
                        key={index}
                        className={`min-w-[600px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/5 ${rowBg} ${item.status === "removed" ? "opacity-50" : ""}`}
                      >
                        <div className="w-8">{statusIcon}</div>
                        <div className="flex-1">
                          {item.status === "removed" ? (
                            <p className="text-white/40 text-sm line-through">
                              {item.name}
                            </p>
                          ) : (
                            <input
                              value={item.name}
                              onChange={(e) =>
                                updateReviewItem(index, "name", e.target.value)
                              }
                              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
                            />
                          )}
                          {!item.productId && item.status !== "removed" && (
                            <p className="text-amber-400/60 text-[10px] mt-1">
                              No matching product found — set price manually
                            </p>
                          )}
                        </div>
                        <div className="w-24">
                          {item.status === "removed" ? (
                            <p className="text-white/30 text-sm tabular-nums">
                              {formatPrice(Number(item.unitPrice))}
                            </p>
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateReviewItem(
                                  index,
                                  "unitPrice",
                                  e.target.value,
                                )
                              }
                              className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.unitPrice === 0 ? "border-red-500/50" : "border-white/10"}`}
                            />
                          )}
                        </div>
                        <div className="w-20 text-center">
                          <p className="text-white/40 text-sm">
                            {item.originalQty ?? "—"}
                          </p>
                        </div>
                        <div className="w-20">
                          {item.status === "removed" ? (
                            <p className="text-white/30 text-sm text-center">
                              0
                            </p>
                          ) : (
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateReviewItem(
                                  index,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50"
                            />
                          )}
                        </div>
                        <div className="w-28 text-right">
                          <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                            {formatPrice(
                              item.quantity * Number(item.unitPrice),
                            )}
                          </p>
                        </div>
                        <div className="w-16 text-right">
                          {item.status === "removed" ? (
                            <button
                              onClick={() => restoreRemovedItem(index)}
                              className="text-green-400/60 hover:text-green-400 text-xs transition-colors"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => removeReviewItem(index)}
                              className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add item */}
              <div className="px-4 md:px-6 py-3 border-t border-white/10">
                <button
                  onClick={addReviewItem}
                  className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all"
                >
                  + Add Item
                </button>
              </div>

              {/* Totals */}
              <div className="p-4 md:p-6 border-t border-white/10">
                {(() => {
                  const activeItems = reviewItems.filter(
                    (i) => i.status !== "removed" && i.quantity > 0,
                  );
                  const subtotal = activeItems.reduce(
                    (sum, i) => sum + i.quantity * Number(i.unitPrice),
                    0,
                  );
                  const unchanged = reviewItems.filter(
                    (i) => i.status === "unchanged",
                  ).length;
                  const changed = reviewItems.filter(
                    (i) => i.status === "qty_changed",
                  ).length;
                  const newItems = reviewItems.filter(
                    (i) => i.status === "new",
                  ).length;
                  const removed = reviewItems.filter(
                    (i) => i.status === "removed",
                  ).length;
                  const freightNum = parseFloat(reviewFreight) || 0;
                  const shippingNum = reviewIncludeShipping ? 30 : 0;
                  const total = subtotal + freightNum + shippingNum;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-xs">
                        {unchanged > 0 && (
                          <span className="text-white/40">
                            {unchanged} unchanged
                          </span>
                        )}
                        {changed > 0 && (
                          <span className="text-amber-400">
                            {changed} qty changed
                          </span>
                        )}
                        {newItems > 0 && (
                          <span className="text-green-400">{newItems} new</span>
                        )}
                        {removed > 0 && (
                          <span className="text-red-400">
                            {removed} removed
                          </span>
                        )}
                      </div>
                      <div className="max-w-sm ml-auto space-y-2">
                        <div className="flex items-center justify-between text-sm text-white/60">
                          <span>Subtotal (ex VAT)</span>
                          <span className="tabular-nums">
                            {formatPrice(subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/60 gap-3">
                          <span className="flex flex-col">
                            Price per box
                            <span className="text-[10px] text-white/30">
                              Remembered for next orders
                            </span>
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={pricePerBox}
                            onChange={(e) =>
                              handlePricePerBoxChange(e.target.value)
                            }
                            placeholder="0.00"
                            className="w-28 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-[#0984E3]/50 tabular-nums"
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/60 gap-3">
                          <span className="flex flex-col">
                            Boxes
                            <span className="text-[10px] text-white/30">
                              This order only
                            </span>
                          </span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={reviewBoxes}
                            onChange={(e) => handleBoxesChange(e.target.value)}
                            placeholder="0"
                            className="w-28 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-[#0984E3]/50 tabular-nums"
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/60 gap-3">
                          <span className="flex flex-col">
                            Freight Charge
                            {(() => {
                              const ppbNum = parseFloat(pricePerBox);
                              const boxesNum = parseFloat(reviewBoxes);
                              if (
                                !isNaN(ppbNum) &&
                                !isNaN(boxesNum) &&
                                ppbNum > 0 &&
                                boxesNum > 0
                              ) {
                                return (
                                  <span className="text-[10px] text-white/30 tabular-nums">
                                    {formatPrice(ppbNum)} × {boxesNum} ={" "}
                                    {formatPrice(ppbNum * boxesNum)}
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[10px] text-white/30">
                                  Or set manually
                                </span>
                              );
                            })()}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={reviewFreight}
                            onChange={(e) => setReviewFreight(e.target.value)}
                            placeholder="0.00"
                            className="w-28 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-[#0984E3]/50 tabular-nums"
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/60">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reviewIncludeShipping}
                              onChange={(e) =>
                                setReviewIncludeShipping(e.target.checked)
                              }
                              className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
                            />
                            Shipping (£30.00)
                          </label>
                          <span className="tabular-nums">
                            {formatPrice(shippingNum)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="text-white/50 text-xs">
                            Total (ex VAT)
                          </span>
                          <span className="text-[#0984E3] font-bold text-lg tabular-nums">
                            {formatPrice(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentReviewIndex === 0}
                className="px-4 py-3 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Previous
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipOrder}
                  className="px-4 py-3 text-white/50 hover:text-white text-sm font-medium transition-colors"
                >
                  Skip This Order
                </button>
                <button
                  onClick={handleQueueNext}
                  disabled={
                    reviewItems.filter(
                      (i) => i.status !== "removed" && i.quantity > 0,
                    ).length === 0
                  }
                  className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-all flex items-center gap-1.5"
                >
                  {currentReviewIndex >= orderMappings.length - 1
                    ? "Continue to Summary"
                    : "Queue & Next"}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Summary step — review all queued/skipped orders before applying */}
      {flowStep === "summary" && (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-[16px] px-4 py-3 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-amber-400 text-sm font-medium">
                Final review — no changes have been saved yet
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                {sendEmails
                  ? "Applying will update existing orders (sends accept/changes email) and create new orders silently."
                  : "Applying will update all orders silently — no customer emails will be sent."}
              </p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
            <div className="p-4 md:p-6 border-b border-white/10">
              <h3 className="text-white font-semibold">Summary</h3>
            </div>
            <div>
              {orderMappings.map((m, i) => {
                const entry = reviewedOrders.get(i);
                const decision: OrderDecision = entry?.decision ?? "skipped";
                const items = entry?.items ?? [];
                const active = items.filter(
                  (it) => it.status !== "removed" && it.quantity > 0,
                );
                const subtotal = active.reduce(
                  (s, it) => s + it.quantity * Number(it.unitPrice),
                  0,
                );
                const entryFreight = entry?.freightCharge
                  ? parseFloat(entry.freightCharge) || 0
                  : 0;
                const entryShipping = entry?.includeShipping ? 30 : 0;
                const rowTotal = subtotal + entryFreight + entryShipping;
                const discountPct = getMappingDiscountPct(m);
                const showDiscount = applyDiscountToTotals && discountPct > 0;
                const discountedRowTotal = showDiscount
                  ? subtotal * (1 - discountPct / 100) + entryFreight + entryShipping
                  : rowTotal;
                const sysOrder =
                  m.type === "existing"
                    ? shipment.orders.find((o) => o.id === m.systemOrderId)
                    : null;
                const newUser =
                  m.type === "new"
                    ? adminUsers.find((u) => u.id === m.userId)
                    : null;
                const customerLabel = sysOrder
                  ? sysOrder.userCompanyName || sysOrder.userEmail
                  : newUser
                    ? newUser.companyName || newUser.email
                    : "—";
                const effectiveDecision: OrderDecision =
                  decision === "queued" && active.length === 0
                    ? "skipped"
                    : decision;
                return (
                  <div
                    key={i}
                    className="px-4 md:px-6 py-4 border-b border-white/5 flex items-center gap-4"
                  >
                    <div className="w-24 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${effectiveDecision === "queued" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}
                      >
                        {effectiveDecision === "queued" ? "QUEUED" : "SKIPPED"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {m.type === "new" ? (
                          <span className="text-green-400 text-xs font-medium">
                            NEW
                          </span>
                        ) : sysOrder ? (
                          <span className="font-mono text-white/50 text-xs">
                            #{sysOrder.id.slice(0, 8).toUpperCase()}
                          </span>
                        ) : null}
                        <p className="text-white text-sm font-medium truncate">
                          {customerLabel}
                        </p>
                      </div>
                      <p className="text-white/40 text-xs mt-0.5">
                        {active.length} item{active.length !== 1 ? "s" : ""}
                        {m.type === "new" &&
                          m.margin != null &&
                          ` · ${m.margin}% margin`}
                      </p>
                    </div>
                    <div className="w-32 text-right">
                      {showDiscount ? (
                        <>
                          <p className="text-white/40 text-xs line-through tabular-nums">
                            {formatPrice(rowTotal)}
                          </p>
                          <p className="text-green-400 text-sm font-semibold tabular-nums">
                            {formatPrice(discountedRowTotal)}
                          </p>
                          <p className="text-green-400/60 text-[10px] tabular-nums mt-0.5">
                            −{discountPct}% discount
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                            {formatPrice(rowTotal)}
                          </p>
                          {(entryFreight > 0 || entryShipping > 0) && (
                            <p className="text-white/40 text-[10px] tabular-nums mt-0.5">
                              {formatPrice(subtotal)} +{" "}
                              {formatPrice(entryFreight + entryShipping)} fees
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => jumpToReview(i)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="p-4 md:p-6 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs text-white/50">
                {(() => {
                  let queuedCount = 0;
                  let grossTotal = 0;
                  let netTotal = 0;
                  for (let i = 0; i < orderMappings.length; i++) {
                    const e = reviewedOrders.get(i);
                    if (!e || e.decision !== "queued") continue;
                    const active = e.items.filter((it) => it.status !== "removed" && it.quantity > 0);
                    if (active.length === 0) continue;
                    queuedCount++;
                    const itemsTotal = active.reduce((s, it) => s + it.quantity * Number(it.unitPrice), 0);
                    const f = e.freightCharge ? parseFloat(e.freightCharge) || 0 : 0;
                    const sh = e.includeShipping ? 30 : 0;
                    grossTotal += itemsTotal + f + sh;
                    const dPct = applyDiscountToTotals ? getMappingDiscountPct(orderMappings[i]) : 0;
                    netTotal += (dPct > 0 ? itemsTotal * (1 - dPct / 100) : itemsTotal) + f + sh;
                  }
                  if (applyDiscountToTotals && netTotal !== grossTotal) {
                    return (
                      <span>
                        {queuedCount} queued ·{" "}
                        <span className="line-through text-white/30">{formatPrice(grossTotal)}</span>{" "}
                        <span className="text-green-400">{formatPrice(netTotal)}</span> total (ex VAT)
                      </span>
                    );
                  }
                  return <span>{queuedCount} queued · {formatPrice(grossTotal)} total (ex VAT)</span>;
                })()}
              </div>
              {applyProgress && (
                <div className="text-xs text-white/60">
                  Applying {applyProgress.done}/{applyProgress.total}...
                </div>
              )}
            </div>

            {/* Final-review toggles */}
            <div className="p-4 md:p-6 border-t border-white/10 flex flex-col gap-3 bg-white/[0.02]">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmails}
                  onChange={(e) => setSendEmails(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#0984E3] focus:ring-[#0984E3]/40 cursor-pointer"
                />
                <span className="text-sm">
                  <span className="text-white font-medium">Send automatic email</span>
                  <span className="text-white/50 block text-xs mt-0.5">
                    Existing orders get the accept/changes email on apply. Turn off to stay silent and notify manually later from each invoice.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyDiscountToTotals}
                  onChange={(e) => setApplyDiscountToTotals(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-green-400 focus:ring-green-400/40 cursor-pointer"
                />
                <span className="text-sm">
                  <span className="text-white font-medium">Apply customer discount</span>
                  <span className="text-white/50 block text-xs mt-0.5">
                    Off by default. When on, each customer&apos;s company discount is applied to their items — preview and final total update to reflect it.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => jumpToReview(orderMappings.length - 1)}
              disabled={applying}
              className="px-4 py-3 text-white/60 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-30"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Review
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDiscardAll}
                disabled={applying}
                className="px-4 py-3 text-white/50 hover:text-red-400 text-sm font-medium transition-colors disabled:opacity-30"
              >
                Discard All
              </button>
              <button
                onClick={handleApplyAll}
                disabled={
                  applying ||
                  Array.from(reviewedOrders.values()).filter(
                    (v) =>
                      v.decision === "queued" &&
                      v.items.filter(
                        (it) => it.status !== "removed" && it.quantity > 0,
                      ).length > 0,
                  ).length === 0
                }
                className="px-6 py-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:bg-white/10 disabled:text-white/30 font-medium rounded-xl transition-all"
              >
                {applying
                  ? applyProgress
                    ? `Applying ${applyProgress.done}/${applyProgress.total}...`
                    : "Applying..."
                  : "Apply All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done step */}
      {flowStep === "done" && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">
            Packing List Processed
          </h3>
          <p className="text-white/50 text-sm mb-6">
            {acceptedOrderIds.size} order
            {acceptedOrderIds.size !== 1 ? "s" : ""} accepted
          </p>
          <button
            onClick={resetFlow}
            className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl transition-all"
          >
            Back to Shipment
          </button>
        </div>
      )}
    </div>
  );
}
