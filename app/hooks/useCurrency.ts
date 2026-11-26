"use client";
import { useEffect, useState } from "react";
import { CUR, CurrencyCode, detectCur, fallbackPayable, isPayable } from "@/lib/currency";

export function useCurrency() {
  const [code, setCodeState] = useState<CurrencyCode>("USD");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("unsaid_cur");
      if (saved) saved = JSON.parse(saved);
    } catch {
      /* ignore */
    }
    // Never show prices in a currency Cashfree can't charge — that's what
    // made every overseas "Pay and post" fail with a generic error.
    const detected = detectCur(saved);
    setCodeState(isPayable(detected) ? detected : fallbackPayable());
  }, []);
  const setCode = (c: CurrencyCode) => {
    if (!isPayable(c)) c = fallbackPayable();
    setCodeState(c);
    try {
      localStorage.setItem("unsaid_cur", JSON.stringify(c));
    } catch {
      /* ignore */
    }
  };
  return { code, def: CUR[code], setCode };
}
