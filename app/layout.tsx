import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "The Unsaid — anonymous confessions, settled by strangers",
  description: "Post a confession, or hand strangers a decision you're stuck on and let them settle it. Anonymous, always.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <p className="sr" id="live" role="status" aria-live="polite" />
        <div className="wrap">
          <Nav />
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
