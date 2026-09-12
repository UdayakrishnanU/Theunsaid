export const metadata = { title: "Terms of Service — The Unsaid" };

// Ported verbatim from unsaid-v30.html. Contact email and last-updated date
// are filled in below; have a lawyer review this page before relying on it
// (see DEPLOY.md, "Legal" section).
export default function TermsPage() {
  return (
    <div className="page">
      <h2>Terms of Service</h2>
      <p className="tldr">
        <strong>The short version.</strong> You pay to post. Strangers read it and vote. Nobody learns your name. Don&apos;t post anything that
        could identify a real person, and don&apos;t be a monster. That is genuinely most of it. The rest is below, and it is shorter than the
        terms of the app you used to order lunch.
      </p>

      <h3>1. What this is</h3>
      <p>
        A public board for anonymous confessions and two-option dilemmas. Reading, voting and reacting are free. Posting costs money. That is the
        entire business model — no ads, no selling your data, no mysterious third parties with a legitimate interest in your heartbreak.
      </p>

      <h3>2. You have to be 18</h3>
      <p>If you are not, this is not for you. Go and have the kind of problems you can still tell people about.</p>

      <h3>3. The money</h3>
      <ul>
        <li>Posting costs the standard fee shown on the board in your currency.</li>
        <li>Highlighting lifts it above the board for 24 hours.</li>
        <li>The pinned shelf is an auction. The five highest live bids hold it.</li>
        <li>
          Prices differ by country because payment fees do. A small card payment costs us far more to process than a local instant transfer, and
          the price reflects that rather than hiding it.
        </li>
        <li>
          There is no upper limit on bids. Someone can outbid you four minutes after you pay. That is not a bug, that is the entire point of an
          auction.
        </li>
      </ul>
      <p>
        <strong>Nothing is refundable.</strong> Not if you get outbid. Not if nobody votes. Not if you re-read your confession at 2am and feel
        differently about it. You can delete the post; the money has already gone.
      </p>
      <p>
        Paying moves your post <em>up the page</em>. It does not buy votes, reactions, or a place in Trending. Those are earned or they are
        nothing, and a board where money buys applause is a board nobody believes.
      </p>

      <h3>4. Your post is your responsibility</h3>
      <p>
        Anonymous to readers is not the same as anonymous to a court. If you defame someone, that is your problem and eventually ours, and we will
        hand over what we hold when legally required to. Write about your own life, not someone else&apos;s.
      </p>

      <h3>5. What comes down, no discussion</h3>
      <ul>
        <li>Anything identifying a real person — names, numbers, addresses, workplaces, handles, photos.</li>
        <li>Threats, harassment, and slurs.</li>
        <li>Sexual content, and absolutely anything involving minors.</li>
        <li>Links, referral codes, promos, advertising. This is a board for people, not products.</li>
        <li>Anything illegal where you are, or where we are. We are not the venue for your side hustle.</li>
      </ul>

      <h3>6. What happens when you break that</h3>
      <p>
        Reported posts get looked at by a person. If it broke the rules it stays down and you are not refunded — the fee bought placement, not
        immunity. Do it repeatedly and you are done here.
      </p>

      <h3>7. Your key</h3>
      <p>
        We give you one key. Every post you make carries it, and entering it on another device brings all of them back. It is the only proof that
        any of it is yours.
      </p>
      <p>
        <strong>We cannot recover it.</strong> Not by email, because we do not have yours. Not by verifying your identity, because we never
        learned it. That is not poor service, it is the thing you came here for. Anyone holding it controls every post you have made, so treat it
        like a password, not a username.
      </p>

      <h3>8. What we actually keep</h3>
      <p>
        Publicly: nothing about you. Privately: the IP address and timestamp attached to each post, and a record of your payment. The law requires
        the first and our payment provider requires the second. It is not sold, not published, and not handed to anyone without a valid legal
        order.
      </p>

      <h3>9. We are not a support service</h3>
      <p>
        Strangers voting on your life is entertainment. It is not therapy, legal advice, medical advice, or financial advice, and you should not
        treat a 72% majority as a decision. If you are in a genuinely dark place, please talk to someone who can help —{" "}
        <strong>findahelpline.com</strong> lists free, confidential crisis lines for almost every country, and they are open right now.
      </p>

      <h3>10. It might break</h3>
      <p>
        This is a website run by a person, not a data centre with a support desk. It may go down, lose its temper, or briefly display something in
        the wrong colour. We provide it as it is, and our liability to you is capped at what you actually paid us.
      </p>

      <h3>11. These terms will change</h3>
      <p>When they change in a way that matters, we will say so on the board rather than quietly editing this page at midnight.</p>

      <h3>12. How to complain</h3>
      <p>
        If something here has gone wrong — a post about you, a payment that misfired, anything — write to{" "}
        <span className="ph">contact@anonverdict.com</span>. A real person reads it. We acknowledge within 24 hours and aim to resolve within 15 days.
      </p>
      <p>
        These terms are governed by the laws that apply where this service is operated, and by the rules of the place you are reading from where
        those give you rights we cannot sign away. Nothing here removes a protection your local law gives you as a consumer.
      </p>
      <p className="lastup">
        Last updated: <span className="ph">September 12, 2026</span>
      </p>
    </div>
  );
}
