/**
 * Canvas 2D port of TemplatePreviewRenderer.cs — 700×700 parchment map preview.
 *
 * Draw order and geometry mirror the C# renderer exactly: parchment background
 * (radial gradient + 8 deterministic stains + vignette), compass rose, double
 * frame, connection lines (gap-cut where they pass under zone coins, curved
 * with iterative control-point refinement), and bronze zone coins whose rim
 * color encodes the zone role. Browser-only (uses document + Canvas 2D).
 */

import type { Connection, RmgTemplate, Zone } from "../template";
import type { MapTopology } from "../enums";
import { Rng } from "../rng";
import { computeLayout, orderZones, type ZoneLayoutPoint } from "./layout";
import cinzelUrl from "../../assets/fonts/Cinzel.ttf?url";

export interface PreviewRenderResult {
  dataUrl: string;
  bytes: Uint8Array;
  width: 700;
  height: 700;
}

interface Pt {
  x: number;
  y: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface LineColor extends Rgb {
  /** 0..255, like SKColor.Alpha. */
  a: number;
}

interface Gap {
  lo: number;
  hi: number;
}

interface GapZone {
  fadeStart: number;
  gapLo: number;
  gapHi: number;
  fadeEnd: number;
}

interface DrawnRaw {
  p1: Pt;
  ctrl: Pt;
  p2: Pt;
  isPortal: boolean;
  hasCurve: boolean;
  from: string;
  to: string;
}

interface DrawnPath {
  p1: Pt;
  ctrl: Pt;
  p2: Pt;
  isPortal: boolean;
  hasCurve: boolean;
}

interface Intersection {
  at: Pt;
  segA: number;
  segB: number;
}

const WIDTH = 700;
const HEIGHT = 700;
const TAU = Math.PI * 2;
const HUB_RADIUS_MIN = 28;

// ── Colours — Olden Era parchment skin (SKColor values copied verbatim) ──────
const PARCHMENT_LIGHT = "#E7D6A8";
const PARCHMENT_MID = "#CDB685";
const PARCHMENT_DARK = "#9C8757";
const STAIN: Rgb = { r: 0x3a, g: 0x20, b: 0x10 };
const INK_BROWN = "#2A1A0A";
const FRAME_OUTER = "#8F733F";
const FRAME_INNER = "#5A3A14";

// Coin
const COIN_FILL_CENTER = "#7A5530";
const COIN_FILL_EDGE = "#1F130A";
const COIN_RIM_DARK = "#5A3A1A";
const COIN_INNER_RING: Rgb = { r: 0x1c, g: 0x0f, b: 0x06 };

// Rim accents (top stop of the rim gradient)
const RIM_SPAWN = "#D8A85A";
const RIM_HUB = "#CFA86B";
const RIM_BRONZE = "#CD7F32";
const RIM_SILVER = "#C0C0C0";
const RIM_GOLD = "#FFD232";
const HOLD_CITY_GOLD = "#FFD700";

// Numeral / icon ink
const NUMERAL_CREAM = "#F1D990";

// Connection lines
const DIRECT_LINE: LineColor = { r: 0x2a, g: 0x1a, b: 0x0a, a: 255 };
const PORTAL_LINE: LineColor = { r: 0x2c, g: 0x4f, b: 0x6a, a: 200 };

const SERIF_FONT = "Cinzel, serif";

// ── Small helpers ────────────────────────────────────────────────────────────

function rgba(c: Rgb, a255: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a255 / 255})`;
}

/** .NET Math.Round default (MidpointRounding.ToEven), used for byte alpha casts. */
function bankerRound(v: number): number {
  const f = Math.floor(v);
  const diff = v - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function fontPx(px: number): string {
  return `${px}px ${SERIF_FONT}`;
}

function pointDist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += pointDist(pts[i], pts[i + 1]);
  return len;
}

/**
 * FNV-1a 32-bit over UTF-16 code units, both bytes per char — the C# StableSeed.
 * Stable across runtimes, unlike randomized string hashes.
 */
function stableSeed(s: string): number {
  const OFFSET = 2166136261;
  const PRIME = 16777619;
  let h = OFFSET;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h = Math.imul(h ^ (ch & 0xff), PRIME);
    h = Math.imul(h ^ ((ch >>> 8) & 0xff), PRIME);
  }
  return h | 0;
}

// ── Font loading (Cinzel, embedded — loaded once, fallback serif) ────────────

let cinzelLoadPromise: Promise<boolean> | null = null;

function ensureCinzelLoaded(): Promise<boolean> {
  cinzelLoadPromise ??= new Promise<boolean>(resolve => {
    try {
      const font = new FontFace("Cinzel", `url(${cinzelUrl})`);
      font
        .load()
        .then(loaded => {
          document.fonts.add(loaded);
          resolve(true);
        })
        .catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
  return cinzelLoadPromise;
}

// ── Entry point ──────────────────────────────────────────────────────────────

/** Renders the 700×700 preview PNG of the template. */
export async function renderPreview(template: RmgTemplate, topology: MapTopology): Promise<PreviewRenderResult> {
  await ensureCinzelLoaded();

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Canvas 2D context unavailable");

  drawPreview(ctx, template, topology);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new Error("canvas.toBlob returned null");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dataUrl = canvas.toDataURL("image/png");
  return { dataUrl, bytes, width: 700, height: 700 };
}

// ── Main draw ────────────────────────────────────────────────────────────────

function drawPreview(ctx: CanvasRenderingContext2D, template: RmgTemplate, topology: MapTopology): void {
  const seed = stableSeed(template.name ?? "");
  drawParchmentBackground(ctx, seed);
  drawCompassRose(ctx);
  drawFrame(ctx);

  const variant = template.variants?.[0];
  const zones = variant?.zones ?? [];
  if (zones.length === 0) {
    drawTextCentered(ctx, template.name ?? "", WIDTH / 2, HEIGHT / 2, fontPx(24), INK_BROWN);
    return;
  }

  const orderedZones = orderZones(zones, variant?.orientation?.zeroAngleZone);
  const connections = variant?.connections ?? [];
  const { positions, zoneRadius } = computeLayout(template, topology);

  // Connections (under zones)
  drawConnections(ctx, connections, positions, zoneRadius);

  // Non-spawn zones first, spawn on top
  for (const zone of orderedZones) {
    const pos = positions.get(zone.name);
    if (pos !== undefined && !zone.name.startsWith("Spawn-")) drawZone(ctx, zone, pos, zoneRadius);
  }
  for (const zone of orderedZones) {
    const pos = positions.get(zone.name);
    if (pos !== undefined && zone.name.startsWith("Spawn-")) drawZone(ctx, zone, pos, zoneRadius);
  }
}

// ── Background, frame, compass ───────────────────────────────────────────────

function drawParchmentBackground(ctx: CanvasRenderingContext2D, seed: number): void {
  // Base radial gradient — slightly above center to feel like top-lit parchment.
  const radius = Math.sqrt(WIDTH * WIDTH + HEIGHT * HEIGHT) / 2;
  const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.45, 0, WIDTH / 2, HEIGHT * 0.45, radius);
  gradient.addColorStop(0, PARCHMENT_LIGHT);
  gradient.addColorStop(0.6, PARCHMENT_MID);
  gradient.addColorStop(1, PARCHMENT_DARK);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stains — deterministic from the name-derived seed.
  const rng = new Rng(seed === 0 ? 1 : seed);
  for (let i = 0; i < 8; i++) {
    const cx = rng.nextDouble() * WIDTH;
    const cy = rng.nextDouble() * HEIGHT;
    const r = 60 + rng.nextDouble() * 80;
    const alpha = 20 + rng.nextInt(70); // 20..89
    ctx.save();
    ctx.filter = "blur(28px)";
    ctx.fillStyle = rgba(STAIN, alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Vignette — transparent center to dark edges.
  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, radius);
  vignette.addColorStop(0, rgba({ r: 0, g: 0, b: 0 }, 0));
  vignette.addColorStop(0.6, rgba({ r: 0, g: 0, b: 0 }, 0));
  vignette.addColorStop(1, rgba({ r: 0, g: 0, b: 0 }, 115));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = FRAME_OUTER;
  ctx.lineWidth = 1.0;
  ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);

  ctx.strokeStyle = FRAME_INNER;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(22, 22, WIDTH - 44, HEIGHT - 44);

  ctx.lineWidth = 0.8;
  ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);
}

function drawCompassRose(ctx: CanvasRenderingContext2D): void {
  const cx = WIDTH - 90;
  const cy = 90;
  const r = 38;

  ctx.strokeStyle = rgba(STAIN, 64); // ~25%
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();

  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, TAU);
  ctx.stroke();

  // Vertical N-S diamond
  ctx.fillStyle = rgba(STAIN, 140);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.95);
  ctx.lineTo(cx + 4, cy);
  ctx.lineTo(cx, cy + r * 0.95);
  ctx.lineTo(cx - 4, cy);
  ctx.closePath();
  ctx.fill();

  // Horizontal E-W diamond
  ctx.fillStyle = rgba(STAIN, 100);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.95, cy);
  ctx.lineTo(cx, cy - 4);
  ctx.lineTo(cx + r * 0.95, cy);
  ctx.lineTo(cx, cy + 4);
  ctx.closePath();
  ctx.fill();

  // "N" glyph above the outer ring
  drawTextCentered(ctx, "N", cx, cy - r - 6, fontPx(13), rgba(STAIN, 160));
}

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * Centered text matching the C# DrawText(centered: true): centers the glyph ink
 * bounds (SkiaSharp MeasureText bounds) on (x, y) rather than using font-metric
 * baselines. Falls back to metric centering where ink bounds are unavailable.
 */
function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  const left = m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const hasInkBounds =
    left !== undefined &&
    right !== undefined &&
    ascent !== undefined &&
    descent !== undefined &&
    (left !== 0 || right !== 0 || ascent !== 0 || descent !== 0);
  if (hasInkBounds) {
    // SkiaSharp bounds are origin-relative: MidX = (Left+Right)/2, MidY = (Top+Bottom)/2.
    const midX = (-left + right) / 2;
    const midY = (-ascent + descent) / 2;
    ctx.fillStyle = color;
    ctx.fillText(text, x - midX, y - midY);
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// ── Coin token primitive ─────────────────────────────────────────────────────

function drawCoin(ctx: CanvasRenderingContext2D, center: Pt, radius: number, rimTopColor: string, rimWidth: number): void {
  if (radius <= 0) return;

  // Drop shadow (ellipse just below the coin).
  ctx.save();
  ctx.filter = "blur(1.8px)";
  ctx.fillStyle = rgba({ r: 0, g: 0, b: 0 }, 90);
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + radius, radius * 0.95, 3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Base radial fill, 35% offset from center for the highlight.
  const fillCenter: Pt = { x: center.x - radius * 0.3, y: center.y - radius * 0.35 };
  const base = ctx.createRadialGradient(fillCenter.x, fillCenter.y, 0, fillCenter.x, fillCenter.y, radius * 1.2);
  base.addColorStop(0, COIN_FILL_CENTER);
  base.addColorStop(1, COIN_FILL_EDGE);
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();

  // Inner engraved ring.
  ctx.strokeStyle = rgba(COIN_INNER_RING, 150);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.77, 0, TAU);
  ctx.stroke();

  // Rim — vertical linear gradient (rimTopColor → CoinRimDark).
  const rim = ctx.createLinearGradient(center.x, center.y - radius, center.x, center.y + radius);
  rim.addColorStop(0, rimTopColor);
  rim.addColorStop(1, COIN_RIM_DARK);
  ctx.strokeStyle = rim;
  ctx.lineWidth = rimWidth;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.stroke();
}

// ── Connections ──────────────────────────────────────────────────────────────

function drawConnections(
  ctx: CanvasRenderingContext2D,
  connections: Connection[],
  positions: Map<string, ZoneLayoutPoint>,
  zoneRadius: number,
): void {
  const r = 0;
  const curveThreshold = zoneRadius * 1.3;
  const curveOffset = zoneRadius * 2.0;

  const ArcSamples = 32;
  const MaxArcIter = 20;
  const ArcClearance = 6.0;

  // Iteratively bend the control point until the quadratic curve clears every
  // other zone coin by ArcClearance pixels.
  const refineCtrl = (p1: Pt, ctrl: Pt, p2: Pt, fromName: string, toName: string): Pt => {
    for (let arcIter = 0; arcIter < MaxArcIter; arcIter++) {
      let arcClean = true;
      let worstZone: Pt | null = null;
      let worstPenetration = 0;
      let worstSample = 0.5;

      for (let s = 1; s < ArcSamples; s++) {
        const st = s / ArcSamples;
        const mt = 1 - st;
        const bx = mt * mt * p1.x + 2 * mt * st * ctrl.x + st * st * p2.x;
        const by = mt * mt * p1.y + 2 * mt * st * ctrl.y + st * st * p2.y;

        for (const [key, zone] of positions) {
          if (key === fromName || key === toName) continue;
          const ex = bx - zone.x;
          const ey = by - zone.y;
          const d = Math.sqrt(ex * ex + ey * ey);
          const penetration = zoneRadius + ArcClearance - d;
          if (penetration > worstPenetration) {
            worstPenetration = penetration;
            worstZone = zone;
            worstSample = st;
            arcClean = false;
          }
        }
      }

      if (arcClean) break;
      if (worstZone === null) break;

      const wmt = 1 - worstSample;
      const wbx = wmt * wmt * p1.x + 2 * wmt * worstSample * ctrl.x + worstSample * worstSample * p2.x;
      const wby = wmt * wmt * p1.y + 2 * wmt * worstSample * ctrl.y + worstSample * worstSample * p2.y;

      let ex3 = wbx - worstZone.x;
      let ey3 = wby - worstZone.y;
      let el3 = Math.sqrt(ex3 * ex3 + ey3 * ey3);
      if (el3 < 0.001) {
        const chx2 = p2.x - p1.x;
        const chy2 = p2.y - p1.y;
        const cl2 = Math.sqrt(chx2 * chx2 + chy2 * chy2);
        ex3 = cl2 > 0.001 ? -chy2 / cl2 : 1;
        ey3 = cl2 > 0.001 ? chx2 / cl2 : 0;
        el3 = 1;
      }
      const nx3 = ex3 / el3;
      const ny3 = ey3 / el3;

      const weight = Math.max(2 * wmt * worstSample, 0.01);
      const nudge = (worstPenetration + 2.0) / weight;
      ctrl = { x: ctrl.x + nx3 * nudge, y: ctrl.y + ny3 * nudge };

      // Deflection cap: prevent the curve from bowing out to ridiculous extremes.
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const defX = ctrl.x - midX;
      const defY = ctrl.y - midY;
      const defDist = Math.sqrt(defX * defX + defY * defY);
      const maxDeflection = Math.min(WIDTH, HEIGHT) * 0.4;
      if (defDist > maxDeflection) {
        ctrl = {
          x: midX + (defX / defDist) * maxDeflection,
          y: midY + (defY / defDist) * maxDeflection,
        };
      }

      // Hard canvas clamp: keep the control point safely inside the image bounds.
      const edgePad = 15;
      ctrl = {
        x: Math.min(Math.max(ctrl.x, edgePad), WIDTH - edgePad),
        y: Math.min(Math.max(ctrl.y, edgePad), HEIGHT - edgePad),
      };
    }
    return ctrl;
  };

  const drawnRaw: DrawnRaw[] = [];

  for (const conn of connections) {
    if (conn.connectionType === "Proximity") continue;
    const from = positions.get(conn.from);
    const to = positions.get(conn.to);
    if (from === undefined || to === undefined) continue;

    const isPortal = conn.connectionType === "Portal";

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;
    const ux = dx / dist;
    const uy = dy / dist;

    const p1: Pt = { x: from.x + ux * r, y: from.y + uy * r };
    const p2: Pt = { x: to.x - ux * r, y: to.y - uy * r };

    // Nearest other-zone coin whose projection onto the chord sits inside it.
    let bestPerp = curveThreshold;
    let bestT = 0.5;
    let blockZone: Pt | null = null;

    for (const [key, c] of positions) {
      if (key === conn.from || key === conn.to) continue;
      const t = ((c.x - from.x) * dx + (c.y - from.y) * dy) / (dist * dist);
      if (t <= 0.05 || t >= 0.95) continue;
      const projX = from.x + t * dx;
      const projY = from.y + t * dy;
      const pd = Math.sqrt((c.x - projX) * (c.x - projX) + (c.y - projY) * (c.y - projY));
      if (pd < bestPerp) {
        bestPerp = pd;
        bestT = t;
        blockZone = c;
      }
    }

    let hasCurve = false;
    let ctrl: Pt;
    if (blockZone !== null) {
      hasCurve = true;
      const mid: Pt = { x: from.x + bestT * dx, y: from.y + bestT * dy };
      let px = mid.x - blockZone.x;
      let py = mid.y - blockZone.y;
      let pl = Math.sqrt(px * px + py * py);
      if (pl < 0.001) {
        px = -uy;
        py = ux;
        pl = 1;
      }
      ctrl = refineCtrl(
        p1,
        { x: mid.x + (px / pl) * curveOffset, y: mid.y + (py / pl) * curveOffset },
        p2,
        conn.from,
        conn.to,
      );
    } else {
      ctrl = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    drawnRaw.push({ p1, ctrl, p2, isPortal, hasCurve, from: conn.from, to: conn.to });
  }

  // Shared-endpoint untangling: when two curved connections from the same zone
  // still cross, flip the worse-bowed one to the opposite side of its chord.
  {
    let anyFlipped = true;
    for (let untanglePass = 0; untanglePass < 20 && anyFlipped; untanglePass++) {
      anyFlipped = false;
      for (let i = 0; i < drawnRaw.length; i++) {
        const di = drawnRaw[i];
        if (!di.hasCurve) continue;
        for (let j = i + 1; j < drawnRaw.length; j++) {
          const dj = drawnRaw[j];
          if (!dj.hasCurve) continue;

          const shareStart =
            (di.p1.x === dj.p1.x && di.p1.y === dj.p1.y) || (di.p1.x === dj.p2.x && di.p1.y === dj.p2.y);
          const shareEnd =
            (di.p2.x === dj.p1.x && di.p2.y === dj.p1.y) || (di.p2.x === dj.p2.x && di.p2.y === dj.p2.y);
          if (!shareStart && !shareEnd) continue;

          const UntangleSamples = 24;
          const piPoly = samplePath(di.p1, di.ctrl, di.p2, di.hasCurve, UntangleSamples);
          const pjPoly = samplePath(dj.p1, dj.ctrl, dj.p2, dj.hasCurve, UntangleSamples);
          if (polylinesIntersect(piPoly, pjPoly) === null) continue;

          const deflectionSq = (a: Pt, ctrl0: Pt, b: Pt): number => {
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const ox = ctrl0.x - mx;
            const oy = ctrl0.y - my;
            return ox * ox + oy * oy;
          };

          const flipCtrl = (a: Pt, ctrl0: Pt, b: Pt): Pt => {
            const chx = b.x - a.x;
            const chy = b.y - a.y;
            const len2 = chx * chx + chy * chy;
            if (len2 < 0.001) return ctrl0;
            const t2 = ((ctrl0.x - a.x) * chx + (ctrl0.y - a.y) * chy) / len2;
            const footX = a.x + t2 * chx;
            const footY = a.y + t2 * chy;
            return { x: 2 * footX - ctrl0.x, y: 2 * footY - ctrl0.y };
          };

          if (deflectionSq(di.p1, di.ctrl, di.p2) >= deflectionSq(dj.p1, dj.ctrl, dj.p2)) {
            drawnRaw[i] = {
              ...di,
              ctrl: refineCtrl(di.p1, flipCtrl(di.p1, di.ctrl, di.p2), di.p2, di.from, di.to),
            };
          } else {
            drawnRaw[j] = {
              ...dj,
              ctrl: refineCtrl(dj.p1, flipCtrl(dj.p1, dj.ctrl, dj.p2), dj.p2, dj.from, dj.to),
            };
          }
          anyFlipped = true;
        }
      }
    }
  }

  const drawn: DrawnPath[] = drawnRaw.map(d => ({
    p1: d.p1,
    ctrl: d.ctrl,
    p2: d.p2,
    isPortal: d.isPortal,
    hasCurve: d.hasCurve,
  }));

  const CurveSamples = 32;
  const polylines = drawn.map(d => samplePath(d.p1, d.ctrl, d.p2, d.hasCurve, CurveSamples));

  const crossings: { i: number; j: number; at: Pt; segI: number; segJ: number }[] = [];
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      const hit = polylinesIntersect(polylines[i], polylines[j]);
      if (hit !== null) crossings.push({ i, j, at: hit.at, segI: hit.segA, segJ: hit.segB });
    }
  }

  // Where two paths cross, the shorter one goes over; the longer one gets a gap
  // cut where it passes underneath.
  const GapHalfPx = 7.0;
  const overSet = new Set<number>();
  const gapsByPath = new Map<number, Gap[]>();

  for (const cr of crossings) {
    const lenI = polylineLength(polylines[cr.i]);
    const lenJ = polylineLength(polylines[cr.j]);
    const iIsOver = lenI <= lenJ;
    const overIdx = iIsOver ? cr.i : cr.j;
    const underIdx = iIsOver ? cr.j : cr.i;
    const segUnder = iIsOver ? cr.segJ : cr.segI;

    overSet.add(overIdx);

    let gaps = gapsByPath.get(underIdx);
    if (gaps === undefined) {
      gaps = [];
      gapsByPath.set(underIdx, gaps);
    }

    const poly = polylines[underIdx];
    const arcTotal = polylineLength(poly);
    if (arcTotal < 0.001) continue;

    let arcBefore = 0;
    for (let s = 0; s < segUnder; s++) arcBefore += pointDist(poly[s], poly[s + 1]);

    const segLen = pointDist(poly[segUnder], poly[segUnder + 1]);
    let fracOnSeg = 0;
    if (segLen > 0.001) {
      const dx = poly[segUnder + 1].x - poly[segUnder].x;
      const dy = poly[segUnder + 1].y - poly[segUnder].y;
      const t = ((cr.at.x - poly[segUnder].x) * dx + (cr.at.y - poly[segUnder].y) * dy) / (segLen * segLen);
      fracOnSeg = Math.min(Math.max(t, 0), 1);
    }

    const arcAt = arcBefore + fracOnSeg * segLen;
    const tAt = arcAt / arcTotal;
    const tGap = GapHalfPx / arcTotal;
    gaps.push({ lo: Math.max(0, tAt - tGap), hi: Math.min(1, tAt + tGap) });
  }

  const drawOne = (k: number): void => {
    const d = drawn[k];
    const gaps = gapsByPath.get(k);
    if (gaps !== undefined) drawConnectionPathWithGaps(ctx, polylines[k], gaps, d.isPortal);
    else drawConnectionPath(ctx, d.p1, d.ctrl, d.p2, d.hasCurve, d.isPortal);
  };

  // First pass: paths never "over"; second pass: "over" paths.
  for (let k = 0; k < drawn.length; k++) {
    if (overSet.has(k)) continue;
    drawOne(k);
  }
  for (let k = 0; k < drawn.length; k++) {
    if (!overSet.has(k)) continue;
    drawOne(k);
  }
}

/** Draws the polyline with soft alpha fade-outs around each gap. */
function drawConnectionPathWithGaps(ctx: CanvasRenderingContext2D, poly: Pt[], gaps: Gap[], isPortal: boolean): void {
  const baseColor = isPortal ? PORTAL_LINE : DIRECT_LINE;
  const strokeW = isPortal ? 2.0 : 2.5;

  const totalLen = polylineLength(poly);
  if (totalLen < 0.001) return;

  const FadeExtraPx = 14.0;
  const FadeSteps = 50;

  const zones: GapZone[] = gaps.map(g => ({
    fadeStart: Math.max(0, g.lo - FadeExtraPx / totalLen),
    gapLo: g.lo,
    gapHi: g.hi,
    fadeEnd: Math.min(1, g.hi + FadeExtraPx / totalLen),
  }));

  const alphaAt = (t: number): number => {
    let alpha = 1.0;
    for (const z of zones) {
      if (t <= z.fadeStart || t >= z.fadeEnd) continue;
      if (t >= z.gapLo && t <= z.gapHi) return 0.0;
      if (t < z.gapLo) {
        const ramp = z.fadeStart < z.gapLo ? 1.0 - (t - z.fadeStart) / (z.gapLo - z.fadeStart) : 0.0;
        alpha = Math.min(alpha, ramp);
      } else {
        const ramp = z.gapHi < z.fadeEnd ? (t - z.gapHi) / (z.fadeEnd - z.gapHi) : 1.0;
        alpha = Math.min(alpha, ramp);
      }
    }
    return Math.min(Math.max(alpha, 0), 1);
  };

  // Point at arc-length fraction t along the polyline.
  const evalPoly = (t: number): Pt => {
    const target = t * totalLen;
    let arc = 0;
    for (let s = 0; s < poly.length - 1; s++) {
      const len = pointDist(poly[s], poly[s + 1]);
      if (arc + len >= target || s === poly.length - 2) {
        let frac = len > 0.001 ? (target - arc) / len : 0;
        frac = Math.min(Math.max(frac, 0), 1);
        return {
          x: poly[s].x + frac * (poly[s + 1].x - poly[s].x),
          y: poly[s].y + frac * (poly[s + 1].y - poly[s].y),
        };
      }
      arc += len;
    }
    return poly[poly.length - 1];
  };

  const tEvents = new Set<number>([0, 1]);
  for (const z of zones) {
    tEvents.add(z.fadeStart);
    tEvents.add(z.gapLo);
    tEvents.add(z.gapHi);
    tEvents.add(z.fadeEnd);
  }
  {
    let arc2 = 0;
    for (let s = 0; s < poly.length - 1; s++) {
      tEvents.add(arc2 / totalLen);
      arc2 += pointDist(poly[s], poly[s + 1]);
    }
    tEvents.add(1);
  }

  ctx.save();
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";

  const tList = [...tEvents].sort((a, b) => a - b);
  for (let seg = 0; seg < tList.length - 1; seg++) {
    const tA = tList[seg];
    const tB = tList[seg + 1];
    if (tB - tA < 1e-6) continue;

    const aMid = alphaAt((tA + tB) / 2);
    if (aMid < 0.01) continue;

    const needsFade = zones.some(z => tA < z.fadeEnd && tB > z.fadeStart);

    if (!needsFade) {
      ctx.strokeStyle = rgba(baseColor, bankerRound(baseColor.a * aMid));
      const pa = evalPoly(tA);
      const pb = evalPoly(tB);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    } else {
      for (let step = 0; step < FadeSteps; step++) {
        const t0 = tA + (tB - tA) * (step / FadeSteps);
        const t1 = tA + (tB - tA) * ((step + 1) / FadeSteps);
        const a = alphaAt((t0 + t1) / 2);
        if (a < 0.01) continue;
        ctx.strokeStyle = rgba(baseColor, bankerRound(baseColor.a * a));
        const pa = evalPoly(t0);
        const pb = evalPoly(t1);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawConnectionPath(
  ctx: CanvasRenderingContext2D,
  p1: Pt,
  ctrl: Pt,
  p2: Pt,
  hasCurve: boolean,
  isPortal: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = isPortal ? rgba(PORTAL_LINE, PORTAL_LINE.a) : rgba(DIRECT_LINE, DIRECT_LINE.a);
  ctx.lineWidth = isPortal ? 2 : 2.5;
  ctx.lineCap = "round";

  if (!hasCurve) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}

function samplePath(p1: Pt, ctrl: Pt, p2: Pt, hasCurve: boolean, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    if (hasCurve) {
      const mt = 1 - t;
      pts.push({
        x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
        y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y,
      });
    } else {
      pts.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
    }
  }
  return pts;
}

function polylinesIntersect(a: Pt[], b: Pt[]): Intersection | null {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const at = segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1]);
      if (at !== null) return { at, segA: i, segB: j };
    }
  }
  return null;
}

function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-8) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

// ── Zone drawing ─────────────────────────────────────────────────────────────

function drawZone(ctx: CanvasRenderingContext2D, zone: Zone, pt: Pt, zoneRadius: number): void {
  const isSpawn = zone.name.startsWith("Spawn-");
  const isHub = zone.name === "Hub" || zone.name.startsWith("Hub-");
  const isNeutral = zone.name.startsWith("Neutral-");
  const isHoldCity = zone.mainObjects?.some(o => o.holdCityWinCon === true) ?? false;
  const castles = castleCount(zone);

  let rimColor: string;
  let rimWidth = 2.5;

  if (isHoldCity) {
    rimColor = HOLD_CITY_GOLD;
    rimWidth = 3.5;
  } else if (isNeutral) {
    rimColor = neutralTierRim(zone);
  } else if (isHub) {
    rimColor = RIM_HUB;
    rimWidth = 2.5;
  } else {
    // spawn
    rimColor = RIM_SPAWN;
  }

  const drawRadius = isHub ? Math.max(zoneRadius, HUB_RADIUS_MIN) : zoneRadius;

  drawCoin(ctx, pt, drawRadius, rimColor, rimWidth);

  if (isHoldCity) {
    drawHoldCityIcon(ctx, pt, drawRadius);
  } else if (isSpawn) {
    drawPlayerNumber(ctx, zone, pt, drawRadius);
    if (castles > 1) drawCastleBadge(ctx, pt, drawRadius, castles);
  } else if (isNeutral) {
    if (castles > 0) drawNeutralCastleContent(ctx, pt, castles, zoneRadius);
  } else if (isHub) {
    drawTextCentered(ctx, "Hub", pt.x, pt.y, fontPx(drawRadius * 0.85), NUMERAL_CREAM);
  }
}

function neutralTierRim(zone: Zone): string {
  const pool = zone.guardedContentPool?.[0] ?? "";
  if (pool.includes("_t4_") || pool.includes("_t5_")) return RIM_GOLD;
  if (pool.includes("_t2_") || pool.includes("_t1_")) return RIM_BRONZE;
  return RIM_SILVER;
}

function castleCount(zone: Zone): number {
  let count = 0;
  for (const obj of zone.mainObjects ?? []) {
    if (obj.type === "City" || obj.type === "Spawn") count++;
  }
  return count;
}

function drawPlayerNumber(ctx: CanvasRenderingContext2D, zone: Zone, centre: Pt, r: number): void {
  let label = "?";
  const spawnValue = zone.mainObjects?.find(o => o.type === "Spawn")?.spawn ?? null;
  if (spawnValue !== null && spawnValue.startsWith("Player")) {
    const number = spawnValue.slice("Player".length);
    // int.TryParse parity: optional sign + digits (whitespace tolerated).
    if (/^[+-]?\d+$/.test(number.trim())) label = number;
  }

  if (r <= 0) return;
  drawTextCentered(ctx, label, centre.x, centre.y, fontPx(r * 0.95), NUMERAL_CREAM);
}

function drawCastleBadge(ctx: CanvasRenderingContext2D, zoneCentre: Pt, r: number, castles: number): void {
  const bx = zoneCentre.x + r * 0.72;
  const by = zoneCentre.y + r * 0.72;
  const br = r * 0.7;
  if (br <= 0) return;

  ctx.fillStyle = COIN_FILL_EDGE;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = RIM_SPAWN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, TAU);
  ctx.stroke();

  const iconSize = br * 0.6;
  const fontSize = br * 1.0;

  drawHouseIcon(ctx, { x: bx - br * 0.32, y: by + 0.5 }, iconSize, NUMERAL_CREAM);
  drawTextCentered(ctx, String(castles), bx + br * 0.4, by + 0.5, fontPx(fontSize), NUMERAL_CREAM);
}

function drawNeutralCastleContent(ctx: CanvasRenderingContext2D, pt: Pt, castles: number, zoneRadius: number): void {
  if (zoneRadius <= 0) return;
  const countStr = String(castles);

  const iconW = zoneRadius * 0.55;
  const fontSize = zoneRadius * 0.62;
  const gap = zoneRadius * 0.12;

  const font = fontPx(fontSize);
  ctx.save();
  ctx.font = font;
  const textW = ctx.measureText(countStr).width;
  ctx.restore();

  const totalW = iconW + gap + textW;
  const startX = pt.x - totalW / 2;

  drawHouseIcon(ctx, { x: startX + iconW / 2, y: pt.y + 0.5 }, iconW, NUMERAL_CREAM);
  drawTextCentered(ctx, countStr, startX + iconW + gap + textW / 2, pt.y + 0.5, font, NUMERAL_CREAM);
}

function drawHoldCityIcon(ctx: CanvasRenderingContext2D, centre: Pt, r: number): void {
  // Crest pediment: small triangle above the house roof.
  const pedW = r * 0.8;
  const pedH = r * 0.28;
  const pedTop = centre.y - r * 0.95;
  ctx.fillStyle = HOLD_CITY_GOLD;
  ctx.beginPath();
  ctx.moveTo(centre.x, pedTop);
  ctx.lineTo(centre.x + pedW / 2, pedTop + pedH);
  ctx.lineTo(centre.x - pedW / 2, pedTop + pedH);
  ctx.closePath();
  ctx.fill();

  // House.
  const iconSize = r * 1.25;
  drawHouseIcon(ctx, { x: centre.x, y: centre.y + r * 0.1 }, iconSize, HOLD_CITY_GOLD);
}

function drawHouseIcon(ctx: CanvasRenderingContext2D, centre: Pt, size: number, color: string): void {
  const w = size * 0.9;
  const h = size;
  const rh = h * 0.45;

  const left = centre.x - w / 2;
  const right = centre.x + w / 2;
  const top = centre.y - h / 2;
  const roofBt = top + rh;
  const bottom = top + h;

  ctx.fillStyle = color;

  // Roof triangle (eaves overhang by 10% of the width on each side).
  ctx.beginPath();
  ctx.moveTo(centre.x, top);
  ctx.lineTo(right + w * 0.1, roofBt);
  ctx.lineTo(left - w * 0.1, roofBt);
  ctx.closePath();
  ctx.fill();

  // Body rectangle.
  ctx.fillRect(left, roofBt, right - left, bottom - roofBt);
}
