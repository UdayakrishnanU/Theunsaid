export const metadata = { title: "Privacy Policy — AnonVerdict" };

export default function PrivacyPage() {
  return (
    <div className="page">
      <h2>Privacy Policy</h2>
      <p className="tldr">
        <strong>The short version.</strong> We don't want your identity, and we don't collect one. No accounts, no names, no ads, no tracking for
        marketing. We keep the bare minimum needed to run the board, take payments, and stop abuse, and nothing else.
      </p>
      <p className="lastup">
        This policy is issued by <strong>AnonVerdict</strong>, registered address No. 36 Sivaraj Main Street, Puzhal, Chennai 600066, Tamil Nadu,
        India, the operator of <span className="ph">https://www.anonverdict.com</span>. We do not offer services outside India, and your data is
        stored and processed in India.
      </p>

      <h3>1. What we collect</h3>
      <ul>
        <li>
          <strong>The IP address and timestamp of each post.</strong> Kept privately, never shown publicly, and used only to prevent abuse and to
          respond to a valid legal request.
        </li>
        <li>
          <strong>A record of your payment</strong> — amount, currency, and status — created by our payment provider when you pay to post,
          highlight, or bid on the pinned shelf.
        </li>
        <li>
          <strong>Your currency selection</strong>, remembered locally in your browser so the board shows prices in the currency you picked.
        </li>
        <li>
          <strong>Basic, non-identifying usage counts</strong> — how many posts exist, how many votes were cast, how many people are around
          today — shown on the board itself. These are aggregate numbers, not a record of any one person's activity.
        </li>
        <li>
          <strong>Anything you volunteer</strong> if you email us — for example your email address and whatever you write, so we can reply.
        </li>
      </ul>

      <h3>2. What we don't collect</h3>
      <p>
        No account, no sign-up, no name, no phone number, no email address, unless you choose to write to us directly. No advertising cookies, no
        cross-site tracking, no analytics that build a profile of you. We do not sell data, because we do not have data worth selling — we sell
        placement on a board, not people.
      </p>

      <h3>3. Your key</h3>
      <p>
        Posting gives you a private key, not an account. The key is the only link between you and your posts — we do not tie it to your name,
        email, or IP for the purpose of showing it to anyone. If you lose it, we cannot recover it, because we never stored anything that could
        prove it was yours in the first place.
      </p>

      <h3>4. Who else touches your data</h3>
      <p>We use a small number of service providers to run this site, each only for what they need to do their job:</p>
      <ul>
        <li>
          <strong>Supabase</strong> hosts our database — posts, votes, and the private records described above.
        </li>
        <li>
          <strong>Razorpay</strong> processes all payments. Card, UPI, and other payment details are handled entirely by Razorpay; we only
          receive confirmation that a payment succeeded, not your payment credentials.
        </li>
      </ul>
      <p>We do not hand data to anyone else, and we do not allow these providers to use it for their own marketing.</p>

      <h3>5. Cookies and local storage</h3>
      <p>
        We use your browser's local storage for small, functional things only — your currency choice and a rough visitor count for the day.
        Nothing here is used to advertise to you or to follow you across other websites.
      </p>

      <h3>6. How long we keep it</h3>
      <p>
        Posts and votes stay on the board according to the board's own rules, not this policy. Private records — IP addresses and payment
        records — are kept only as long as needed for abuse-prevention and legal or accounting requirements, then deleted.
      </p>

      <h3>7. Your rights</h3>
      <p>
        Because posts aren't tied to an identity, we usually cannot look up "your" data without your key. If you write to us at{" "}
        <span className="ph">contact@anonverdict.com</span> we will act on any reasonable request — for example, to delete a post you can prove
        is yours, or to tell you what private data we hold tied to an IP address you provide.
      </p>

      <h3>8. Children</h3>
      <p>This board is for adults 18 and over. We do not knowingly collect data from anyone under 18.</p>

      <h3>9. Security</h3>
      <p>
        We take reasonable technical steps to keep the data described above secure, but no system is perfectly secure, and we cannot guarantee
        absolute protection against every possible attack.
      </p>

      <h3>10. International use</h3>
      <p>
        This board is used from many countries, and the providers above may process data in locations other than your own. By using the board
        you understand your data may be handled outside your country, under the safeguards those providers themselves put in place.
      </p>

      <h3>11. Changes to this policy</h3>
      <p>When this policy changes in a way that matters, we will say so on the board rather than quietly editing this page.</p>

      <h3>12. Grievance officer and governing law</h3>
      <p>
        Questions about privacy, or a request about your data, go to <span className="ph">contact@anonverdict.com</span> — our designated
        grievance contact under the Information Technology (Intermediaries Guidelines) Rules, 2011. A real person reads it, we acknowledge within
        24 hours, and aim to resolve within 15 days.
      </p>
      <p>
        This policy is governed by the laws of India, and any dispute is subject to the exclusive jurisdiction of the courts in Chennai, Tamil
        Nadu.
      </p>

      <p className="lastup">
        Last updated: <span className="ph">September 12, 2026</span>
      </p>
    </div>
  );
}
