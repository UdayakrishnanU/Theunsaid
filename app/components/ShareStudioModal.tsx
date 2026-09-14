"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  CardFormat,
  CardVariant,
  ShareCardData,
  generateShareCaption,
  preloadBrandLogo,
  renderShareCard,
} from "@/app/lib-client/shareCardCanvas";
import Logo from "./Logo";

interface ShareStudioModalProps {
  open: boolean;
  data: ShareCardData | null;
  initialVariant?: CardVariant;
  onClose: () => void;
}

const VARIANTS: { id: CardVariant; label: string; desc: string }[] = [
  {
    id: "curiosity",
    label: "Ask Friends (No Spoilers)",
    desc: "Hides results so friends vote with an open mind",
  },
  {
    id: "result",
    label: "The Verdict",
    desc: "Shows what the internet decided with full percentages",
  },
  {
    id: "personal",
    label: "How I Voted",
    desc: "Shows which side you picked to see if friends agree",
  },
  {
    id: "split",
    label: "50/50 Tie-Breaker",
    desc: "An exact tie — ask your friends to break it",
  },
  {
    id: "outcome",
    label: "The Update",
    desc: "Shares what actually happened and how the story ended",
  },
];

const FORMATS: { id: CardFormat; label: string; ratio: string }[] = [
  { id: "story", label: "Story (9:16)", ratio: "Instagram Stories, WhatsApp status" },
  { id: "feed", label: "Square / Feed (4:5)", ratio: "Instagram, Facebook posts" },
  { id: "og", label: "Banner / X (1.91:1)", ratio: "Twitter/X, WhatsApp chat previews" },
];

export default function ShareStudioModal({
  open,
  data,
  initialVariant = "curiosity",
  onClose,
}: ShareStudioModalProps) {
  const [variant, setVariant] = useState<CardVariant>(initialVariant);
  const [format, setFormat] = useState<CardFormat>("og");
  const [status, setStatus] = useState<string>("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (open) {
      const needsFallback = initialVariant === "outcome" && !(data?.outcome && data.outcome.trim().length > 0);
      setVariant(needsFallback ? "curiosity" : initialVariant);
      setStatus("");
    }
  }, [open, initialVariant, data]);

  // "Developer options" (copy raw caption text) is a debug affordance, not
  // something every visitor should see — only show it to whoever is signed
  // into /admin on this device.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/whoami")
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((j) => {
        if (!cancelled) setIsAdminUser(!!j.isAdmin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render canvas whenever variant, format, or data changes
  useEffect(() => {
    if (!open || !data || !canvasRef.current) return;
    let cancelled = false;
    async function render() {
      // Wait for both web fonts AND brand logo to be available
      await Promise.all([
        document.fonts.ready,
        preloadBrandLogo(),
      ]);
      if (cancelled || !canvasRef.current) return;
      try {
        renderShareCard(canvasRef.current, data!, variant, format);
      } catch (err) {
        console.error("Canvas render error:", err);
      }
    }
    // Do an immediate render (may use fallback fonts), then re-render after fonts load
    try {
      renderShareCard(canvasRef.current, data, variant, format);
    } catch (err) {
      console.error("Canvas render error:", err);
    }
    render();
    return () => { cancelled = true; };
  }, [open, data, variant, format]);

  if (!open || !data) return null;

  const hasOutcome = !!(data.outcome && data.outcome.trim().length > 0);

  const base =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1")
      ? window.location.origin
      : "https://www.anonverdict.com";
  const url = data.id ? `${base}/p/${data.id}` : `${base}/`;

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `anonverdict-${variant}-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      setStatus(format === "og" ? "PNG downloaded!" : "PNG downloaded! Includes scannable QR code.");
      setTimeout(() => setStatus(""), 3500);
    }, "image/png", 1.0);
  }

  async function handleSharePoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `anonverdict-${variant}-${format}.jpg`, { type: "image/jpeg" });
      const caption = generateShareCaption(data!, variant, url);

      // 1. Try native Web Share with file (Mobile Safari, Android Chrome, Mac Safari)
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "AnonVerdict",
            text: caption,
            files: [file],
          });
          setStatus("Poster shared successfully!");
          setTimeout(() => setStatus(""), 3500);
          return;
        } catch (err: unknown) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      // 2. Try native Web Share with URL (Desktop Chrome)
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "AnonVerdict",
            text: caption,
            url,
          });
          setStatus("Shared with direct link.");
          setTimeout(() => setStatus(""), 3500);
          return;
        } catch (err: unknown) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      // 3. Fallback: Save poster & copy direct link
      handleDownload();
      try {
        await navigator.clipboard.writeText(url);
        setStatus("Poster saved & link copied to clipboard!");
      } catch {
        setStatus("Poster saved to downloads!");
      }
      setTimeout(() => setStatus(""), 3500);
    }, "image/jpeg", 0.92);
  }

  async function handleShareWhatsApp() {
    if (!data) return;
    const canvas = canvasRef.current;
    if (canvas && typeof navigator !== "undefined" && navigator.canShare) {
      const caption = generateShareCaption(data, variant, url);
      const shared = await new Promise<boolean>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) return resolve(false);
          const file = new File([blob], `anonverdict-${variant}-${format}.jpg`, { type: "image/jpeg" });
          if (!navigator.canShare({ files: [file] })) return resolve(false);
          navigator
            .share({ title: "AnonVerdict", text: caption, files: [file] })
            .then(() => resolve(true))
            .catch((err: unknown) => resolve((err as Error)?.name === "AbortError"));
        }, "image/jpeg", 0.92);
      });
      if (shared) return;
    }
    // No file-sharing support here — grab the poster so there's still an
    // image to attach by hand, then open WhatsApp with the text + link.
    handleDownload();
    const text = `“${data.story}”\n\nVote anonymously here: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function handleShareTwitter() {
    if (!data) return;
    const summary = data.story.length > 120 ? data.story.slice(0, 117) + "..." : data.story;
    const text = `What would you do? “${summary}”\nVote anonymously:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Direct link copied to clipboard!");
      setTimeout(() => setStatus(""), 3500);
    } catch {
      setStatus("Failed to copy link.");
    }
  }

  async function handleCopyCaption() {
    if (!data) return;
    const caption = generateShareCaption(data, variant, url);
    try {
      await navigator.clipboard.writeText(caption);
      setStatus("Caption and link copied!");
      setTimeout(() => setStatus(""), 3500);
    } catch {
      setStatus("Failed to copy automatically.");
    }
  }

  return (
    <div className="share-modal-overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="share-modal-dialog" role="dialog" aria-modal="true">
        <header className="share-modal-header">
          <div className="share-modal-title">
            <Logo size={28} />
            <div>
              <h3>Share Card Studio</h3>
              <p>Posters with scannable QR code & direct website redirect</p>
            </div>
          </div>
          <button className="share-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="share-modal-body">
          {/* Controls column */}
          <div className="share-controls">
            <div className="share-control-group">
              <label className="share-label">1. Card Format</label>
              <div className="share-variant-grid">
                {VARIANTS.map((v) => {
                  const locked = v.id === "outcome" && !hasOutcome;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`share-variant-btn ${variant === v.id ? "active" : ""}${locked ? " locked" : ""}`}
                      onClick={() => { if (!locked) setVariant(v.id); }}
                      disabled={locked}
                      aria-disabled={locked}
                      title={locked ? "Unlocks once the outcome is posted" : undefined}
                    >
                      <strong>{v.label}</strong>
                      <span>{locked ? "Unlocks once the outcome is posted" : v.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="share-control-group">
              <label className="share-label">2. Aspect Ratio</label>
              <div className="share-format-grid">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`share-format-btn ${format === f.id ? "active" : ""}`}
                    onClick={() => setFormat(f.id)}
                  >
                    <strong>{f.label}</strong>
                    <span>{f.ratio}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="share-control-group">
              <label className="share-label">3. Share Poster</label>
              <div className="share-action-buttons">
                <button
                  type="button"
                  className="btn-share-primary"
                  onClick={handleSharePoster}
                >
                  <svg
                    className="share-btn-icon"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span>Share Poster</span>
                </button>

                <div className="share-quick-channels">
                  <button
                    type="button"
                    className="btn-quick-share"
                    onClick={handleShareWhatsApp}
                    title="Share to WhatsApp"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.44 19.65L5.27 16.61L5.08 16.31C4.24 14.98 3.8 13.46 3.8 11.91C3.8 7.37 7.5 3.67 12.04 3.67C14.24 3.67 16.31 4.53 17.86 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15Z"/>
                    </svg>
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="btn-quick-share"
                    onClick={handleShareTwitter}
                    title="Share on X"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>X (Twitter)</span>
                  </button>
                  <button
                    type="button"
                    className="btn-quick-share"
                    onClick={handleCopyLink}
                    title="Copy direct vote link"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy Link</span>
                  </button>
                  <button
                    type="button"
                    className="btn-quick-share"
                    onClick={handleDownload}
                    title="Save PNG image"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Save PNG</span>
                  </button>
                </div>
              </div>

              {status && <div className="share-status-toast">{status}</div>}

              {/* Developer options only — gated to signed-in admins, see the
                  effect above. */}
              {isAdminUser && (
                <details className="share-dev-drawer">
                  <summary className="share-dev-summary">Developer options</summary>
                  <button type="button" className="btn-share-dev" onClick={handleCopyCaption}>
                    Copy text caption
                  </button>
                </details>
              )}
            </div>
          </div>

          {/* Canvas Preview column */}
          <div className="share-preview-stage">
            <div className="share-canvas-container">
              <canvas
                ref={canvasRef}
                className={`share-canvas share-canvas-${format}`}
                aria-label="Generated share card preview"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
