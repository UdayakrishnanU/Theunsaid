import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

// This file is the single hard blocker the prep doc calls out: "a UPI link
// tells your site nothing, so today anyone can click 'Pay and post' without
// paying." A post is only ever marked `live` from the webhook handler after
// this signature check passes — never from the client.

function client(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. See DEPLOY.md.");
  }
  return new Razorpay({ key_id, key_secret });
}

/** amountMinor: integer in the smallest unit of `currency` (paise for INR, cents for USD, etc). */
export async function createOrder(amountMinor: number, currency: string, receipt: string, notes: Record<string, string>) {
  const rp = client();
  return rp.orders.create({
    amount: amountMinor,
    currency,
    receipt,
    notes,
  });
}

/** Verifies the `X-Razorpay-Signature` header on a webhook payload against
 * RAZORPAY_WEBHOOK_SECRET (set separately from the API key/secret, in the
 * Razorpay dashboard's Webhooks section). Never trust a webhook without this. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc — definitely not equal
  }
}

/** Verifies the signature returned to the browser after Razorpay Checkout
 * completes (order_id|payment_id signed with the key secret). This is a
 * convenience check only — the webhook above is the authoritative one,
 * because this client-reported signature can be replayed or skipped by a
 * modified client. Post state must only ever flip to `live` via the webhook. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) return false;
  const expected = createHmac("sha256", key_secret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
