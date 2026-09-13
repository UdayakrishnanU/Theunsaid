"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const LINKS: [string, string, boolean?][] = [
  ["/", "Board"],
  ["/rules", "Rules", true],
  ["/mine", "My posts"],
  ["/about", "About", true],
];

export default function Nav() {
  const pathname = usePathname();

  function triggerPostModal() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-post-modal"));
    }
  }

  return (
    <header className="site-header-wrap">
      <div className="site-header-inner">
        <div className="top">
          <Link href="/" className="brand-link" aria-label="AnonVerdict Home">
            <Logo size={28} color="var(--ink)" />
            <span className="brand">AnonVerdict</span>
          </Link>
          <nav className="topnav">
            {LINKS.map(([href, label, secondary]) => (
              <Link
                key={href}
                href={href}
                className={"tl" + (pathname === href ? " on" : "") + (secondary ? " tl-secondary" : "")}
              >
                {label}
              </Link>
            ))}
            <button type="button" className="nav-post-cta" onClick={triggerPostModal}>
              <span className="nav-cta-long">Get my verdict — ₹29</span>
              <span className="nav-cta-short">Verdict — ₹29</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
