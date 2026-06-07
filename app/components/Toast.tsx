"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useCallback, useRef, useEffect } from "react";

export type ToastKind = "success" | "error";

export interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

// Lightweight transient-notification hook. Returns the current toast and a showToast()
// that replaces any visible toast and auto-dismisses after a few seconds.
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, kind });
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { toast, showToast };
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl shadow-black/40 backdrop-blur-xl text-sm font-medium ${
              toast.kind === "error"
                ? "bg-red-500/15 border-red-500/30 text-red-300"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {toast.kind === "error" ? (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
