"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface ParsedItem {
  name: string;
  price: number;
}

interface ParsedFile {
  filename: string;
  displayName: string;
  deadline: string;
  items: ParsedItem[];
}

interface CartItem {
  fileIndex: number;
  itemIndex: number;
  quantity: number;
}

const SHIPPING_HANDLING = 225;

// Convert to title case (handles uppercase text)
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Parse item name to extract minimum quantity info
function parseItemName(name: string): {
  cleanName: string;
  minQty: string | null;
} {
  // Match patterns like "5 FISH MIN.", "10 MIN", "(MIN 5)", "MINIMUM 3" etc.
  const minPatterns = [
    /\s*-?\s*(\d+)\s+\w*\s*MIN\.?\s*$/i, // "5 FISH MIN." or "5 MIN"
    /\s*\(?\s*(\d+)\s*MIN\.?\s*\)?$/i, // "(5 MIN)" or "5 MIN"
    /\s*\(?\s*MIN\.?\s*(\d+)\s*\)?$/i, // "(MIN 5)" or "MIN 5"
    /\s*\(?\s*MINIMUM\s*[:\s]*(\d+)\s*\)?$/i, // "MINIMUM 5" or "MINIMUM: 5"
    /\s*\(?\s*(\d+)\s*MINIMUM\s*\)?$/i, // "5 MINIMUM"
    /\s*-\s*(\d+)\s*MIN\.?$/i, // "- 5 MIN"
    /\s*x\s*(\d+)\s*MIN\.?$/i, // "x5 MIN"
    /\s*\(\s*(\d+)\s*\)\s*MIN\.?\s*$/i, // "(5) MIN"
  ];

  for (const pattern of minPatterns) {
    const match = name.match(pattern);
    if (match) {
      const cleanName = toTitleCase(name.replace(pattern, "").trim());
      return { cleanName, minQty: match[1] };
    }
  }

  return { cleanName: toTitleCase(name), minQty: null };
}

function InvoiceBuilderContent() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUrl, setCheckingUrl] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const urlPassword = searchParams.get("p");
    if (urlPassword) {
      setPassword(urlPassword);
      authenticateWithPassword(urlPassword);
    } else {
      setCheckingUrl(false);
    }
  }, [searchParams]);

  const authenticateWithPassword = async (pwd: string) => {
    try {
      const response = await fetch("/api/price-lists/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
        setIsAuthenticated(true);
      }
    } catch {
      // Silent fail
    }
    setCheckingUrl(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/price-lists/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setFiles(data.files);
      setIsAuthenticated(true);
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  const toggleFile = (index: number) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFiles(newExpanded);
  };

  const getCartKey = (fileIndex: number, itemIndex: number) =>
    `${fileIndex}-${itemIndex}`;

  const getQuantity = (fileIndex: number, itemIndex: number) =>
    cart.get(getCartKey(fileIndex, itemIndex)) || 0;

  const updateQuantity = (
    fileIndex: number,
    itemIndex: number,
    delta: number
  ) => {
    const key = getCartKey(fileIndex, itemIndex);
    const current = cart.get(key) || 0;
    const newQty = Math.max(0, current + delta);

    const newCart = new Map(cart);
    if (newQty === 0) {
      newCart.delete(key);
    } else {
      newCart.set(key, newQty);
    }
    setCart(newCart);
  };

  const setQuantity = (fileIndex: number, itemIndex: number, qty: number) => {
    const key = getCartKey(fileIndex, itemIndex);
    const newCart = new Map(cart);
    if (qty <= 0) {
      newCart.delete(key);
    } else {
      newCart.set(key, qty);
    }
    setCart(newCart);
  };

  const getItemTotal = (fileIndex: number, itemIndex: number) => {
    const qty = getQuantity(fileIndex, itemIndex);
    const item = files[fileIndex]?.items[itemIndex];
    return qty * (item?.price || 0);
  };

  const getShipmentSubtotal = (fileIndex: number) => {
    let total = 0;
    const file = files[fileIndex];
    if (!file) return 0;

    file.items.forEach((item, itemIndex) => {
      const qty = getQuantity(fileIndex, itemIndex);
      total += qty * item.price;
    });
    return total;
  };

  const getShipmentGrandTotal = (fileIndex: number) => {
    const subtotal = getShipmentSubtotal(fileIndex);
    return subtotal > 0 ? subtotal + SHIPPING_HANDLING : 0;
  };

  const getShipmentItemCount = (fileIndex: number) => {
    let count = 0;
    const file = files[fileIndex];
    if (!file) return 0;

    file.items.forEach((_, itemIndex) => {
      count += getQuantity(fileIndex, itemIndex);
    });
    return count;
  };

  const formatPrice = (price: number) =>
    `£${price.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="min-h-screen bg-[#1a1f26]">
      {/* Header */}
      <header className="px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.png"
            alt="The Coral Farm"
            width={40}
            height={60}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">
            THE CORAL FARM
          </span>
        </Link>
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          Back to Home
        </Link>
      </header>

      <main className="px-6 md:px-[100px] lg:px-[140px] py-12">
        <div className="max-w-4xl mx-auto">
          {checkingUrl ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : !isAuthenticated ? (
            /* Login Form */
            <div className="max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-[#0984E3]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Invoice Builder
                </h1>
                <p className="text-white/50">
                  Enter your password to build an invoice
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                  autoFocus
                />

                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Invoice Builder */
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Invoice Builder
                </h1>
                <p className="text-white/50">
                  Select items from upcoming shipments
                </p>
              </div>

              {/* Shipment Cards */}
              <div className="space-y-4">
                {files.map((file, fileIndex) => (
                  <div
                    key={file.filename}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden"
                  >
                    {/* Shipment Header */}
                    <button
                      onClick={() => toggleFile(fileIndex)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#0984E3]/20 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-6 h-6 text-[#0984E3]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="text-white font-semibold">
                            {file.displayName}
                          </p>
                          <p className="text-amber-400 text-sm font-medium">
                            Deadline: {file.deadline}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white/40 text-sm">
                          {file.items.length} items
                        </span>
                        <svg
                          className={`w-5 h-5 text-white/40 transition-transform duration-200 ${
                            expandedFiles.has(fileIndex) ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Items List */}
                    {expandedFiles.has(fileIndex) && (
                      <div className="border-t border-white/10">
                        {file.items.length === 0 ? (
                          <div className="p-6 text-center text-white/40">
                            No items found in this file
                          </div>
                        ) : (
                          <>
                            {/* Column Headers */}
                            <div className="px-5 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
                              <div className="min-w-0 flex-1">
                                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                                  Item
                                </p>
                              </div>
                              <div className="text-right shrink-0 w-16">
                                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                                  Price
                                </p>
                              </div>
                              <div className="shrink-0 w-[86px] text-center">
                                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                                  Qty
                                </p>
                              </div>
                              <div className="text-right shrink-0 w-20">
                                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                                  Total
                                </p>
                              </div>
                            </div>

                            <div className="divide-y divide-white/5">
                              {file.items.map((item, itemIndex) => {
                                const qty = getQuantity(fileIndex, itemIndex);
                                const itemTotal = getItemTotal(
                                  fileIndex,
                                  itemIndex
                                );
                                const { cleanName, minQty } = parseItemName(
                                  item.name
                                );

                                return (
                                  <div
                                    key={itemIndex}
                                    className={`px-5 py-3 flex items-center gap-4 transition-colors ${
                                      qty > 0
                                        ? "bg-[#0984E3]/5"
                                        : "hover:bg-white/[0.02]"
                                    }`}
                                  >
                                    {/* Item Info */}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-white/90 text-[13px] leading-snug font-medium font-semibold">
                                        {cleanName}
                                      </p>
                                      {minQty && (
                                        <p className="text-white/30 text-[11px] mt-0.5">
                                          Minimum {minQty}
                                        </p>
                                      )}
                                    </div>

                                    {/* Price */}
                                    <div className="text-right shrink-0 w-16">
                                      <p className="text-white/60 text-xs tabular-nums">
                                        {formatPrice(item.price)}
                                      </p>
                                    </div>

                                    {/* Quantity Stepper */}
                                    <div className="flex items-center shrink-0">
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            fileIndex,
                                            itemIndex,
                                            -1
                                          )
                                        }
                                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                                      >
                                        <span className="text-sm font-medium">
                                          −
                                        </span>
                                      </button>
                                      <input
                                        type="number"
                                        value={qty}
                                        onChange={(e) =>
                                          setQuantity(
                                            fileIndex,
                                            itemIndex,
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="w-8 h-7 bg-transparent text-white text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            fileIndex,
                                            itemIndex,
                                            1
                                          )
                                        }
                                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                                      >
                                        <span className="text-sm font-medium">
                                          +
                                        </span>
                                      </button>
                                    </div>

                                    {/* Line Total */}
                                    <div className="text-right shrink-0 w-20">
                                      {qty > 0 ? (
                                        <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                                          {formatPrice(itemTotal)}
                                        </p>
                                      ) : (
                                        <p className="text-white/20 text-sm tabular-nums">
                                          —
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Shipment Totals */}
                            {getShipmentSubtotal(fileIndex) > 0 && (
                              <div className="border-t border-white/10 bg-white/[0.02] p-4 space-y-2">
                                <div className="flex items-center justify-between text-white/60 text-sm">
                                  <span>
                                    Subtotal ({getShipmentItemCount(fileIndex)}{" "}
                                    items)
                                  </span>
                                  <span>
                                    {formatPrice(
                                      getShipmentSubtotal(fileIndex)
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-white/60 text-sm">
                                  <span>Shipping + Handling</span>
                                  <span>{formatPrice(SHIPPING_HANDLING)}</span>
                                </div>
                                <div className="h-px bg-white/10" />
                                <div className="flex items-center justify-between">
                                  <span className="text-white font-semibold">
                                    Grand Total
                                  </span>
                                  <span className="text-[#0984E3] font-bold text-lg">
                                    {formatPrice(
                                      getShipmentGrandTotal(fileIndex)
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function InvoiceBuilder() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1f26] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <InvoiceBuilderContent />
    </Suspense>
  );
}
