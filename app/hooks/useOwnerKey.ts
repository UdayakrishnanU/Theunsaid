"use client";
import { useLocalState } from "./useLocalState";

function mkCode(): string {
  return "UN-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

/** The device's bearer "key" for owning posts — client-generated so the user
 * has one even before their first post, and portable: entering it on another
 * device (see /mine) brings back everything it owns, per lib/ownerKey.ts on
 * the server. Mirrors the original's myCodes/myKey/addCode. */
export function useOwnerKey() {
  const [codes, setCodes] = useLocalState<string[]>("unsaid_codes", []);
  const key = codes[0];

  const ensure = (): string => {
    if (codes.length) return codes[0];
    const c = mkCode();
    setCodes([c]);
    return c;
  };

  const addCode = (c: string) => {
    if (!codes.includes(c)) setCodes([...codes, c]);
  };

  return { key: key || null, codes, ensure, addCode };
}
