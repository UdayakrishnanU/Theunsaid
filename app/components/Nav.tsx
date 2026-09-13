"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const LINKS: [string, string][] = [
  ["/", "Board"],
  ["/rules", "Rules"],
  ["/mine", "My posts"],
  ["/about", "About"],
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
      <div className="top">
        <Link href="/" className="brand-link">
          <Logo size={28} color="var(--ink)" />
          <span className="brand">AnonVerdict</span>
        </Link>
        <nav className="topnav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={"tl" + (pathname === href ? " on" : "")}>
              {label}
            </Link>
          ))}
          <button type="button" className="nav-post-cta" onClick={triggerPostModal}>
            Get my verdict — ₹29
          </button>
        </nav>
      </div>
    </header>
  );
}
