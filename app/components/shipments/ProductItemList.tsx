"use client";

import { useState, useCallback, memo } from "react";

export interface ProductItemBase {
  _id: number;
  name: string;
  variant?: string | null;
  price: number | null;
  size: string | null;
  qtyPerBox: number | null;
  availableQty: number | null;
}

interface ItemRowProps<T extends ProductItemBase> {
  item: T;
  hasVariant: boolean;
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
}

export const ItemRow = memo(function ItemRow<T extends ProductItemBase>({ item, hasVariant, hasSize, hasStock, onUpdate, onRemove }: ItemRowProps<T>) {
  const id = item._id;
  return (
    <div className={`min-w-[500px] px-4 md:px-6 h-[49px] flex items-center gap-4 border-b border-white/5 ${item.availableQty !== null && item.availableQty !== undefined && item.availableQty <= 0 ? "opacity-40" : ""}`}>
      <div className="flex-1">
        <input
          value={item.name}
          onChange={(e) => onUpdate(id, "name", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!item.name ? "border-red-500/50" : "border-white/10"}`}
        />
      </div>
      {hasVariant && (
        <div className="w-24">
          <input
            value={item.variant ?? ""}
            onChange={(e) => onUpdate(id, "variant", e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
      )}
      <div className="w-24">
        <input
          type="number"
          step="0.01"
          value={item.price ?? ""}
          onChange={(e) => onUpdate(id, "price", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.price === null ? "border-red-500/50" : "border-white/10"}`}
        />
      </div>
      {hasSize && (
        <div className="w-20">
          <input
            value={item.size ?? ""}
            onChange={(e) => onUpdate(id, "size", e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
      )}
      <div className="w-20">
        <input
          type="number"
          value={item.qtyPerBox ?? ""}
          onChange={(e) => onUpdate(id, "qtyPerBox", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.qtyPerBox === null ? "border-amber-500/50" : "border-white/10"}`}
        />
      </div>
      {hasStock && (
        <div className="w-20">
          <input
            type="number"
            value={item.availableQty ?? ""}
            onChange={(e) => onUpdate(id, "availableQty", e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
      )}
      <div className="w-16 text-right">
        <button onClick={() => onRemove(id)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
      </div>
    </div>
  );
}) as <T extends ProductItemBase>(props: ItemRowProps<T>) => React.ReactElement;

export const ROW_H = 49;
export const OVERSCAN = 5;
export const LIST_H = 500;

export function VirtualItemList<T extends ProductItemBase>({ items, hasVariant, hasSize, hasStock, onUpdate, onRemove, isPending = false, scrollRef }: {
  items: T[];
  hasVariant: boolean;
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
  isPending?: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(items.length, startIdx + Math.ceil(LIST_H / ROW_H) + OVERSCAN * 2);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`transition-opacity ${isPending ? "opacity-40" : ""}`}
      style={{ maxHeight: LIST_H, overflowY: "auto" }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {items.slice(startIdx, endIdx).map((item, i) => (
          <div
            key={item._id}
            style={{ position: "absolute", top: (startIdx + i) * ROW_H, left: 0, right: 0 }}
          >
            <ItemRow
              item={item}
              hasVariant={hasVariant}
              hasSize={hasSize}
              hasStock={hasStock}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
