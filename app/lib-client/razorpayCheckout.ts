"use client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  onSuccess: () => void;
  onDismiss: () => void;
}): Promise<void> {
  await loadScript();
  if (!window.Razorpay) throw new Error("Razorpay failed to load.");
  // For INR orders, put UPI first (as its own block) ahead of Razorpay's
  // default method order, so Indian customers land straight on the UPI
  // screen — which itself auto-shows one-tap app icons (Google Pay, PhonePe,
  // etc, the "Intent" flow) on a real mobile browser, skipping an extra
  // click into a card/netbanking-first layout. Everything else (cards,
  // netbanking, wallets, EMI) still follows via show_default_blocks: true.
  // Non-INR orders keep Razorpay's default order, where card-based express
  // options (Apple Pay / Google Pay, once enabled on the account) surface on
  // their own with no config needed.
  const isInr = opts.currency === "INR";

  const rzp = new window.Razorpay({
    key: opts.keyId,
    amount: opts.amount,
    currency: opts.currency,
    name: opts.name,
    description: opts.description,
    order_id: opts.orderId,
    handler: () => opts.onSuccess(),
    modal: { ondismiss: () => opts.onDismiss() },
    theme: { color: "#171A21" },
    ...(isInr
      ? {
          config: {
            display: {
              blocks: {
                upiBlock: {
                  name: "Pay by UPI",
                  instruments: [{ method: "upi" }],
                },
              },
              sequence: ["block.upiBlock"],
              preferences: { show_default_blocks: true },
            },
          },
        }
      : {}),
  });
  rzp.open();
}
