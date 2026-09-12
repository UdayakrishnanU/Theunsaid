// Ported from unsaid-v30.html. Tier prices are set per region, not FX-converted,
// because a small card payment costs far more to process than a local instant
// transfer. `inr` is an internal INR-equivalent unit used only to rank bids
// against each other in a single base unit (paise-equivalent, `base`).
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD" | "AUD" | "CAD";

export interface CurrencyDef {
  sym: string;
  code: CurrencyCode;
  inr: number; // INR per 1 unit of this currency (approx, for cross-currency bid ranking only)
  post: number;
  glow: number;
  pin: number;
  rail: string;
  loc: string;
}

export const CUR: Record<CurrencyCode, CurrencyDef> = {
  INR: { sym: "₹", code: "INR", inr: 1, post: 79, glow: 299, pin: 499, rail: "UPI", loc: "en-IN" },
  USD: { sym: "$", code: "USD", inr: 88, post: 1, glow: 2.99, pin: 9.99, rail: "Card, Apple Pay or Google Pay", loc: "en-US" },
  EUR: { sym: "€", code: "EUR", inr: 95, post: 1, glow: 2.99, pin: 8.99, rail: "Card, Apple Pay or Google Pay", loc: "de-DE" },
  GBP: { sym: "£", code: "GBP", inr: 112, post: 1, glow: 2.49, pin: 7.99, rail: "Card, Apple Pay or Google Pay", loc: "en-GB" },
  AED: { sym: "AED ", code: "AED", inr: 24, post: 4, glow: 11, pin: 37, rail: "Card or Apple Pay", loc: "en-AE" },
  SGD: { sym: "S$", code: "SGD", inr: 65, post: 1.5, glow: 3.99, pin: 12.99, rail: "PayNow or card", loc: "en-SG" },
  AUD: { sym: "A$", code: "AUD", inr: 58, post: 1.5, glow: 4.49, pin: 14.99, rail: "Card, Apple Pay or Google Pay", loc: "en-AU" },
  CAD: { sym: "C$", code: "CAD", inr: 64, post: 1.5, glow: 3.99, pin: 13.99, rail: "Card, Apple Pay or Google Pay", loc: "en-CA" },
};

const ZONE2CUR: Record<string, CurrencyCode> = {
  "Asia/Kolkata": "INR", "Asia/Calcutta": "INR", "Europe/London": "GBP", "Asia/Dubai": "AED",
  "Asia/Singapore": "SGD", "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD",
  "America/Toronto": "CAD", "America/Vancouver": "CAD",
};

export function detectCur(savedCode?: string | null): CurrencyCode {
  if (savedCode && CUR[savedCode as CurrencyCode]) return savedCode as CurrencyCode;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (ZONE2CUR[tz]) return ZONE2CUR[tz];
    if (/^Asia\/(Kolkata|Calcutta)/.test(tz)) return "INR";
    if (/^America\//.test(tz)) return "USD";
    if (/^Australia\//.test(tz)) return "AUD";
    if (/^Europe\//.test(tz)) return "EUR";
    const l = (typeof navigator !== "undefined" ? navigator.language || "" : "").toUpperCase();
    if (l.endsWith("-IN")) return "INR";
    if (l.endsWith("-GB")) return "GBP";
    if (l.endsWith("-US")) return "USD";
  } catch {
    // ignore
  }
  return "USD";
}

export const dp = (code: CurrencyCode) => (CUR[code].code === "INR" ? 0 : 2);

export function fmt(n: number, code: CurrencyCode): string {
  const k = CUR[code];
  const d = dp(code);
  const v = Number(n);
  const clean = d === 2 && Math.abs(v - Math.round(v)) < 0.005 ? 0 : d;
  try {
    return k.sym + v.toLocaleString(k.loc, { minimumFractionDigits: clean, maximumFractionDigits: d });
  } catch {
    return k.sym + v.toFixed(clean);
  }
}

// `base` = minor-unit-agnostic integer used to rank bids/tiers across currencies:
// round(amount_in_that_currency * inr_rate * 100)
export const toBase = (n: number, code: CurrencyCode) => Math.round(Number(n) * CUR[code].inr * 100);
export function fromBase(b: number, code: CurrencyCode): number {
  const v = Number(b) / 100 / CUR[code].inr;
  return dp(code) === 0 ? Math.max(1, Math.ceil(v)) : Math.max(0.01, Math.ceil(v * 100) / 100);
}
export const showMoney = (b: number, code: CurrencyCode) => fmt(fromBase(b, code), code);

export type Tier = "std" | "glow" | "pin";
export const priceBase = (tier: Tier, code: CurrencyCode) =>
  Math.round((tier === "glow" ? CUR[code].glow : CUR[code].post) * CUR[code].inr * 100);

export const BID_STEP = 100; // in base units (same scale as toBase)
export const minBidBase = (code: CurrencyCode) => Math.round(CUR[code].pin * CUR[code].inr * 100);
