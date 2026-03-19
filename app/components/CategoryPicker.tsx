"use client";

import { useState, useRef, useEffect } from "react";
import type { CategoryNode } from "@/app/lib/types";

interface CategoryPickerProps {
  categories: CategoryNode[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowAll?: boolean;
}

export default function CategoryPicker({ categories, value, onChange, placeholder = "Select category...", allowAll = false }: CategoryPickerProps) {
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

  // Find selected label
  let selectedLabel = "";
  for (const parent of categories) {
    if (parent.id === value) { selectedLabel = parent.name; break; }
    for (const child of parent.children) {
      if (child.id === value) { selectedLabel = `${parent.name} → ${child.name}`; break; }
    }
    if (selectedLabel) break;
  }

  const q = search.toLowerCase();

  // Filter categories
  const filtered = categories
    .map((parent) => {
      const matchingChildren = parent.children.filter((c) => c.name.toLowerCase().includes(q));
      const parentMatches = parent.name.toLowerCase().includes(q);
      if (parentMatches || matchingChildren.length > 0) {
        return { ...parent, children: parentMatches ? parent.children : matchingChildren };
      }
      return null;
    })
    .filter(Boolean) as CategoryNode[];

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#0984E3]/50 transition-colors"
      >
        <span className={selectedLabel ? "text-white" : "text-white/30"}>
          {selectedLabel || placeholder}
        </span>
        <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[999] mt-2 w-full bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Search */}
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
                placeholder="Search categories..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#0984E3]/40"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-2">
            {allowAll && !search && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  !value ? "bg-[#0984E3]/10 text-[#0984E3]" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                All Categories
              </button>
            )}

            {filtered.map((parent) => (
              <div key={parent.id} className="mt-1 first:mt-0">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/25 font-semibold">{parent.name}</p>
                {parent.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => handleSelect(child.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                      value === child.id
                        ? "bg-[#0984E3]/10 text-[#0984E3]"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-white/25 text-sm">No categories found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
