"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

export interface TagLite {
  id: string;
  name: string;
}

const POPOVER_WIDTH = 240;

function TagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function PlusIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

/** Neutral pill used to display a tag. Pass onRemove to show an ✕ button. */
export function TagChip({
  name,
  onRemove,
}: {
  name: string;
  onRemove?: () => void;
}) {
  return (
    <span
      title={name}
      className="inline-flex items-center gap-1 max-w-full pl-2 pr-1.5 py-0.5 bg-white/10 border border-white/10 rounded-md text-xs text-white/70"
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${name}`}
          className="shrink-0 text-white/30 hover:text-white/80 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

interface CompanyTagsProps {
  companyId: string;
  /** Currently-assigned tags. */
  tags: TagLite[];
  /** Every tag in the system, for the picker checklist. */
  allTags: TagLite[];
  /** Called with the new assigned set (optimistically, then reverted on failure). */
  onChange: (next: TagLite[]) => void;
  /** Called when a brand-new global tag is created, so callers can refresh their tag list. */
  onTagCreated?: (tag: TagLite) => void;
  /** "icon" = compact icon + count badge (table); "inline" = chips + add button (detail page). */
  variant?: "icon" | "inline";
  disabled?: boolean;
  className?: string;
}

/** Add/remove/create tags for a company. Handles its own persistence + optimistic updates. */
export function CompanyTags({
  companyId,
  tags,
  allTags,
  onChange,
  onTagCreated,
  variant = "icon",
  disabled = false,
  className = "",
}: CompanyTagsProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // The popover is fixed-positioned, so close it if the page scrolls or resizes under it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const assignedIds = new Set(tags.map((t) => t.id));
  const q = query.trim().toLowerCase();
  const filtered = allTags.filter((t) => t.name.toLowerCase().includes(q));
  const exactExists = allTags.some((t) => t.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exactExists;

  // PATCH the company's full tag set, with optimistic update + revert on failure.
  const persist = async (next: TagLite[]) => {
    const previous = tags;
    onChange(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: next.map((t) => t.id) }),
      });
      if (!res.ok) onChange(previous);
    } catch {
      onChange(previous);
    }
    setBusy(false);
  };

  const toggle = (tag: TagLite) =>
    assignedIds.has(tag.id) ? persist(tags.filter((t) => t.id !== tag.id)) : persist([...tags, tag]);

  const remove = (tag: TagLite) => persist(tags.filter((t) => t.id !== tag.id));

  // Create a new tag (or reuse an existing one by name), then assign it to this company.
  const createAndAdd = async (rawName: string) => {
    const name = rawName.trim();
    if (!name || busy) return;
    const previous = tags;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const tag: TagLite = await res.json();
        onTagCreated?.(tag);
        setQuery("");
        const next = assignedIds.has(tag.id) ? tags : [...tags, tag];
        onChange(next);
        const patch = await fetch(`/api/admin/companies/${companyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: next.map((t) => t.id) }),
        });
        if (!patch.ok) onChange(previous);
      }
    } catch {
      onChange(previous);
    }
    setBusy(false);
  };

  const toggleOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        // Clamp into the viewport — the trigger often sits at the far right of the table.
        let left = r.left;
        if (left + POPOVER_WIDTH > window.innerWidth - 8) left = window.innerWidth - POPOVER_WIDTH - 8;
        if (left < 8) left = 8;
        setCoords({ top: r.bottom + 6, left });
      }
      setQuery("");
    }
    setOpen((o) => !o);
  };

  const trigger =
    variant === "inline" ? (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {tags.map((t) => (
          <TagChip key={t.id} name={t.name} onRemove={disabled ? undefined : () => remove(t)} />
        ))}
        <button
          ref={btnRef}
          type="button"
          onClick={toggleOpen}
          disabled={disabled}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed text-xs transition-colors ${open ? "border-[#0984E3]/50 text-white" : "border-white/20 text-white/50 hover:text-white hover:border-white/40"}`}
        >
          <PlusIcon className="w-3 h-3" />
          {tags.length === 0 ? "Add tag" : "Add"}
        </button>
      </div>
    ) : (
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-label="Edit tags"
        title="Tags"
        className={`group relative inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${open ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/10"} ${className}`}
      >
        <TagIcon />
        {tags.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-[#0984E3] text-white text-[9px] font-semibold leading-none tabular-nums">
            {tags.length}
          </span>
        )}
      </button>
    );

  return (
    <>
      {trigger}

      {/* open only flips true from a client click, so the portal never runs during SSR */}
      {open && coords && createPortal(
        <>
          {/* invisible catcher closes the menu on any outside click */}
          <div className="fixed inset-0 z-[120]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div
            role="dialog"
            className="fixed z-[121] bg-[#1a1f26] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
            style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
            onClick={(e) => e.stopPropagation()}
          >
            {variant === "icon" && (
              <div className="p-2 border-b border-white/10">
                {tags.length === 0 ? (
                  <p className="text-white/30 text-xs px-1 py-0.5">No tags yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <TagChip key={t.id} name={t.name} onRemove={() => remove(t)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) { e.preventDefault(); createAndAdd(query); }
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Search or add…"
                className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
              />
            </div>

            <div className="max-h-[180px] overflow-y-auto pb-1">
              {filtered.length === 0 && !canCreate && (
                <p className="text-white/30 text-xs px-3 py-2">{allTags.length === 0 ? "No tags created yet" : "No matches"}</p>
              )}
              {filtered.map((t) => {
                const active = assignedIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${active ? "bg-white/[0.06]" : "hover:bg-white/5"}`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${active ? "bg-[#0984E3] border-[#0984E3]" : "border-white/20"}`}>
                      {active && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-white/80 truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={() => createAndAdd(query)}
                disabled={busy}
                className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-white/10 text-[#0984E3] hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <PlusIcon />
                <span className="text-sm truncate">Add new tag “{query.trim()}”</span>
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
