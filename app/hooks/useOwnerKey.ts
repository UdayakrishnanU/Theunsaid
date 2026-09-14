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
  const [codes, setCodes, codesRef] = useLocalState<string[]>("unsaid_codes", []);
  const key = codes[0];

  const ensure = (): string => {
    // Read the ref, not `codes` — `codes` can still be the pre-hydration `[]`
    // here even after localStorage has already been read, if this runs from
    // a mount-time effect in the same component (see useLocalState's doc
    // comment). The ref is always current, so this never mints a fresh key
    // over a real one just because hydration's re-render hasn't landed yet.
    const current = codesRef.current;
    if (current.length) return current[0];
    const c = mkCode();
    setCodes([c]);
    return c;
  };

  // `promote: true` makes `c` the primary key (codes[0]) — used when restoring
  // a key on a browser whose own default key never actually posted anything,
  // so "Your key" at the top of /mine matches the key that owns your stuff
  // instead of a blank auto-generated one nobody saved.
  const addCode = (c: string, promote = false) => {
    const current = codesRef.current;
    if (current.includes(c)) {
      if (promote && current[0] !== c) setCodes([c, ...current.filter((x) => x !== c)]);
      return;
    }
    setCodes(promote ? [c, ...current] : [...current, c]);
  };

  return { key: key || null, codes, ensure, addCode };
}
