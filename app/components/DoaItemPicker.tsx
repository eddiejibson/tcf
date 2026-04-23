"use client";

import { useState, useRef, useEffect } from "react";

export type DoaPickerOption = {
  id: string;
  name: string;
  remaining: number;
  total: number;
};

interface DoaItemPickerProps {
  options: DoaPickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export default function DoaItemPicker({ options, value, onChange, placeholder = "Select item..." }: DoaItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const q = search.toLowerCase();
  const filtered = options.filter((o) => o.name.toLowerCase().includes(q));

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 transition-colors"
      >
        <span className={selected ? "text-white truncate" : "text-white/30"}>
          {selected ? `${selected.name} (${selected.remaining} remaining)` : placeholder}
        </span>
        <svg className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ml-2 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[999] mt-2 w-full bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#0984E3]/40"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelect(o.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  value === o.id
                    ? "bg-[#0984E3]/10 text-[#0984E3]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <p className="font-medium truncate">{o.name}</p>
                <p className="text-[11px] opacity-50">{o.remaining} of {o.total} remaining</p>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-white/25 text-sm">No items found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
