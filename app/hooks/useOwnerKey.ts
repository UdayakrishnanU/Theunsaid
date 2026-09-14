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

  // `promote: true` makes `c` the primary key (codes[0]) — used when restoring
  // a key on a browser whose own default key never actually posted anything,
  // so "Your key" at the top of /mine matches the key that owns your stuff
  // instead of a blank auto-generated one nobody saved.
  const addCode = (c: string, promote = false) => {
    if (codes.includes(c)) {
      if (promote && codes[0] !== c) setCodes([c, ...codes.filter((x) => x !== c)]);
      return;
    }
    setCodes(promote ? [c, ...codes] : [...codes, c]);
  };

  return { key: key || null, codes, ensure, addCode };
}
