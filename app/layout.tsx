import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Inter:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
