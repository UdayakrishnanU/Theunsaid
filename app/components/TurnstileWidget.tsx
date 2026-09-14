"use client";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Turnstile."));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/** Renders nothing (and never blocks submission) when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set — see DEPLOY.md. */
export default function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    loadScript()
      .then(() => {
        if (!ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          // A token that expires (or a widget that errors) left the old
          // token cleared but the widget frozen in that state — a retried
          // submit kept failing Turnstile with no fresh challenge offered.
          // Resetting it re-arms the widget so the next attempt can pass.
          "expired-callback": () => {
            onToken(null);
            if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
          },
          "error-callback": () => {
            onToken(null);
            if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
          },
        });
      })
      .catch(() => onToken(null));
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} id={id} style={{ margin: "10px 0" }} />;
}
