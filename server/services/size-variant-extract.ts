// Extracts size (cm measurement) and variant (S/M/L letter grade) from
// freeform strings — stock column markers, English product names with
// parenthesised tags like "(S)(4~5cm)", or Chinese names like
// "雞心倒吊15~18cm(預定6隻以上)".

const RANGE_CM_RE = /(\d{1,3}(?:\.\d+)?)\s*[~\-–—]\s*(\d{1,3}(?:\.\d+)?)\s*cm/i;
const SINGLE_CM_RE = /(\d{1,3}(?:\.\d+)?)\s*cm\s*\+?/i;
const LETTER_RE = /\b(XXXL|XXL|XL|XS|XXS|SM|ML|JBO|JUMBO|S|M|L)\b/;

export function extractSize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^x+$/i.test(s)) return null;

  const range = s.match(RANGE_CM_RE);
  if (range) return `${range[1]}-${range[2]}cm`;

  const single = s.match(SINGLE_CM_RE);
  if (single) {
    const hasPlus = /cm\s*\+/i.test(single[0]);
    return `${single[1]}cm${hasPlus ? "+" : ""}`;
  }

  return null;
}

export function extractVariant(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^x+$/i.test(s)) return null;

  // Prefer parenthesised letter codes when present (e.g. "Black Tang(ML)(Hawaii)")
  const paren = s.match(/\((XXXL|XXL|XL|XS|XXS|SM|ML|JBO|JUMBO|S|M|L)\)/i);
  if (paren) return paren[1].toUpperCase();

  // Bare letter (e.g. stock col "S", "ML")
  if (/^(XXXL|XXL|XL|XS|XXS|SM|ML|JBO|JUMBO|S|M|L)$/i.test(s)) return s.toUpperCase();

  // Word forms in English/Chinese names
  if (/\bsmall\b/i.test(s)) return "S";
  if (/\bmedium\b/i.test(s)) return "M";
  if (/\blarge\b/i.test(s)) return "L";
  if (/\bjumbo\b/i.test(s)) return "JUMBO";

  // Standalone letter inside the string (last resort, must be a size letter only)
  const letter = s.match(LETTER_RE);
  if (letter) return letter[1].toUpperCase();

  return null;
}

// Pull size+variant from a candidate set of strings (try in order, first hit wins).
export function extractSizeVariant(
  candidates: { stock?: unknown; english?: unknown; chinese?: unknown },
): { size: string | null; variant: string | null } {
  let size: string | null = null;
  let variant: string | null = null;

  // Stock col first
  const stockSize = extractSize(candidates.stock);
  if (stockSize) size = stockSize;
  const stockVariant = extractVariant(candidates.stock);
  if (stockVariant) variant = stockVariant;

  // English next
  if (!size) {
    const sz = extractSize(candidates.english);
    if (sz) size = sz;
  }
  if (!variant) {
    const v = extractVariant(candidates.english);
    if (v) variant = v;
  }

  // Chinese as fallback
  if (!size) {
    const sz = extractSize(candidates.chinese);
    if (sz) size = sz;
  }
  if (!variant) {
    const v = extractVariant(candidates.chinese);
    if (v) variant = v;
  }

  return { size, variant };
}
