export const metadata = { title: "Refund Policy — AnonVerdict" };

export default function RefundPage() {
  return (
    <div className="page">
      <h2>Refund Policy</h2>
      <p className="tldr">
        <strong>The short version.</strong> Every payment on this board is final. Posting, highlighting, and pinned-shelf bids are all
        non-refundable, no matter what happens after you pay. This is already stated in our <a href="/terms">Terms</a>; this page just spells it
        out on its own.
      </p>
      <p className="lastup">
        This policy is issued by <strong>AnonVerdict</strong>, registered address No. 36 Sivaraj Main Street, Puzhal, Chennai 600066, Tamil Nadu,
        India, the operator of <span className="ph">https://www.anonverdict.com</span>.
      </p>

      <h3>1. All sales are final</h3>
      <p>
        Once a payment goes through — for posting, for a 24-hour highlight, or for a pinned-shelf bid — it is not refunded. Not if you get
        outbid. Not if your post gets few or no votes. Not if you change your mind, delete the post, or simply regret it later. You can always
        delete your own post; the payment that placed it does not come back.
      </p>

      <h3>2. Why we don't do refunds</h3>
      <p>
        This is a digital, instant-delivery service — your payment buys immediate placement on the board, which is delivered the moment it
        clears. There is no physical good to return and no way to "undo" a post having been seen. The pinned shelf in particular works as a live
        auction: once you are outbid, the placement you paid for has already happened and moved on, the same way a winning auction bid isn't
        refunded because someone else later bid higher.
      </p>

      <h3>3. Genuine billing errors are different</h3>
      <p>
        If you were charged twice for the same action, charged the wrong amount because of a technical fault, or charged after a payment that
        should have failed, that is a billing error, not a refund request, and we want to fix it. Write to{" "}
        <span className="ph">contact@anonverdict.com</span> within 15 days of the charge with the approximate date, amount, and payment method
        used, and we will investigate and correct a genuine error.
      </p>

      <h3>4. Payment processing</h3>
      <p>
        Payments are processed by Razorpay. Any card, UPI, or other payment-method details you enter go directly to Razorpay and never touch our
        servers. If a charge looks wrong on your bank or card statement, you're welcome to raise it with us first — we would rather sort it out
        directly than have you go through a card dispute, which takes longer for everyone.
      </p>

      <h3>5. Chargebacks</h3>
      <p>
        Please contact us before filing a chargeback with your bank or card issuer. Most billing questions can be resolved directly and faster
        than a formal dispute, and a chargeback on a correctly processed payment does not change the fact that the placement was already
        delivered.
      </p>

      <h3>6. This policy will change</h3>
      <p>When it changes in a way that matters, we will say so on the board rather than quietly editing this page.</p>

      <h3>7. Governing law and grievance officer</h3>
      <p>
        This policy is governed by the laws of India, and any dispute is subject to the exclusive jurisdiction of the courts in Chennai, Tamil
        Nadu. For any refund or billing grievance, write to <span className="ph">contact@anonverdict.com</span> — our designated grievance
        contact under the Information Technology (Intermediaries Guidelines) Rules, 2011. We acknowledge within 24 hours and aim to resolve
        within 15 days.
      </p>

      <p className="lastup">
        Last updated: <span className="ph">September 12, 2026</span>
      </p>
    </div>
  );
}
