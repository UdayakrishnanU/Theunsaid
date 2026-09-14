// A database or upstream error's own message is meant for logs, not
// customers — it can name internal table/column details or (as with a
// misconfigured Razorpay key) literal environment-variable names. Log the
// real error server-side and hand back one generic, friendly message so a
// backend hiccup never reads like exposed internals.
export function friendlyError(context: string, error: unknown, fallback = "Something went wrong on our end — try again in a moment."): string {
  // eslint-disable-next-line no-console
  console.error(`[api:${context}]`, error);
  return fallback;
}
