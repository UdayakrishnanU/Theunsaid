import type { Metadata } from "next";
import { Inter, Newsreader, Caveat } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const SITE_TITLE = "AnonVerdict — anonymous confessions, settled by strangers";
const SITE_DESCRIPTION =
  "Post a confession, or hand strangers a decision you're stuck on and let them settle it. Anonymous, always.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.anonverdict.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "AnonVerdict",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://www.anonverdict.com",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${caveat.variable}`}>
      <body>
        <p className="sr" id="live" role="status" aria-live="polite" />
        <Nav />
        <div className="wrap">
          {children}
          <div className="ticker" aria-hidden="true">
            <div className="tick-track" />
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
