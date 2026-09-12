export const metadata = { title: "Rules — The Unsaid" };

export default function RulesPage() {
  return (
    <div className="page">
      <h2>Rules</h2>
      <p>
        This is the only page here with no jokes in it. We tried. It kept sounding like we were kidding about the serious bits, and we are not.
      </p>

      <h3>What you can post</h3>
      <ul>
        <li>
          <strong>A confession.</strong> Something true about you that you have not said out loud.
        </li>
        <li>
          <strong>A dilemma.</strong> A real fork in your life. Two options. No sneaking in a third.
        </li>
      </ul>

      <h3>What comes down</h3>
      <ul>
        <li>
          Anything that identifies a real person — names, numbers, addresses, workplaces, handles, or the oddly specific café. If a stranger could
          work out who you mean and message them about it, rewrite it.
        </li>
        <li>Threats, harassment and slurs. There are entire websites for that. Go and be miserable there.</li>
        <li>Sexual content, and anything whatsoever involving minors. Removed instantly, permanently, no appeal.</li>
        <li>Links, promo codes, referral schemes, and your friend&apos;s startup. A board for people, not products.</li>
        <li>Anything illegal where you are, or where we are.</li>
      </ul>

      <h3>How ranking works</h3>
      <p>
        Rank is reactions plus votes, weighted towards whatever is fresh. Paying moves your post up the page. It does not buy you a single vote,
        reaction, or place in Trending — those are earned or they are nothing. A board where money buys applause is a board nobody believes, and we
        would rather have the board.
      </p>
      <p>
        The pinned shelf is an auction. Five slots, highest bids hold them, no upper limit, no refunds. Someone can outbid you while you are still
        admiring your own post. That is not a bug. That is an auction.
      </p>

      <h3>Reporting</h3>
      <p>Every post has a Report button. Press it and a human looks — an actual one, not a sorting algorithm having a guess.</p>
      <p>
        Posts that break the rules come down and stay down, and nobody gets refunded, because the fee bought placement and not immunity. Posts
        that are merely uncomfortable stay up. &ldquo;I did not enjoy reading that&rdquo; is not a rule violation. It is, frankly, most of the
        website.
      </p>

      <h3>One last thing</h3>
      <p>
        Be the kind of stranger you would want voting on your life at 2am. That is the whole spirit of the place, and it covers roughly everything
        the list above forgot.
      </p>
    </div>
  );
}
