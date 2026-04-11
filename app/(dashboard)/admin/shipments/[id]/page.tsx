"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductSearch from "@/app/components/ProductSearch";
import type {
  AdminShipmentDetail,
  AdminShipmentDetailProduct,
  AdminShipmentDetailOrder,
  AdminShipmentDetailOrderItem,
} from "@/app/lib/types";
import {
  parsePackingList,
  buildOrdersFromRawData,
  type PackingListOrder,
  type PackingListItem,
  type PackingColumnMapping,
  type PackingListResult,
} from "@/app/lib/parse-packing-list";
import * as XLSX from "xlsx";

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
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function matchScore(packingName: string, product: AdminShipmentDetailProduct, packingSize: string | null): number {
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

function findBestMatch(item: PackingListItem, products: AdminShipmentDetailProduct[]): AdminShipmentDetailProduct | null {
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

// --- Review item types ---

interface ReviewItem {
  name: string;
  size: string | null;
  quantity: number;
  unitPrice: number;
  productId: string | null;
  // Diff info
  originalQty: number | null; // null if new item
  status: "unchanged" | "qty_changed" | "new" | "removed";
}

interface OrderMapping {
  packingOrderIndex: number;
  systemOrderId: string;
}

const PACKING_MAPPING_FIELDS: { key: keyof PackingColumnMapping; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "size", label: "Size" },
  { key: "qty", label: "Quantity" },
];

type FlowStep = "idle" | "column_mapping" | "mapping" | "reviewing" | "done";

export default function AdminShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<AdminShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Packing list flow state
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [packingOrders, setPackingOrders] = useState<PackingListOrder[]>([]);
  const [orderMappings, setOrderMappings] = useState<OrderMapping[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);

  // Column mapping state
  const [packingHeaders, setPackingHeaders] = useState<string[]>([]);
  const [packingColumnMappings, setPackingColumnMappings] = useState<PackingColumnMapping>({ name: 0, size: -1, qty: -1 });
  const [packingWarnings, setPackingWarnings] = useState<string[]>([]);
  const packingRawRowsRef = useRef<unknown[][]>([]);
  const packingSeparatorsRef = useRef<{ rowIndex: number; label: string }[]>([]);
  const packingHeaderRowIndexRef = useRef<number>(0);

  const fetchShipment = useCallback(async () => {
    const res = await fetch(`/api/admin/shipments/${params.id}`);
    if (res.ok) setShipment(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchShipment(); }, [fetchShipment]);

  // Orders that can be processed (SUBMITTED or AWAITING_FULFILLMENT)
  const processableOrders = useMemo(() =>
    shipment?.orders.filter((o) => o.status === "SUBMITTED" || o.status === "AWAITING_FULFILLMENT") || [],
    [shipment]
  );

  // Orders exportable for packing list (awaiting fulfillment or already accepted)
  const exportableOrders = useMemo(() =>
    shipment?.orders.filter((o) => o.status === "AWAITING_FULFILLMENT" || o.status === "ACCEPTED") || [],
    [shipment]
  );

  // Orders still in draft/submitted that haven't moved to fulfillment yet
  const pendingOrders = useMemo(() =>
    shipment?.orders.filter((o) => o.status === "DRAFT" || o.status === "SUBMITTED") || [],
    [shipment]
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

  const doExportPackingList = () => {
    if (!shipment) return;

    // Build flat rows: one row per item, with order info on each row
    const rows: (string | number)[][] = [];
    let hasSize = false;
    let hasBoxLimits = false;

    // Check if any item has a size, and if any order has box limits
    for (const order of exportableOrders) {
      if (order.maxBoxes != null || order.minBoxes != null) hasBoxLimits = true;
      for (const item of order.items) {
        const product = shipment.products.find((p) => p.id === item.productId);
        if (product?.size || item.name.match(/\b(S|M|L|XL|XXL|XXXL|SM|MD|LG)\b/i)) {
          hasSize = true;
        }
      }
    }

    for (const order of exportableOrders) {
      const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
      const customer = order.userCompanyName || order.userEmail;
      for (const item of order.items) {
        const product = shipment.products.find((p) => p.id === item.productId);
        const row: (string | number)[] = [orderRef, customer, item.name];
        if (hasSize) row.push(product?.size || "");
        row.push(item.quantity);
        if (hasBoxLimits) {
          row.push(order.minBoxes != null ? order.minBoxes : "");
          row.push(order.maxBoxes != null ? order.maxBoxes : "");
        }
        rows.push(row);
      }
    }

    const xlHeaders: string[] = ["Order", "Customer", "Name"];
    if (hasSize) xlHeaders.push("Size");
    xlHeaders.push("Qty");
    if (hasBoxLimits) {
      xlHeaders.push("Min Boxes");
      xlHeaders.push("Max Boxes");
    }

    const ws = XLSX.utils.aoa_to_sheet([xlHeaders, ...rows]);
    const cols: { wch: number }[] = [
      { wch: 12 },  // Order
      { wch: 25 },  // Customer
      { wch: 30 },  // Name
    ];
    if (hasSize) cols.push({ wch: 10 }); // Size
    cols.push({ wch: 8 }); // Qty
    if (hasBoxLimits) {
      cols.push({ wch: 12 }); // Min Boxes
      cols.push({ wch: 12 }); // Max Boxes
    }
    ws["!cols"] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Packing List");
    XLSX.writeFile(wb, `${shipment.name} - Packing List.xlsx`);
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
      setParseError(err instanceof Error ? err.message : "Failed to parse packing list");
    }

    e.target.value = "";
  };

  // --- Column mapping change ---
  const handlePackingMappingChange = (key: keyof PackingColumnMapping, value: number) => {
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

    const mappings: OrderMapping[] = packingOrders.map((po, i) => {
      const labelUpper = po.label.replace(/^#/, "").toUpperCase().trim();
      const labelLower = po.label.toLowerCase().trim();
      const available = processableOrders.filter((o) => !usedSystemOrderIds.has(o.id));

      // 1. Hex ID prefix match
      let matched = available.find((o) =>
        o.id.slice(0, 8).toUpperCase() === labelUpper ||
        o.id.toUpperCase().startsWith(labelUpper)
      );

      // 2. Full email match
      if (!matched) {
        matched = available.find((o) =>
          labelLower.includes(o.userEmail.toLowerCase())
        );
      }

      // 3. Company name exact match (case-insensitive)
      if (!matched) {
        matched = available.find((o) =>
          o.userCompanyName && o.userCompanyName.toLowerCase() === labelLower
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
        const labelWords = new Set(labelLower.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 2));
        if (labelWords.size >= 2) {
          matched = available.find((o) => {
            if (!o.userCompanyName) return false;
            const companyWords = new Set(o.userCompanyName.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 2));
            const overlap = [...labelWords].filter((w) => companyWords.has(w)).length;
            return overlap >= 2;
          });
        }
      }

      // 6. Positional fallback — use next available order by position
      if (!matched) {
        matched = available[0] || processableOrders[i];
      }

      const systemOrderId = matched?.id || "";
      if (systemOrderId) {
        usedSystemOrderIds.add(systemOrderId);
      }

      return {
        packingOrderIndex: i,
        systemOrderId,
      };
    });
    setOrderMappings(mappings);
    setFlowStep("mapping");
  };

  // --- Order mapping step ---
  const updateMapping = (packingIndex: number, systemOrderId: string) => {
    setOrderMappings((prev) =>
      prev.map((m) => m.packingOrderIndex === packingIndex ? { ...m, systemOrderId } : m)
    );
  };

  const startReview = () => {
    const validMappings = orderMappings.filter((m) => m.systemOrderId);
    if (validMappings.length === 0) return;
    setOrderMappings(validMappings);
    setCurrentReviewIndex(0);
    buildReviewItems(validMappings[0]);
    setFlowStep("reviewing");
  };

  // --- Build review items for a mapping ---
  const buildReviewItems = (mapping: OrderMapping) => {
    if (!shipment) return;
    const packingOrder = packingOrders[mapping.packingOrderIndex];
    const systemOrder = shipment.orders.find((o) => o.id === mapping.systemOrderId);
    if (!packingOrder || !systemOrder) return;

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
          originalQty: oi.quantity,
          status: "removed",
        });
      }
    }

    setReviewItems(items);
  };

  // --- Review step: edit handlers ---
  const updateReviewItem = (index: number, field: keyof ReviewItem, value: string | number) => {
    setReviewItems((prev) => {
      const updated = [...prev];
      if (field === "quantity") updated[index] = { ...updated[index], quantity: Number(value) || 0 };
      else if (field === "unitPrice") updated[index] = { ...updated[index], unitPrice: Number(value) || 0 };
      else if (field === "name") updated[index] = { ...updated[index], name: String(value) };
      return updated;
    });
  };

  const removeReviewItem = (index: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const restoreRemovedItem = (index: number) => {
    setReviewItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: updated[index].originalQty || 1, status: "unchanged" };
      return updated;
    });
  };

  const addReviewItem = () => {
    setReviewItems((prev) => [...prev, {
      name: "",
      size: null,
      quantity: 1,
      unitPrice: 0,
      productId: null,
      originalQty: null,
      status: "new",
    }]);
  };

  // --- Accept current order ---
  const handleAcceptOrder = async () => {
    if (!shipment) return;
    const mapping = orderMappings[currentReviewIndex];
    const activeItems = reviewItems.filter((i) => i.status !== "removed" && i.quantity > 0);

    if (activeItems.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${mapping.systemOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: activeItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          status: "ACCEPTED",
        }),
      });

      if (res.ok) {
        setAcceptedOrderIds((prev) => new Set([...prev, mapping.systemOrderId]));

        if (currentReviewIndex < orderMappings.length - 1) {
          const nextIndex = currentReviewIndex + 1;
          setCurrentReviewIndex(nextIndex);
          buildReviewItems(orderMappings[nextIndex]);
        } else {
          setFlowStep("done");
          await fetchShipment();
        }
      }
    } catch {
      // Error handled silently
    }
    setSaving(false);
  };

  const handleSkipOrder = () => {
    if (currentReviewIndex < orderMappings.length - 1) {
      const nextIndex = currentReviewIndex + 1;
      setCurrentReviewIndex(nextIndex);
      buildReviewItems(orderMappings[nextIndex]);
    } else {
      setFlowStep("done");
      fetchShipment();
    }
  };

  const resetFlow = () => {
    setFlowStep("idle");
    setPackingOrders([]);
    setOrderMappings([]);
    setCurrentReviewIndex(0);
    setReviewItems([]);
    setAcceptedOrderIds(new Set());
    setParseError(null);
    setPackingHeaders([]);
    setPackingColumnMappings({ name: 0, size: -1, qty: -1 });
    setPackingWarnings([]);
    packingRawRowsRef.current = [];
    packingSeparatorsRef.current = [];
  };

  // --- Current review context ---
  const currentMapping = flowStep === "reviewing" ? orderMappings[currentReviewIndex] : null;
  const currentPackingOrder = currentMapping ? packingOrders[currentMapping.packingOrderIndex] : null;
  const currentSystemOrder = currentMapping ? shipment?.orders.find((o) => o.id === currentMapping.systemOrderId) : null;

  // Preview items count for column mapping step
  const totalParsedItems = useMemo(() => packingOrders.reduce((sum, o) => sum + o.items.length, 0), [packingOrders]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!shipment) return <div className="p-4 md:p-8 text-white/40">Shipment not found</div>;

  return (
    <div className="p-4 md:p-8">
      {/* Back button */}
      <button onClick={() => router.push("/admin/shipments")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Shipments
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{shipment.name}</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-amber-400 text-sm">Deadline: {new Date(shipment.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="text-white/40 text-sm">Arrives: {new Date(shipment.shipmentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/shipments/${shipment.id}/email`} className="px-4 py-1.5 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-500/30 transition-all flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            Send Notification
          </Link>
          <Link href={`/admin/shipments/${shipment.id}/edit`} className="px-4 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
            Edit Shipment
          </Link>
          <span className={`px-4 py-1.5 rounded-lg text-sm font-medium ${statusColors[shipment.status] || "bg-white/10 text-white/60"}`}>{shipment.status}</span>
        </div>
      </div>

      {/* Shipment details */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">Freight Cost</p>
            <p className="text-white font-semibold">{formatPrice(Number(shipment.freightCost))}</p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">Margin</p>
            <p className="text-white font-semibold">{Number(shipment.margin)}%</p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-1">Products</p>
            <p className="text-white font-semibold">{shipment.products.length}</p>
          </div>
        </div>
      </div>

      {/* Top Picks */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            <h3 className="text-white font-semibold text-sm">Top Picks</h3>
            <span className="text-white/30 text-xs">({shipment.products.filter((p) => p.featured).length} featured)</span>
          </div>
        </div>
        {shipment.products.filter((p) => p.featured).length === 0 && (
          <p className="text-white/30 text-xs mb-3">Search and add products to feature in emails and for customers.</p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {shipment.products.filter((p) => p.featured).map((p) => (
            <span key={p.id} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-medium flex items-center gap-1.5">
              {p.name}
              <button onClick={async () => {
                await fetch(`/api/admin/shipments/${shipment.id}/featured`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, featured: false }) });
                fetchShipment();
              }} className="text-amber-400/50 hover:text-amber-400 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
        <ProductSearch
          products={shipment.products.filter((p) => !p.featured)}
          onSelect={async (p) => {
            await fetch(`/api/admin/shipments/${shipment.id}/featured`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, featured: true }) });
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
              <h3 className="text-white font-semibold">Orders ({shipment.orders.length})</h3>
              <div className="flex flex-wrap items-center gap-2">
                {exportableOrders.length > 0 && (
                  <button
                    onClick={handleExportPackingList}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export Packing List
                  </button>
                )}
                {processableOrders.length > 0 && (
                  <label className="px-4 py-2 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all cursor-pointer">
                    Upload Packing List
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {shipment.orders.length === 0 ? (
              <div className="p-12 text-center text-white/30">No orders for this shipment</div>
            ) : (
              <div>
                {shipment.orders.map((o) => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} className="px-4 md:px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-xs font-mono">#{o.id.slice(0, 8).toUpperCase()}</span>
                          <p className="text-white text-sm font-medium">{o.userCompanyName || o.userEmail}</p>
                        </div>
                        {o.userCompanyName && <p className="text-white/30 text-xs">{o.userEmail}</p>}
                        <p className="text-white/40 text-xs mt-0.5">{o.itemCount} items - {formatPrice(o.total)}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${statusColors[o.status] || "bg-white/10 text-white/60"}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {showExportWarning && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[16px] p-4 mb-6">
              <p className="text-amber-400 text-sm font-medium mb-2">
                There {pendingOrders.length === 1 ? "is" : "are"} {pendingOrders.length} order{pendingOrders.length !== 1 ? "s" : ""} still in {pendingOrders.map((o) => o.status).filter((v, i, a) => a.indexOf(v) === i).join("/")} status.
              </p>
              <p className="text-amber-400/60 text-xs mb-3">These orders won&apos;t be included in the export. Are you sure you want to continue?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowExportWarning(false); doExportPackingList(); }}
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
                <h3 className="text-white font-semibold">Review Column Mappings</h3>
                <p className="text-white/50 text-sm mt-1">Verify which columns contain the product name, size, and quantity</p>
              </div>
              <button onClick={resetFlow} className="text-white/50 hover:text-white text-sm transition-colors">Cancel</button>
            </div>

            {packingWarnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                {packingWarnings.map((w, i) => (
                  <p key={i} className="text-amber-400/80 text-xs">{w}</p>
                ))}
              </div>
            )}

            {/* Column mapping dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {PACKING_MAPPING_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">{label}</label>
                  <select
                    value={packingColumnMappings[key]}
                    onChange={(e) => handlePackingMappingChange(key, parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[#0984E3]/50 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                  >
                    <option value={-1} className="bg-[#1a1f26] text-white/50">Not mapped</option>
                    {packingHeaders.map((h, i) => h ? (
                      <option key={i} value={i} className="bg-[#1a1f26] text-white">{h}</option>
                    ) : null)}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview: show first few rows with current mapping */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
                <p className="text-white/50 text-xs font-medium">
                  Preview — {packingOrders.length} order{packingOrders.length !== 1 ? "s" : ""} detected, {totalParsedItems} items total
                </p>
              </div>

              {/* Show all detected headers as a reference row */}
              <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02] overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {packingHeaders.map((h, i) => {
                    const isMapped = packingColumnMappings.name === i || packingColumnMappings.size === i || packingColumnMappings.qty === i;
                    const mappedAs = packingColumnMappings.name === i ? "Name" : packingColumnMappings.size === i ? "Size" : packingColumnMappings.qty === i ? "Qty" : null;
                    return h ? (
                      <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${isMapped ? "bg-[#0984E3]/20 text-[#0984E3]" : "bg-white/5 text-white/30"}`}>
                        {h}{mappedAs ? ` → ${mappedAs}` : ""}
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
                          <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Order: {order.label} ({order.items.length} items)</p>
                        </div>
                      )}
                      {order.items.slice(0, 5).map((item, ii) => (
                        <div key={ii} className="px-4 py-2 border-b border-white/5 flex items-center gap-4">
                          <div className="flex-1"><p className="text-white/80 text-xs truncate">{item.name}</p></div>
                          {item.size && <div className="w-16"><p className="text-white/40 text-xs">{item.size}</p></div>}
                          <div className="w-12 text-right"><p className="text-white/60 text-xs font-medium">{item.quantity}</p></div>
                        </div>
                      ))}
                      {order.items.length > 5 && (
                        <div className="px-4 py-1.5 text-white/20 text-[10px]">...and {order.items.length - 5} more items</div>
                      )}
                    </div>
                  ))}
                  {packingOrders.length > 3 && (
                    <div className="px-4 py-2 text-white/20 text-xs">...and {packingOrders.length - 3} more orders</div>
                  )}
                </div>
              )}

              {packingOrders.length === 0 && (
                <div className="p-8 text-center text-white/30 text-sm">
                  No items detected with current column mappings. Try adjusting the mappings above.
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
                <h3 className="text-white font-semibold">Map Packing List Orders</h3>
                <p className="text-white/50 text-sm mt-1">Match each packing list order to a system order</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setFlowStep("column_mapping")} className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm transition-colors">Back to Columns</button>
                <button onClick={resetFlow} className="text-white/50 hover:text-white text-sm transition-colors">Cancel</button>
              </div>
            </div>

            <div className="space-y-4">
              {packingOrders.map((po, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-white/[0.03] rounded-xl">
                  <div className="sm:flex-1">
                    <p className="text-white text-sm font-medium">Packing List: {po.label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{po.items.length} items</p>
                  </div>
                  <svg className="w-5 h-5 text-white/20 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  <div className="sm:flex-1">
                    <select
                      value={orderMappings.find((m) => m.packingOrderIndex === i)?.systemOrderId || ""}
                      onChange={(e) => updateMapping(i, e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#1a1f26] text-white/50">-- Skip this order --</option>
                      {processableOrders.map((o) => (
                        <option key={o.id} value={o.id} className="bg-[#1a1f26] text-white">
                          #{o.id.slice(0, 8).toUpperCase()} — {o.userCompanyName || o.userEmail} ({o.itemCount} items, {formatPrice(o.total)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={startReview}
                disabled={!orderMappings.some((m) => m.systemOrderId)}
                className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
              >
                Start Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review step */}
      {flowStep === "reviewing" && currentPackingOrder && currentSystemOrder && (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-sm font-medium">
                Order {currentReviewIndex + 1} of {orderMappings.length} — <span className="font-mono text-white/60">#{currentSystemOrder.id.slice(0, 8).toUpperCase()}</span> {currentSystemOrder.userCompanyName || currentSystemOrder.userEmail}
              </p>
              <button onClick={resetFlow} className="text-white/50 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className="bg-[#0984E3] h-1.5 rounded-full transition-all"
                style={{ width: `${((currentReviewIndex) / orderMappings.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Review items table */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
            <div className="p-4 md:p-6 border-b border-white/10">
              <h3 className="text-white font-semibold">Review Items — Packing List &quot;{currentPackingOrder.label}&quot;</h3>
              <p className="text-white/50 text-sm mt-1">Review and edit the adjusted items before accepting</p>
            </div>

            <div className="overflow-x-auto">
            {/* Column headers */}
            <div className="min-w-[600px] px-4 md:px-6 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="w-8"></div>
              <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
              <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
              <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Original</p></div>
              <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">New Qty</p></div>
              <div className="w-28 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
              <div className="w-16"></div>
            </div>

            {/* Items */}
            <div className="max-h-[500px] overflow-auto">
              {reviewItems.map((item, index) => {
                const rowBg = item.status === "new" ? "bg-green-500/5"
                  : item.status === "removed" ? "bg-red-500/5"
                  : item.status === "qty_changed" ? "bg-amber-500/5"
                  : "";

                const statusIcon = item.status === "new" ? (
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">+</span>
                ) : item.status === "removed" ? (
                  <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">-</span>
                ) : item.status === "qty_changed" ? (
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">~</span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-white/5 text-white/20 flex items-center justify-center text-xs">=</span>
                );

                return (
                  <div key={index} className={`min-w-[600px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/5 ${rowBg} ${item.status === "removed" ? "opacity-50" : ""}`}>
                    <div className="w-8">{statusIcon}</div>
                    <div className="flex-1">
                      {item.status === "removed" ? (
                        <p className="text-white/40 text-sm line-through">{item.name}</p>
                      ) : (
                        <input
                          value={item.name}
                          onChange={(e) => updateReviewItem(index, "name", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
                        />
                      )}
                      {!item.productId && item.status !== "removed" && (
                        <p className="text-amber-400/60 text-[10px] mt-1">No matching product found — set price manually</p>
                      )}
                    </div>
                    <div className="w-24">
                      {item.status === "removed" ? (
                        <p className="text-white/30 text-sm tabular-nums">{formatPrice(Number(item.unitPrice))}</p>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateReviewItem(index, "unitPrice", e.target.value)}
                          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.unitPrice === 0 ? "border-red-500/50" : "border-white/10"}`}
                        />
                      )}
                    </div>
                    <div className="w-20 text-center">
                      <p className="text-white/40 text-sm">{item.originalQty ?? "—"}</p>
                    </div>
                    <div className="w-20">
                      {item.status === "removed" ? (
                        <p className="text-white/30 text-sm text-center">0</p>
                      ) : (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateReviewItem(index, "quantity", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50"
                        />
                      )}
                    </div>
                    <div className="w-28 text-right">
                      <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                        {formatPrice(item.quantity * Number(item.unitPrice))}
                      </p>
                    </div>
                    <div className="w-16 text-right">
                      {item.status === "removed" ? (
                        <button onClick={() => restoreRemovedItem(index)} className="text-green-400/60 hover:text-green-400 text-xs transition-colors">Restore</button>
                      ) : (
                        <button onClick={() => removeReviewItem(index)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
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
                const activeItems = reviewItems.filter((i) => i.status !== "removed" && i.quantity > 0);
                const subtotal = activeItems.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
                const unchanged = reviewItems.filter((i) => i.status === "unchanged").length;
                const changed = reviewItems.filter((i) => i.status === "qty_changed").length;
                const newItems = reviewItems.filter((i) => i.status === "new").length;
                const removed = reviewItems.filter((i) => i.status === "removed").length;

                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                      {unchanged > 0 && <span className="text-white/40">{unchanged} unchanged</span>}
                      {changed > 0 && <span className="text-amber-400">{changed} qty changed</span>}
                      {newItems > 0 && <span className="text-green-400">{newItems} new</span>}
                      {removed > 0 && <span className="text-red-400">{removed} removed</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-white/50 text-xs">Subtotal (ex VAT)</p>
                      <p className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(subtotal)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <button onClick={handleSkipOrder} className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              Skip This Order
            </button>
            <button
              onClick={handleAcceptOrder}
              disabled={saving || reviewItems.filter((i) => i.status !== "removed" && i.quantity > 0).length === 0}
              className="px-6 py-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:bg-white/10 disabled:text-white/30 font-medium rounded-xl transition-all"
            >
              {saving ? "Accepting..." : "Accept Order"}
            </button>
          </div>
        </div>
      )}

      {/* Done step */}
      {flowStep === "done" && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Packing List Processed</h3>
          <p className="text-white/50 text-sm mb-6">
            {acceptedOrderIds.size} order{acceptedOrderIds.size !== 1 ? "s" : ""} accepted
          </p>
          <button onClick={resetFlow} className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl transition-all">
            Back to Shipment
          </button>
        </div>
      )}
    </div>
  );
}
