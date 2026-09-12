"use client";
import { useEffect, useState } from "react";
import { CUR, CurrencyCode, detectCur } from "@/lib/currency";

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
    setCodeState(detectCur(saved));
  }, []);
  const setCode = (c: CurrencyCode) => {
    setCodeState(c);
    try {
      localStorage.setItem("unsaid_cur", JSON.stringify(c));
    } catch {
      /* ignore */
    }
  };
  return { code, def: CUR[code], setCode };
}
