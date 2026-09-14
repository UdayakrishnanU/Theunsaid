"use client";
import { useEffect, useRef, useState } from "react";

/** Minimal localStorage-backed state, SSR-safe (starts at `initial`, hydrates
 * from storage on mount).
 *
 * Also returns a ref that mirrors the current value and — unlike the state
 * value itself — is up to date the instant hydration runs, not just after
 * the re-render it schedules. Callers that need to make a decision inside
 * another effect registered in the same component (e.g. "do we already have
 * a value, or should we create one?") should read the ref, not the state:
 * two `useEffect(() => {...}, [])`s in one component both run during the
 * same initial commit, so a later one still closes over the *pre-hydration*
 * state value even though an earlier one already called setValue — the
 * state update is real but its new closure isn't visible until the next
 * render. The ref has no such delay. See useOwnerKey's `ensure()`, whose old
 * mount-time-effect version this fixes: it used to see `codes: []` on every
 * fresh `/mine` load and mint a brand new key, silently discarding whatever
 * key (and posts/votes/reactions) the visitor actually had. */
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void, React.MutableRefObject<T>] {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        ref.current = parsed;
        setValue(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (v: T) => {
    ref.current = v;
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };
  return [value, set, ref];
}
