"use client";
import { useCurrency } from "@/app/hooks/useCurrency";

export default function AboutPage() {
  const { def } = useCurrency();
  return (
    <div className="page">
      <h2>About</h2>
      <p>A public board for the two things nobody says out loud: what you have actually done, and what you cannot decide.</p>
      <p>
        No account. No name. Nothing tied back to you. Reading, voting and reacting are free — the only thing that costs money is putting
        something up.
      </p>
      <h3>Why posting costs money</h3>
      <p>
        A free anonymous board fills with noise inside a day — we have all seen it happen. A small fee means everything here was worth real money
        to somebody, which turns out to be an unreasonably good filter. It also keeps the lights on.
      </p>
      <div className="tt">
        <div className="tr" style={{ background: "#F7F7F5" }}>
          <span className="p">
            {def.sym}
            {def.post}
          </span>
          <span>
            <strong>Standard</strong>
            <span className="d">Onto the ranked board. Rises or falls on votes alone.</span>
          </span>
        </div>
        <div className="tr" style={{ background: "#F5F3FF", border: "1.5px solid #8B5CF6" }}>
          <span className="p" style={{ color: "#5B21B6" }}>
            {def.sym}
            {def.glow}
          </span>
          <span>
            <strong>Highlighted</strong>
            <span className="d">Its own glowing card above the board for 24 hours.</span>
          </span>
        </div>
        <div className="tr" style={{ background: "#FFF9EC", border: "1.5px solid #F59E0B" }}>
          <span className="p" style={{ color: "#92400E" }}>
            {def.sym}
            {def.pin}
          </span>
          <span>
            <strong>Pinned</strong>
            <span className="d">
              Bid for one of five shelf slots. The five highest bids hold the top for 24 hours. No upper limit, no refunds, and you can be
              outbid.
            </span>
          </span>
        </div>
      </div>
      <h3>If you&apos;re struggling</h3>
      <p>
        This board is not a support service, and a 72% majority is not care. If you&apos;re in a dark place, talk to someone who can actually
        help. <strong>findahelpline.com</strong> lists free, confidential crisis lines for almost every country. If you&apos;re in immediate
        danger, contact local emergency services.
      </p>
    </div>
  );
}
