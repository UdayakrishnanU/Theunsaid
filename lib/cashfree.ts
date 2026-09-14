import { createHmac, timingSafeEqual } from "crypto";

// Sole payment gateway for AnonVerdict. Non-negotiable rule: a post only
// ever goes `live` via markOrderPaid(), reached from the webhook below or
// from the signed-off-server confirm route — never from anything the client
// alone reports.

const API_VERSION = "2025-01-01";

function baseUrl(): string {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export function cashfreeMode(): "sandbox" | "production" {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function creds(): { appId: string; secret: string } {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) {
    throw new Error("CASHFREE_APP_ID / CASHFREE_SECRET_KEY are not set. See DEPLOY.md.");
  }
  return { appId, secret };
}

function headers(): Record<string, string> {
  const { appId, secret } = creds();
  return {
    "x-client-id": appId,
    "x-client-secret": secret,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
  };
}

/** amountMinor: integer in the smallest unit of `currency` (paise for INR,
 * cents for USD, etc) — same convention every other call site in the app
 * uses. Cashfree's own API wants a decimal major-unit amount, converted here
 * so nothing upstream has to know that. */
export async function createOrder(
  amountMinor: number,
  currency: string,
  orderId: string,
  notes: Record<string, string>
): Promise<{ id: string; cfOrderId: string; paymentSessionId: string }> {
  const isInr = currency === "INR";
  // Production must never fall through to a raw *.vercel.app deployment
  // URL — Cashfree's checkout redirects the payer's browser here right
  // after payment, and a bare Vercel domain instead of the app's own
  // /mine success screen breaks the post-payment owner-key/share-card
  // flow entirely. VERCEL_URL is only trusted on non-production
  // deployments (previews), where it's actually the right target.
  const siteUrl = (() => {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" && process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return "https://www.anonverdict.com";
  })();

  const res = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Math.round(amountMinor) / 100,
      order_currency: currency,
      customer_details: {
        // AnonVerdict never collects a real name or phone number from
        // anyone — Cashfree requires *some* customer_id/customer_phone on
        // every order, so these are fixed placeholders, not real payer
        // data, and don't limit which payment method the payer actually
        // uses (UPI apps, cards, Apple Pay once enabled, all work the same).
        customer_id: orderId,
        customer_phone: "9999999999",
      },
      order_meta: {
        // Cashfree's checkout screen prioritizes UPI for INR orders and
        // displays top UPI apps (PhonePe, GPay, Paytm) for 1-tap intent.
        ...(isInr
          ? {
              payment_methods: "upi,cc,dc,nb,app,paylater,emi",
              upi_app_priority: ["phonepe", "gpay", "paytm", "cred", "bhim", "amazonpay"],
            }
          : {}),
        return_url: `${siteUrl}/mine?cf_order_id={order_id}`,
        notify_url: `${siteUrl}/api/cashfree/webhook`,
      },
      ...(notes.tier ? { order_note: `tier:${notes.tier}` } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.message || data.code)) || `Cashfree order creation failed (${res.status})`);
  }
  return { id: orderId, cfOrderId: data.cf_order_id, paymentSessionId: data.payment_session_id };
}

/** Server-to-server lookup of whether an order actually has a successful
 * payment against it, and that payment's Cashfree id — used by the instant
 * client-side confirm route instead of a client-supplied signature, since
 * Cashfree's checkout SDK doesn't hand one back the way Razorpay's does.
 * Just as trustworthy: it's our secret key talking directly to Cashfree. */
export async function getOrderPaymentStatus(orderId: string): Promise<{ paid: boolean; paymentId: string | null }> {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}/payments`, {
    method: "GET",
    headers: headers(),
  });
  if (!res.ok) return { paid: false, paymentId: null };
  const payments = await res.json().catch(() => null);
  if (!Array.isArray(payments)) return { paid: false, paymentId: null };
  const success = payments.find((p: { payment_status?: string }) => p.payment_status === "SUCCESS");
  return success ? { paid: true, paymentId: String((success as { cf_payment_id: unknown }).cf_payment_id) } : { paid: false, paymentId: null };
}

/** Verifies the `x-webhook-signature` header: base64(HMAC-SHA256(timestamp +
 * rawBody, CASHFREE_SECRET_KEY)). Cashfree signs webhooks with the same
 * client secret used for API calls — there's no separate webhook secret to
 * configure, unlike Razorpay. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  if (!signature || !timestamp) return false;
  const { secret } = creds();
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc — definitely not equal
  }
}
