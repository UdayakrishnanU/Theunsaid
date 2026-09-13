"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/", "Board"],
  ["/rules", "Rules"],
  ["/mine", "My posts"],
  ["/about", "About"],
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="top">
      <span className="brand">AnonVerdict</span>
      <nav className="topnav">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={"tl" + (pathname === href ? " on" : "")}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
