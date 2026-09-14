import QRCode from "qrcode";

export interface ShareCardData {
  id?: string;
  category: string;
  story: string;
  optionA: string;
  optionB: string;
  pctA: number; // 0 to 100
  votes: number;
  outcome?: string;
  votedSide?: "a" | "b";
}

export type CardVariant = "curiosity" | "result" | "personal" | "split" | "outcome";
export type CardFormat = "story" | "feed" | "og";

export const CARD_SIZES: Record<CardFormat, [number, number]> = {
  og: [1200, 630],
  feed: [1080, 1350],
  story: [1080, 1920],
};

export const CARD_COLORS = {
  ink: "#141712",
  muted: "#697066",
  line: "#DFE4DA",
  paper: "#FAF9F5",
  surface: "#FFFFFF",
  soft: "#F3F5EE",
  lime: "#B8FF4F",
  limeInk: "#2D4E0A",
  coral: "#FF705E",
  blue: "#5E81F4",
  warm: "#F7F3E9",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string | null,
  stroke?: string | null,
  lineWidth = 2
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  maxLines = 99
): string[] {
  ctx.font = font;
  const words = (text || "").trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? currentLine + " " + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number,
  weight = 800,
  family = "Newsreader, Georgia, serif",
  maxLines = 99
) {
  for (let size = startSize; size >= minSize; size -= 2) {
    const font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, text, maxWidth, font, maxLines);
    const lh = size * 1.15;
    if (lines.length * lh <= maxHeight) {
      return { font, lines, lh, size };
    }
  }
  const font = `${weight} ${minSize}px ${family}`;
  return {
    font,
    lines: wrapLines(ctx, text, maxWidth, font, maxLines),
    lh: minSize * 1.15,
    size: minSize,
  };
}

function drawBlockText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number,
  color: string,
  weight = 800,
  family = "Newsreader, Georgia, serif",
  maxLines = 99
): number {
  const r = fitText(ctx, text, maxWidth, maxHeight, startSize, minSize, weight, family, maxLines);
  ctx.font = r.font;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  for (const line of r.lines) {
    ctx.fillText(line, x, y);
    y += r.lh;
  }
  return y;
}

// Cached raster brand mark (public/anonverdict-logo.png). Loads once and is
// reused for every card; falls back to the plain vector shield while it's
// still loading so a card is never rendered blank.
let brandLogoImg: HTMLImageElement | null = null;
let brandLogoLoaded = false;

function getLoadedBrandLogo(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!brandLogoImg) {
    brandLogoImg = new window.Image();
    brandLogoImg.src = "/anonverdict-logo.png";
    brandLogoImg.onload = () => {
      brandLogoLoaded = true;
    };
  }
  return brandLogoLoaded ? brandLogoImg : null;
}

// Kicks off (or waits for) the logo image load; resolves once it's ready to
// draw so callers can re-render the canvas with the real mark instead of
// the vector placeholder.
export function preloadBrandLogo(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (brandLogoLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (!brandLogoImg) {
      brandLogoImg = new window.Image();
      brandLogoImg.src = "/anonverdict-logo.png";
    }
    brandLogoImg.addEventListener(
      "load",
      () => {
        brandLogoLoaded = true;
        resolve();
      },
      { once: true }
    );
    brandLogoImg.addEventListener("error", () => resolve(), { once: true });
  });
}

// Draw the brand mark: the real logo once loaded, otherwise the plain
// Shield + Gavel + Arrow vector shape as a placeholder.
function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const img = getLoadedBrandLogo();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
    return;
  }

  const s = size / 120;
  ctx.save();
  ctx.translate(x, y);

  ctx.strokeStyle = CARD_COLORS.ink;
  ctx.fillStyle = CARD_COLORS.ink;
  ctx.lineWidth = 6 * s;
  ctx.lineJoin = "round";

  // Outer shield contour
  ctx.beginPath();
  ctx.moveTo(60 * s, 6 * s);
  ctx.lineTo(98 * s, 22 * s);
  ctx.bezierCurveTo(98 * s, 52 * s, 82 * s, 86 * s, 60 * s, 108 * s);
  ctx.bezierCurveTo(38 * s, 86 * s, 22 * s, 52 * s, 22 * s, 22 * s);
  ctx.closePath();
  ctx.stroke();

  // Left 'A' leg
  ctx.beginPath();
  ctx.moveTo(48 * s, 28 * s);
  ctx.lineTo(30 * s, 82 * s);
  ctx.lineTo(42 * s, 82 * s);
  ctx.lineTo(48 * s, 64 * s);
  ctx.lineTo(58 * s, 48 * s);
  ctx.closePath();
  ctx.fill();

  // Gavel handle
  ctx.beginPath();
  ctx.moveTo(38 * s, 68 * s);
  ctx.lineTo(70 * s, 42 * s);
  ctx.lineTo(66 * s, 38 * s);
  ctx.lineTo(34 * s, 64 * s);
  ctx.closePath();
  ctx.fill();

  // Gavel hammer head
  ctx.save();
  ctx.translate(73 * s, 34 * s);
  ctx.rotate((40 * Math.PI) / 180);
  roundRect(ctx, -9 * s, -6 * s, 18 * s, 12 * s, 3 * s, CARD_COLORS.ink);
  ctx.restore();

  // 'V' right arm
  ctx.beginPath();
  ctx.moveTo(46 * s, 76 * s);
  ctx.lineTo(60 * s, 92 * s);
  ctx.lineTo(76 * s, 56 * s);
  ctx.lineTo(68 * s, 52 * s);
  ctx.lineTo(60 * s, 74 * s);
  ctx.lineTo(52 * s, 64 * s);
  ctx.closePath();
  ctx.fill();

  // Arrowhead pointing upward
  ctx.beginPath();
  ctx.moveTo(82 * s, 24 * s);
  ctx.lineTo(96 * s, 46 * s);
  ctx.lineTo(82 * s, 44 * s);
  ctx.lineTo(78 * s, 52 * s);
  ctx.lineTo(72 * s, 38 * s);
  ctx.lineTo(84 * s, 38 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ISO/IEC 18004 Compliant Scannable QR Code (guaranteed 4-module quiet zone & pure black/white contrast)
function drawQRCode(
  ctx: CanvasRenderingContext2D,
  url: string,
  boxX: number,
  boxY: number,
  boxSize: number
) {
  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    const moduleCount = qr.modules.size;
    // Quiet zone: strictly at least 4 modules according to ISO/IEC 18004
    const marginModules = 4;
    const totalModules = moduleCount + marginModules * 2;
    const cellSize = Math.floor(boxSize / totalModules);
    const actualSize = cellSize * totalModules;
    const offset = Math.floor((boxSize - actualSize) / 2);

    // 1. Solid pure white background with subtle border outside the quiet zone
    roundRect(ctx, boxX, boxY, boxSize, boxSize, 14, "#FFFFFF", "#DFE4DA", 1.2);

    // 2. Pure pitch-black (#000000) modules with pixel-perfect integer alignment
    ctx.fillStyle = "#000000";
    const originX = boxX + offset + marginModules * cellSize;
    const originY = boxY + offset + marginModules * cellSize;

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          ctx.fillRect(
            originX + c * cellSize,
            originY + r * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }
  } catch (e) {
    console.error("QR Code error:", e);
  }
}

function drawQRCalloutBox(
  ctx: CanvasRenderingContext2D,
  w: number,
  p: number,
  y: number,
  boxH: number,
  s: number,
  postUrl: string,
  kicker: string,
  subtitle: string,
  badgeText: string,
  qrSize: number
) {
  // Container box
  roundRect(ctx, p, y, w - 2 * p, boxH, 22 * s, "#FFFFFF", CARD_COLORS.line, 1.2);

  const textX = p + 26 * s;
  const qrX = w - p - qrSize - 20 * s;
  const maxTextW = qrX - textX - 16 * s;

  // Kicker
  ctx.font = `900 ${15 * s}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = CARD_COLORS.coral;
  ctx.fillText(kicker, textX, y + 24 * s);

  // Subtitle
  ctx.font = `600 ${13.5 * s}px Inter, system-ui, sans-serif`;
  drawBlockText(
    ctx,
    subtitle,
    textX,
    y + 50 * s,
    maxTextW,
    55 * s,
    14 * s,
    11 * s,
    CARD_COLORS.muted,
    550,
    "Inter, system-ui, sans-serif",
    2
  );

  // Stats badge
  if (badgeText) {
    const badgeY = y + boxH - 42 * s;
    ctx.font = `800 ${12 * s}px Inter, system-ui, sans-serif`;
    const bw = ctx.measureText(badgeText).width + 24 * s;
    roundRect(ctx, textX, badgeY, bw, 28 * s, 14 * s, CARD_COLORS.soft);
    ctx.fillStyle = CARD_COLORS.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, textX + 12 * s, badgeY + 14 * s);
    ctx.textBaseline = "top";
  }

  // QR Code on the right
  const qrY = y + Math.floor((boxH - qrSize) / 2);
  drawQRCode(ctx, postUrl, qrX, qrY, qrSize);
}

function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  w: number,
  p: number,
  s: number,
  category: string
) {
  // Draw the custom shield logo (plain, no black box)
  drawBrandLogo(ctx, p, p, 48 * s);

  // Brand text
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = CARD_COLORS.ink;
  ctx.font = `900 ${22 * s}px Inter, system-ui, sans-serif`;
  ctx.fillText("anonverdict", p + 60 * s, p + 4 * s);

  ctx.font = `600 ${13 * s}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = CARD_COLORS.muted;
  ctx.fillText("Let strangers decide.", p + 60 * s, p + 29 * s);

  // Category Pill
  const tag = (category || "DILEMMA").toUpperCase();
  ctx.font = `800 ${12 * s}px Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(tag).width + 30 * s;
  const pillX = Math.max(p + 150 * s, w - p - tw);
  roundRect(ctx, pillX, p + 6 * s, tw, 40 * s, 20 * s, CARD_COLORS.soft, CARD_COLORS.line, 1);
  ctx.fillStyle = "#4A5243";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, pillX + tw / 2, p + 26 * s);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  s: number,
  text = "anonverdict.com • Vote to reveal the crowd"
) {
  const lineY = h - p - 36 * s;
  ctx.strokeStyle = CARD_COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p, lineY);
  ctx.lineTo(w - p, lineY);
  ctx.stroke();

  ctx.font = `600 ${14 * s}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = CARD_COLORS.muted;
  ctx.textBaseline = "middle";
  ctx.fillText(text, p, h - p - 16 * s);

  ctx.textAlign = "right";
  ctx.font = `800 ${13.5 * s}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = CARD_COLORS.limeInk;
  ctx.fillText("ASK ANONYMOUSLY →", w - p, h - p - 16 * s);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

function drawOptionPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  label: string,
  letter: string,
  accent: string,
  filled = false
) {
  roundRect(
    ctx,
    x,
    y,
    w,
    h,
    18 * s,
    filled ? CARD_COLORS.ink : CARD_COLORS.surface,
    filled ? null : CARD_COLORS.line,
    1.5
  );
  roundRect(ctx, x + 14 * s, y + 13 * s, 34 * s, 34 * s, 10 * s, accent);
  ctx.font = `900 ${15 * s}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = CARD_COLORS.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, x + 31 * s, y + 30 * s);

  ctx.textAlign = "left";
  ctx.fillStyle = filled ? "#FFFFFF" : CARD_COLORS.ink;
  ctx.font = `700 ${16 * s}px Inter, system-ui, sans-serif`;
  ctx.fillText((label || "").slice(0, 42), x + 62 * s, y + h / 2);
  ctx.textBaseline = "top";
}

export function renderShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  variant: CardVariant,
  format: CardFormat
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const [w, h] = CARD_SIZES[format];
  canvas.width = w;
  canvas.height = h;
  const s = w / 1200;
  const p = 60 * s;

  // Clear & background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = CARD_COLORS.paper;
  ctx.fillRect(0, 0, w, h);

  // Soft ambient radial orbs
  ctx.fillStyle = "rgba(94, 129, 244, 0.07)";
  ctx.beginPath();
  ctx.arc(w * 0.92, h * 0.08, 210 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 112, 94, 0.06)";
  ctx.beginPath();
  ctx.arc(w * 0.06, h * 0.86, 190 * s, 0, Math.PI * 2);
  ctx.fill();

  drawBrandHeader(ctx, w, p, s, data.category);

  const story = data.story || "We've fought about the same in-laws argument for 4 years...";
  const a = data.optionA || "Compromise now";
  const b = data.optionB || "Stand your ground";
  const pct = Math.max(0, Math.min(100, Math.round(data.pctA)));
  const other = 100 - pct;
  const votes = Math.max(0, data.votes || 0);
  const outcome = data.outcome || "No outcome shared yet.";

  // Use real public production URL so physical phone cameras scan and open properly
  const base =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1")
      ? window.location.origin
      : "https://www.anonverdict.com";
  const postUrl = data.id ? `${base}/#p=${data.id}` : `${base}/`;

  const contentTop = 138 * s;
  const footerLineY = h - p - 36 * s;
  const contentBottom = footerLineY - 24 * s;
  const availHeight = contentBottom - contentTop;

  // -------------------------------------------------------------
  // 1. CURIOSITY VARIANT (Ask Friends / No Spoilers)
  // -------------------------------------------------------------
  if (variant === "curiosity") {
    if (format === "og") {
      // Landscape (1200 x 630): Compact bottom-anchored layout
      roundRect(ctx, p, contentTop, 300 * s, 38 * s, 19 * s, "#EDF5DF");
      ctx.font = `900 ${12.5 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VOTE BEFORE THE RESULT IS REVEALED", p + 150 * s, contentTop + 19 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const pillHeight = 58 * s;
      const pillsY = footerLineY - pillHeight - 24 * s;
      const kickerY = pillsY - 34 * s;
      const textStartY = contentTop + 52 * s;
      const maxTextH = kickerY - textStartY - 12 * s;

      drawBlockText(
        ctx,
        story,
        p,
        textStartY,
        w - 2 * p,
        maxTextH,
        42 * s,
        22 * s,
        CARD_COLORS.ink,
        700,
        "Newsreader, Georgia, serif",
        5
      );

      ctx.font = `900 ${18 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText("WHO IS WRONG?", p, kickerY);

      const gap = 16 * s;
      const ow = (w - 2 * p - gap) / 2;
      drawOptionPill(ctx, p, pillsY, ow, pillHeight, s, a, "A", CARD_COLORS.lime);
      drawOptionPill(ctx, p + ow + gap, pillsY, ow, pillHeight, s, b, "B", CARD_COLORS.blue);
    } else {
      // Tall formats (Feed 4:5 and Story 9:16) - Vertically Center Aligned
      const isStory = format === "story";
      const pillH = 38 * s;
      const gap1 = isStory ? 28 * s : 18 * s;

      const storyFit = fitText(
        ctx,
        `“${story}”`,
        w - 2 * p,
        isStory ? 420 * s : 240 * s,
        isStory ? 54 * s : 40 * s,
        24 * s,
        700,
        "Newsreader, Georgia, serif",
        isStory ? 7 : 5
      );
      const storyH = storyFit.lines.length * storyFit.lh;
      const gap2 = isStory ? 32 * s : 18 * s;

      const kickerH = 22 * s;
      const gap3 = isStory ? 18 * s : 12 * s;

      const optH = isStory ? 72 * s : 60 * s;
      const gap4 = isStory ? 16 * s : 10 * s;
      const gap5 = isStory ? 32 * s : 18 * s;

      const qrBoxH = isStory ? 185 * s : 145 * s;
      const qrSize = isStory ? 140 * s : 115 * s;

      const totalH =
        pillH + gap1 + storyH + gap2 + kickerH + gap3 + optH + gap4 + optH + gap5 + qrBoxH;
      let y = contentTop + Math.max(0, Math.floor((availHeight - totalH) / 2));

      // 1. Top pill
      const pillText = "BLIND VOTE • NO SPOILERS";
      ctx.font = `900 ${12.5 * s}px Inter, system-ui, sans-serif`;
      const pillW = ctx.measureText(pillText).width + 30 * s;
      roundRect(ctx, p, y, pillW, pillH, pillH / 2, "#EDF5DF");
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, p + pillW / 2, y + pillH / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      y += pillH + gap1;

      // 2. Story text
      ctx.font = storyFit.font;
      ctx.fillStyle = CARD_COLORS.ink;
      for (const line of storyFit.lines) {
        ctx.fillText(line, p, y);
        y += storyFit.lh;
      }
      y += gap2;

      // 3. Kicker
      ctx.font = `900 ${isStory ? 20 * s : 16 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText("WHO IS WRONG?", p, y);
      y += kickerH + gap3;

      // 4. Option pills A & B
      drawOptionPill(ctx, p, y, w - 2 * p, optH, s, a, "A", CARD_COLORS.lime);
      y += optH + gap4;
      drawOptionPill(ctx, p, y, w - 2 * p, optH, s, b, "B", CARD_COLORS.blue);
      y += optH + gap5;

      // 5. QR Code Callout Box (in BOTH Story and Feed)
      drawQRCalloutBox(
        ctx,
        w,
        p,
        y,
        qrBoxH,
        s,
        postUrl,
        "WHAT WOULD YOU DO?",
        "Scan to cast your vote anonymously without seeing others' answers",
        `⚡ ${votes.toLocaleString()} verified votes`,
        qrSize
      );
    }

    drawFooter(ctx, w, h, p, s, "anonverdict.com • Vote to reveal the crowd");
  }

  // -------------------------------------------------------------
  // 2. OUTCOME VARIANT (The Update)
  // -------------------------------------------------------------
  else if (variant === "outcome") {
    if (format === "og") {
      roundRect(ctx, p, contentTop, 110 * s, 38 * s, 19 * s, CARD_COLORS.coral);
      ctx.font = `900 ${14 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("UPDATE", p + 55 * s, contentTop + 19 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      let y = drawBlockText(
        ctx,
        `${pct}% told them to choose: ${a}.`,
        p,
        contentTop + 54 * s,
        w - 2 * p,
        120 * s,
        42 * s,
        28 * s,
        CARD_COLORS.ink,
        750,
        "Newsreader, Georgia, serif",
        2
      );

      y += 18 * s;
      const boxH = Math.min(124 * s, footerLineY - y - 24 * s);
      roundRect(ctx, p, y, w - 2 * p, boxH, 20 * s, "#EDF5DF");
      drawBlockText(
        ctx,
        outcome,
        p + 24 * s,
        y + 22 * s,
        w - 2 * p - 48 * s,
        boxH - 44 * s,
        28 * s,
        20 * s,
        CARD_COLORS.limeInk,
        700,
        "Inter, system-ui, sans-serif",
        3
      );
    } else {
      // Tall formats (Feed 4:5 and Story 9:16) - Vertically Center Aligned
      const isStory = format === "story";
      const pillH = 38 * s;
      const gap1 = isStory ? 22 * s : 14 * s;

      const hlFit = fitText(
        ctx,
        `${pct}% told them to choose: ${a}.`,
        w - 2 * p,
        isStory ? 140 * s : 85 * s,
        isStory ? 48 * s : 36 * s,
        22 * s,
        750,
        "Newsreader, Georgia, serif",
        3
      );
      const hlH = hlFit.lines.length * hlFit.lh;
      const gap2 = isStory ? 24 * s : 14 * s;

      const resBoxH = isStory ? 155 * s : 115 * s;
      const gap3 = isStory ? 24 * s : 14 * s;

      const origBoxH = isStory ? 230 * s : 160 * s;
      const gap4 = isStory ? 24 * s : 14 * s;

      const barH = 56 * s;
      const gap5 = isStory ? 26 * s : 16 * s;

      const qrBoxH = isStory ? 175 * s : 140 * s;
      const qrSize = isStory ? 135 * s : 115 * s;

      const totalH =
        pillH + gap1 + hlH + gap2 + resBoxH + gap3 + origBoxH + gap4 + barH + gap5 + qrBoxH;
      let y = contentTop + Math.max(0, Math.floor((availHeight - totalH) / 2));

      // 1. UPDATE Badge
      roundRect(ctx, p, y, 110 * s, pillH, pillH / 2, CARD_COLORS.coral);
      ctx.font = `900 ${14 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("UPDATE", p + 55 * s, y + pillH / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      y += pillH + gap1;

      // 2. Headline
      ctx.font = hlFit.font;
      ctx.fillStyle = CARD_COLORS.ink;
      for (const line of hlFit.lines) {
        ctx.fillText(line, p, y);
        y += hlFit.lh;
      }
      y += gap2;

      // 3. Resolution Callout Box
      roundRect(ctx, p, y, w - 2 * p, resBoxH, 20 * s, "#EDF5DF");
      drawBlockText(
        ctx,
        outcome,
        p + 24 * s,
        y + 20 * s,
        w - 2 * p - 48 * s,
        resBoxH - 40 * s,
        isStory ? 32 * s : 24 * s,
        18 * s,
        CARD_COLORS.limeInk,
        700,
        "Inter, system-ui, sans-serif",
        4
      );
      y += resBoxH + gap3;

      // 4. The Original Dilemma Story Box
      roundRect(ctx, p, y, w - 2 * p, origBoxH, 20 * s, "#FFFFFF", CARD_COLORS.line, 1.2);
      ctx.font = `850 ${12 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("THE ORIGINAL SITUATION", p + 24 * s, y + 20 * s);
      drawBlockText(
        ctx,
        `“${story}”`,
        p + 24 * s,
        y + 48 * s,
        w - 2 * p - 48 * s,
        origBoxH - 68 * s,
        isStory ? 32 * s : 24 * s,
        18 * s,
        CARD_COLORS.ink,
        600,
        "Newsreader, Georgia, serif",
        4
      );
      y += origBoxH + gap4;

      // 5. Crowd Vote Breakdown Bar
      ctx.font = `800 ${14 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.ink;
      ctx.fillText(`${pct}% ${a}`, p, y);
      ctx.textAlign = "right";
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText(`${other}% ${b}`, w - p, y);
      ctx.textAlign = "left";
      y += 22 * s;

      const barW = w - 2 * p;
      roundRect(ctx, p, y, barW, 22 * s, 11 * s, "#E9ECE5");
      roundRect(ctx, p, y, barW * (pct / 100), 22 * s, 11 * s, CARD_COLORS.lime);
      y += 22 * s + gap5;

      // 6. QR Code Callout Box (in BOTH Story and Feed)
      drawQRCalloutBox(
        ctx,
        w,
        p,
        y,
        qrBoxH,
        s,
        postUrl,
        "COMMUNITY RESOLUTION",
        "Point camera to read the full community discussion and advice",
        `VERIFIED ANONVERDICT • ${votes.toLocaleString()} VOTES`,
        qrSize
      );
    }

    drawFooter(ctx, w, h, p, s, "anonverdict.com • See what happened next");
  }

  // -------------------------------------------------------------
  // 3. RESULT VARIANT (The Verdict)
  // -------------------------------------------------------------
  else if (variant === "result") {
    if (format === "og") {
      ctx.font = `900 ${16 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText(`${votes.toLocaleString()} VERIFIED VOTES`, p, contentTop + 10 * s);

      ctx.font = `950 ${120 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textBaseline = "middle";
      const numY = contentTop + 110 * s;
      ctx.fillText(`${pct}%`, p, numY);
      ctx.textBaseline = "top";

      let y = numY + 65 * s;
      y = drawBlockText(
        ctx,
        `said “${a}.”`,
        p,
        y,
        w - 2 * p,
        100 * s,
        42 * s,
        26 * s,
        CARD_COLORS.ink,
        750,
        "Newsreader, Georgia, serif",
        2
      );

      ctx.font = `900 ${18 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.blue;
      ctx.fillText("WOULD YOU HAVE VOTED THE SAME?", p, y + 16 * s);
    } else {
      // Tall formats (Feed 4:5 and Story 9:16) - Vertically Center Aligned
      const isStory = format === "story";
      const eyeH = 20 * s;
      const gap1 = isStory ? 18 * s : 10 * s;
      const numH = isStory ? 140 * s : 105 * s;
      const gap2 = isStory ? 16 * s : 10 * s;

      const saidFit = fitText(
        ctx,
        `said “${a}.”`,
        w - 2 * p,
        isStory ? 140 * s : 85 * s,
        isStory ? 48 * s : 36 * s,
        22 * s,
        750,
        "Newsreader, Georgia, serif",
        3
      );
      const saidH = saidFit.lines.length * saidFit.lh;
      const gap3 = isStory ? 24 * s : 14 * s;

      const kickerH = 22 * s;
      const gap4 = isStory ? 22 * s : 14 * s;

      const boxH = isStory ? 240 * s : 165 * s;
      const gap5 = isStory ? 28 * s : 16 * s;

      const qrBoxH = isStory ? 175 * s : 140 * s;
      const qrSize = isStory ? 135 * s : 115 * s;

      const totalH =
        eyeH + gap1 + numH + gap2 + saidH + gap3 + kickerH + gap4 + boxH + gap5 + qrBoxH;
      let y = contentTop + Math.max(0, Math.floor((availHeight - totalH) / 2));

      // 1. Eyebrow badge
      ctx.font = `900 ${15 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText(`${votes.toLocaleString()} VERIFIED VOTES`, p, y);
      y += eyeH + gap1;

      // 2. Giant Percentage
      ctx.font = `950 ${numH}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textBaseline = "top";
      ctx.fillText(`${pct}%`, p, y);
      y += numH * 0.9 + gap2;

      // 3. Said ...
      ctx.font = saidFit.font;
      ctx.fillStyle = CARD_COLORS.ink;
      for (const line of saidFit.lines) {
        ctx.fillText(line, p, y);
        y += saidFit.lh;
      }
      y += gap3;

      // 4. Kicker
      ctx.font = `900 ${isStory ? 20 * s : 16 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.blue;
      ctx.fillText("WOULD YOU HAVE VOTED THE SAME?", p, y);
      y += kickerH + gap4;

      // 5. Dilemma context box
      roundRect(ctx, p, y, w - 2 * p, boxH, 20 * s, "#FFFFFF", CARD_COLORS.line, 1.2);
      ctx.font = `850 ${12 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("THE DILEMMA", p + 24 * s, y + 20 * s);
      drawBlockText(
        ctx,
        `“${story}”`,
        p + 24 * s,
        y + 48 * s,
        w - 2 * p - 48 * s,
        boxH - 68 * s,
        isStory ? 34 * s : 24 * s,
        18 * s,
        CARD_COLORS.ink,
        600,
        "Newsreader, Georgia, serif",
        4
      );
      y += boxH + gap5;

      // 6. QR Code Callout Box (in BOTH Story and Feed)
      drawQRCalloutBox(
        ctx,
        w,
        p,
        y,
        qrBoxH,
        s,
        postUrl,
        "CAST YOUR VOTE",
        "Point your camera to vote and see live community reactions",
        `VERIFIED ANONVERDICT • ${votes.toLocaleString()} VOTES`,
        qrSize
      );
    }

    drawFooter(ctx, w, h, p, s, "anonverdict.com • Read the full dilemma");
  }

  // -------------------------------------------------------------
  // 4. PERSONAL VARIANT (How I Voted)
  // -------------------------------------------------------------
  else if (variant === "personal") {
    const userPct = data.votedSide === 'b' ? other : pct;
    if (format === "og") {
      ctx.font = `900 ${18 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("YOU VOTED WITH", p, contentTop + 10 * s);

      ctx.font = `950 ${120 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textBaseline = "middle";
      const numY = contentTop + 110 * s;
      ctx.fillText(`${userPct}%`, p, numY);
      ctx.textBaseline = "top";

      let y = numY + 65 * s;
      y = drawBlockText(
        ctx,
        "of strangers who saw the same dilemma.",
        p,
        y,
        w - 2 * p,
        90 * s,
        36 * s,
        22 * s,
        CARD_COLORS.ink,
        750,
        "Newsreader, Georgia, serif",
        2
      );

      ctx.font = `900 ${18 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText("HOW WOULD YOUR FRIENDS VOTE?", p, y + 16 * s);
    } else {
      // Tall formats (Feed 4:5 and Story 9:16) - Vertically Center Aligned
      const isStory = format === "story";
      const eyeH = 20 * s;
      const gap1 = isStory ? 18 * s : 10 * s;
      const numH = isStory ? 140 * s : 105 * s;
      const gap2 = isStory ? 16 * s : 10 * s;

      const subFit = fitText(
        ctx,
        "of strangers who saw the same dilemma.",
        w - 2 * p,
        isStory ? 120 * s : 70 * s,
        isStory ? 44 * s : 32 * s,
        20 * s,
        750,
        "Newsreader, Georgia, serif",
        3
      );
      const subH = subFit.lines.length * subFit.lh;
      const gap3 = isStory ? 24 * s : 14 * s;

      const kickerH = 22 * s;
      const gap4 = isStory ? 22 * s : 14 * s;

      const boxH = isStory ? 240 * s : 165 * s;
      const gap5 = isStory ? 28 * s : 16 * s;

      const qrBoxH = isStory ? 175 * s : 140 * s;
      const qrSize = isStory ? 135 * s : 115 * s;

      const totalH =
        eyeH + gap1 + numH + gap2 + subH + gap3 + kickerH + gap4 + boxH + gap5 + qrBoxH;
      let y = contentTop + Math.max(0, Math.floor((availHeight - totalH) / 2));

      // 1. Eyebrow badge
      ctx.font = `900 ${16 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("YOU VOTED WITH", p, y);
      y += eyeH + gap1;

      // 2. Giant Percentage
      ctx.font = `950 ${numH}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.limeInk;
      ctx.textBaseline = "top";
      ctx.fillText(`${userPct}%`, p, y);
      y += numH * 0.9 + gap2;

      // 3. Subtitle
      ctx.font = subFit.font;
      ctx.fillStyle = CARD_COLORS.ink;
      for (const line of subFit.lines) {
        ctx.fillText(line, p, y);
        y += subFit.lh;
      }
      y += gap3;

      // 4. Kicker
      ctx.font = `900 ${isStory ? 20 * s : 16 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText("HOW WOULD YOUR FRIENDS VOTE?", p, y);
      y += kickerH + gap4;

      // 5. Dilemma context box
      roundRect(ctx, p, y, w - 2 * p, boxH, 20 * s, "#FFFFFF", CARD_COLORS.line, 1.2);
      ctx.font = `850 ${12 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("THE DILEMMA", p + 24 * s, y + 20 * s);
      drawBlockText(
        ctx,
        `“${story}”`,
        p + 24 * s,
        y + 48 * s,
        w - 2 * p - 48 * s,
        boxH - 68 * s,
        isStory ? 34 * s : 24 * s,
        18 * s,
        CARD_COLORS.ink,
        600,
        "Newsreader, Georgia, serif",
        4
      );
      y += boxH + gap5;

      // 6. QR Code Callout Box (in BOTH Story and Feed)
      drawQRCalloutBox(
        ctx,
        w,
        p,
        y,
        qrBoxH,
        s,
        postUrl,
        "TEST YOUR FRIENDS",
        "Scan with your phone to take the poll and see where you land",
        `VERIFIED ANONVERDICT • ${votes.toLocaleString()} VOTES`,
        qrSize
      );
    }

    drawFooter(ctx, w, h, p, s, "anonverdict.com • Share where you landed");
  }

  // -------------------------------------------------------------
  // 5. SPLIT VARIANT (50/50 Tie-Breaker)
  // -------------------------------------------------------------
  else if (variant === "split") {
    if (format === "og") {
      roundRect(ctx, p, contentTop, 220 * s, 38 * s, 19 * s, CARD_COLORS.coral);
      ctx.font = `900 ${13 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("THE INTERNET IS SPLIT", p + 110 * s, contentTop + 19 * s);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const yNums = contentTop + 60 * s;
      ctx.font = `950 ${68 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.ink;
      ctx.fillText(`${pct}%`, p, yNums);
      ctx.textAlign = "right";
      ctx.fillText(`${other}%`, w - p, yNums);
      ctx.textAlign = "left";

      const barY = yNums + 54 * s;
      const bw = w - 2 * p;
      roundRect(ctx, p, barY, bw, 24 * s, 12 * s, "#E9ECE5");
      roundRect(ctx, p, barY, bw * (pct / 100), 24 * s, 12 * s, CARD_COLORS.coral);

      let textY = barY + 44 * s;
      drawBlockText(
        ctx,
        "Your vote could change the verdict.",
        p,
        textY,
        w - 2 * p,
        80 * s,
        34 * s,
        22 * s,
        CARD_COLORS.ink,
        800,
        "Newsreader, Georgia, serif",
        2
      );
    } else {
      // Tall formats (Feed 4:5 and Story 9:16) - Vertically Center Aligned
      const isStory = format === "story";
      const pillH = 38 * s;
      const gap1 = isStory ? 24 * s : 14 * s;

      const numH = isStory ? 92 * s : 72 * s;
      const gap2 = isStory ? 18 * s : 12 * s;

      const barH = 58 * s;
      const gap3 = isStory ? 24 * s : 16 * s;

      const hlFit = fitText(
        ctx,
        "Your vote could change the verdict.",
        w - 2 * p,
        isStory ? 100 * s : 65 * s,
        isStory ? 44 * s : 32 * s,
        22 * s,
        800,
        "Newsreader, Georgia, serif",
        2
      );
      const hlH = hlFit.lines.length * hlFit.lh;
      const gap4 = isStory ? 24 * s : 14 * s;

      const boxH = isStory ? 240 * s : 165 * s;
      const gap5 = isStory ? 28 * s : 16 * s;

      const qrBoxH = isStory ? 175 * s : 140 * s;
      const qrSize = isStory ? 135 * s : 115 * s;

      const totalH =
        pillH + gap1 + numH + gap2 + barH + gap3 + hlH + gap4 + boxH + gap5 + qrBoxH;
      let y = contentTop + Math.max(0, Math.floor((availHeight - totalH) / 2));

      // 1. Top pill
      roundRect(ctx, p, y, 220 * s, pillH, pillH / 2, CARD_COLORS.coral);
      ctx.font = `900 ${13 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("THE INTERNET IS SPLIT", p + 110 * s, y + pillH / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      y += pillH + gap1;

      // 2. Dual percentages
      ctx.font = `950 ${numH}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.ink;
      ctx.fillText(`${pct}%`, p, y);
      ctx.textAlign = "right";
      ctx.fillText(`${other}%`, w - p, y);
      ctx.textAlign = "left";
      y += numH * 0.9 + gap2;

      // 3. Split Bar
      const bw = w - 2 * p;
      roundRect(ctx, p, y, bw, 24 * s, 12 * s, "#E9ECE5");
      roundRect(ctx, p, y, bw * (pct / 100), 24 * s, 12 * s, CARD_COLORS.coral);
      ctx.font = `800 ${13 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.coral;
      ctx.fillText(a.toUpperCase().slice(0, 36), p, y + 30 * s);
      ctx.textAlign = "right";
      ctx.fillStyle = CARD_COLORS.blue;
      ctx.fillText(b.toUpperCase().slice(0, 36), w - p, y + 30 * s);
      ctx.textAlign = "left";
      y += barH + gap3;

      // 4. Headline
      ctx.font = hlFit.font;
      ctx.fillStyle = CARD_COLORS.ink;
      for (const line of hlFit.lines) {
        ctx.fillText(line, p, y);
        y += hlFit.lh;
      }
      y += gap4;

      // 5. Dilemma box
      roundRect(ctx, p, y, w - 2 * p, boxH, 20 * s, "#FFFFFF", CARD_COLORS.line, 1.2);
      ctx.font = `850 ${12 * s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = CARD_COLORS.muted;
      ctx.fillText("THE TIE-BREAKER QUESTION", p + 24 * s, y + 20 * s);
      drawBlockText(
        ctx,
        `“${story}”`,
        p + 24 * s,
        y + 48 * s,
        w - 2 * p - 48 * s,
        boxH - 68 * s,
        isStory ? 34 * s : 24 * s,
        18 * s,
        CARD_COLORS.ink,
        600,
        "Newsreader, Georgia, serif",
        4
      );
      y += boxH + gap5;

      // 6. QR Code Callout Box (in BOTH Story and Feed)
      drawQRCalloutBox(
        ctx,
        w,
        p,
        y,
        qrBoxH,
        s,
        postUrl,
        "CAST THE DECIDING VOTE",
        "Scan with your phone camera to break the tie anonymously",
        `VERIFIED ANONVERDICT • ${votes.toLocaleString()} VOTES`,
        qrSize
      );
    }

    drawFooter(ctx, w, h, p, s, "anonverdict.com • Cast the deciding vote");
  }
}

export function generateShareCaption(
  data: ShareCardData,
  variant: CardVariant,
  url = "https://www.anonverdict.com/"
): string {
  const story = data.story;
  const a = data.optionA;
  const p = Math.round(data.pctA);
  const n = data.votes || 0;

  const captions: Record<CardVariant, string> = {
    curiosity: `“${story}”\n\nWho is wrong? Vote before seeing what strangers decided:\n${url}`,
    result: `${n.toLocaleString()} verified votes. ${p}% chose “${a}.” Would you vote the same?\n${url}`,
    personal: `I voted with ${p}% of strangers on this dilemma. How would you vote?\n${url}`,
    split: `The internet is split almost exactly 50/50. Your vote could break the tie!\n${url}`,
    outcome: `${p}% told them to choose “${a}.” Here is what happened next: “${data.outcome || ""}”\n${url}`,
  };

  return captions[variant] || `${story}\n\n${url}`;
}
