"use client";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<{
        error?: { message?: string };
        redirect?: boolean;
        paymentDetails?: { paymentMessage?: string };
      }>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Cashfree) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Cashfree checkout."));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

// Cashfree's own hosted checkout decides which payment methods to show (UPI
// prioritized for INR via order_meta.payment_methods set at order-creation
// time — see lib/cashfree.ts). The SDK needs no client-exposed key at all —
// the payment_session_id is already scoped to exactly one order.
export async function openCashfreeCheckout(opts: {
  paymentSessionId: string;
  mode: "sandbox" | "production";
  orderId: string;
  onSuccess: (resp: { orderId: string }) => void;
  onDismiss: () => void;
  redirectTarget?: "_modal" | "_self" | "_blank";
}): Promise<void> {
  await loadScript();
  if (!window.Cashfree) throw new Error("Cashfree failed to load.");
  const cashfree = window.Cashfree({ mode: opts.mode });

  // On mobile devices, redirectTarget: "_self" is required for UPI Intent to
  // directly trigger native UPI apps (PhonePe, GPay, Paytm) without iframe
  // sandbox restrictions. On desktop, "_modal" displays the dynamic QR code scanner.
  const isMobile =
    typeof window !== "undefined" &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia("(max-width: 768px)").matches && "ontouchstart" in window));

  const target = opts.redirectTarget ?? (isMobile ? "_self" : "_modal");

  const result = await cashfree.checkout({
    paymentSessionId: opts.paymentSessionId,
    redirectTarget: target,
  });
  if (result?.error) {
    // Covers both "closed the modal" and an outright failed payment — no
    // charge went through, let the caller offer a retry.
    opts.onDismiss();
    return;
  }
  opts.onSuccess({ orderId: opts.orderId });
}
