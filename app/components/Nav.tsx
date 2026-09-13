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
          </nav>
        </div>
      </div>
    </header>
  );
}
