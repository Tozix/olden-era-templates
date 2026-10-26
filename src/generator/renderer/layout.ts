/**
 * Pure layout logic ported from TemplatePreviewRenderer.ComputeLayout (C#).
 *
 * No DOM access — node-testable. Positions are CANVAS PIXELS in a 700×700 image,
 * keyed by zone name, exactly like the C# dictionary; `zoneRadius` mirrors the
 * C# [ThreadStatic] GetLastZoneRadius. Fully deterministic: no Math.random.
 */

import type { Connection, RmgTemplate, Zone } from "../template";
import type { MapTopology } from "../enums";

/** Canvas-pixel point for one zone. */
export interface ZoneLayoutPoint {
  x: number;
  y: number;
}

/** Zone positions plus the zone-circle radius used while laying out. */
export interface ComputedLayout {
  positions: Map<string, ZoneLayoutPoint>;
  zoneRadius: number;
}

const WIDTH = 700;
const HEIGHT = 700;
const ZONE_RADIUS_MAX = 38;
const HUB_RADIUS_MIN = 28;

/** Rotates the zone list so zeroAngleZone comes first (C# OrderZones). */
export function orderZones(zones: Zone[], zeroAngleZone: string | null | undefined): Zone[] {
  const ordered = zones.slice();
  const hasZero = zeroAngleZone !== null && zeroAngleZone !== undefined && zeroAngleZone.trim().length > 0;
  const zeroIndex = hasZero ? ordered.findIndex(z => z.name === zeroAngleZone) : -1;
  if (zeroIndex <= 0) return ordered;
  return ordered.slice(zeroIndex).concat(ordered.slice(0, zeroIndex));
}

/**
 * Port of TemplatePreviewRenderer.ComputeLayout. Returns canvas positions for
 * every zone of the template's first variant, keyed by zone name.
 */
export function computeLayout(template: RmgTemplate, topology: MapTopology): ComputedLayout {
  const variant = template.variants?.[0];
  const zones = variant?.zones ?? [];
  if (zones.length === 0) {
    return { positions: new Map<string, ZoneLayoutPoint>(), zoneRadius: ZONE_RADIUS_MAX };
  }
  const orderedZones = orderZones(zones, variant?.orientation?.zeroAngleZone);
  const connections = variant?.connections ?? [];
  return layoutZones(orderedZones, connections, topology);
}

// ── Graph helpers ────────────────────────────────────────────────────────────

function buildAdjacency(n: number, idx: Map<string, number>, connections: Connection[]): Set<number>[] {
  const adj: Set<number>[] = [];
  for (let i = 0; i < n; i++) adj.push(new Set<number>());
  for (const conn of connections) {
    if (conn.connectionType === "Proximity") continue;
    if (conn.connectionType === "Portal") continue;
    const a = idx.get(conn.from);
    const b = idx.get(conn.to);
    if (a === undefined || b === undefined) continue;
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

function connectedComponents(adj: Set<number>[], n: number): number[][] {
  const compOf = new Array<number>(n).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (compOf[start] >= 0) continue;
    const comp: number[] = [];
    const queue: number[] = [start];
    let head = 0;
    compOf[start] = components.length;
    while (head < queue.length) {
      const u = queue[head++];
      comp.push(u);
      for (const v of adj[u]) {
        if (compOf[v] < 0) {
          compOf[v] = components.length;
          queue.push(v);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

// ── Overlap resolution passes (shared by generator-position and FR paths) ────

function pushApartMinDistance(px: number[], py: number[], minDist: number): boolean {
  const n = px.length;
  let any = false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dx = px[i] - px[j];
      let dy = py[i] - py[j];
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d >= minDist) continue;
      if (d < 0.001) {
        dx = 1;
        dy = 0;
        d = 0.001;
      }
      const push = (minDist - d) / 2;
      px[i] += (dx / d) * push;
      py[i] += (dy / d) * push;
      px[j] -= (dx / d) * push;
      py[j] -= (dy / d) * push;
      any = true;
    }
  }
  return any;
}

/** Moves nodes whose projection onto an edge is closer than edgeClear to the freer side. */
function fixEdgeClearance(px: number[], py: number[], adj: Set<number>[], edgeClear: number): boolean {
  const n = px.length;
  let any = false;
  for (let a = 0; a < n; a++) {
    for (const b of adj[a]) {
      if (b <= a) continue;
      const ex = px[b] - px[a];
      const ey = py[b] - py[a];
      const elen2 = ex * ex + ey * ey;
      if (elen2 < 0.001) continue;
      const elenInv = 1 / Math.sqrt(elen2);
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        const tProj = ((px[c] - px[a]) * ex + (py[c] - py[a]) * ey) / elen2;
        if (tProj < 0 || tProj > 1) continue;
        const projX = px[a] + tProj * ex;
        const projY = py[a] + tProj * ey;
        const nx = px[c] - projX;
        const ny = py[c] - projY;
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= edgeClear) continue;
        const perpX = dist < 0.001 ? ey * elenInv : nx / dist;
        const perpY = dist < 0.001 ? -ex * elenInv : ny / dist;
        const sideAx = projX + perpX * edgeClear;
        const sideAy = projY + perpY * edgeClear;
        const sideBx = projX - perpX * edgeClear;
        const sideBy = projY - perpY * edgeClear;
        let scoreA = 0;
        let scoreB = 0;
        for (const nb of adj[c]) {
          const dax = sideAx - px[nb];
          const day = sideAy - py[nb];
          const dbx = sideBx - px[nb];
          const dby = sideBy - py[nb];
          scoreA += dax * dax + day * day;
          scoreB += dbx * dbx + dby * dby;
        }
        if (scoreB < scoreA) {
          px[c] = sideBx;
          py[c] = sideBy;
        } else {
          px[c] = sideAx;
          py[c] = sideAy;
        }
        any = true;
      }
    }
  }
  return any;
}

/** min-distance + edge-clearance passes, up to maxPasses (C# AB loop). */
function resolveOverlaps(
  px: number[],
  py: number[],
  adj: Set<number>[],
  minDist: number,
  edgeClear: number,
  maxPasses: number,
): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    const anyPush = pushApartMinDistance(px, py, minDist);
    const anyClear = fixEdgeClearance(px, py, adj, edgeClear);
    if (!anyPush && !anyClear) break;
  }
}

// ── Fruchterman–Reingold spring embedder (per component) ─────────────────────

function springEmbed(px: number[], py: number[], ladj: Set<number>[], idealEdge: number): void {
  const cn = px.length;
  const k = idealEdge;
  let t = k * 2.5;
  const tMin = k * 0.005;
  const frIter = 400;
  const cool = Math.pow(tMin / t, 1 / frIter);
  const fx = new Array<number>(cn).fill(0);
  const fy = new Array<number>(cn).fill(0);

  for (let iter = 0; iter < frIter; iter++) {
    fx.fill(0);
    fy.fill(0);

    // Repulsion: k²/d between every pair.
    for (let i = 0; i < cn; i++) {
      for (let j = i + 1; j < cn; j++) {
        let dx = px[i] - px[j];
        let dy = py[i] - py[j];
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.001) {
          dx = 0.5 + i * 0.1;
          dy = 0.5 + j * 0.1;
          d = Math.sqrt(dx * dx + dy * dy);
        }
        const fr = (k * k) / d;
        fx[i] += (fr * dx) / d;
        fy[i] += (fr * dy) / d;
        fx[j] -= (fr * dx) / d;
        fy[j] -= (fr * dy) / d;
      }
    }

    // Attraction: d²/k along edges.
    for (let i = 0; i < cn; i++) {
      for (const j of ladj[i]) {
        if (j <= i) continue;
        const dx = px[i] - px[j];
        const dy = py[i] - py[j];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.001) continue;
        const fa = (d * d) / k;
        fx[i] -= (fa * dx) / d;
        fy[i] -= (fa * dy) / d;
        fx[j] += (fa * dx) / d;
        fy[j] += (fa * dy) / d;
      }
    }

    // Cap displacement by the cooling temperature.
    for (let i = 0; i < cn; i++) {
      const len = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]);
      if (len > t && len > 0.001) {
        fx[i] = (fx[i] / len) * t;
        fy[i] = (fy[i] / len) * t;
      }
      px[i] += fx[i];
      py[i] += fy[i];
    }
    t = Math.max(t * cool, tMin);
  }
}

/** Snap pass after FR: edge clearance first, then a min-distance push. */
function snapEdgeClearance(
  px: number[],
  py: number[],
  adj: Set<number>[],
  edgeClear: number,
  minDist: number,
  maxPasses: number,
): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    const anySnap = fixEdgeClearance(px, py, adj, edgeClear);
    if (!anySnap) break;
    pushApartMinDistance(px, py, minDist);
  }
}

// ── LayoutZones ──────────────────────────────────────────────────────────────

function layoutZones(zones: Zone[], connections: Connection[], topology: MapTopology): ComputedLayout {
  // Structured topologies use the simple ring layout. Random uses the spring
  // embedder. Balanced uses the same generator-position pipeline as Random,
  // with a ring-snap pre-pass to clean up the concentric arrangement.
  if (topology !== "Random" && topology !== "Balanced") {
    return layoutZonesRing(zones, connections);
  }

  const n = zones.length;
  if (n === 0) {
    return { positions: new Map<string, ZoneLayoutPoint>(), zoneRadius: ZONE_RADIUS_MAX };
  }
  if (n === 1) {
    const positions = new Map<string, ZoneLayoutPoint>();
    positions.set(zones[0].name, { x: WIDTH / 2, y: HEIGHT / 2 });
    return { positions, zoneRadius: ZONE_RADIUS_MAX };
  }

  const margin = 18;
  const minGap = 6;
  const idx = new Map<string, number>();
  zones.forEach((z, i) => idx.set(z.name, i));

  // ── If zones already carry generator-stamped positions, use them ──
  if (zones.every(z => z.generatorPosition != null)) {
    // Ring-snap pass (Balanced topology only): snaps zones to clean evenly-spaced
    // concentric rings. Skipped for Random so scattered positions are never forced
    // into a false circular arrangement.
    if (topology === "Balanced") {
      const snapped = tryRingSnap(zones, connections, idx, n, margin, minGap);
      if (snapped !== null) return snapped;
    }

    const gAdj = buildAdjacency(n, idx, connections);
    const gComponents = connectedComponents(gAdj, n);
    const gMaxCompSize = gComponents.reduce((m, c) => Math.max(m, c.length), 0);
    const isTwoCluster = gComponents.length === 2;

    const ringRadius0 = (isTwoCluster ? WIDTH / 4 : WIDTH / 2) - margin;
    const chord0 = 2 * ringRadius0 * Math.sin(Math.PI / Math.max(gMaxCompSize, 2));
    let gZoneRadius = Math.min(ZONE_RADIUS_MAX, (chord0 - minGap) / 2);
    gZoneRadius = Math.max(gZoneRadius, 8);
    let zoneRadius = gZoneRadius;

    const idealEdge2 = gZoneRadius * 3.2;
    let rawEdgeSum = 0;
    let rawEdgeCount = 0;
    for (let i = 0; i < n; i++) {
      for (const j of gAdj[i]) {
        if (j <= i) continue;
        const pi = zones[i].generatorPosition!;
        const pj = zones[j].generatorPosition!;
        rawEdgeSum += Math.sqrt((pi.x - pj.x) * (pi.x - pj.x) + (pi.y - pj.y) * (pi.y - pj.y));
        rawEdgeCount++;
      }
    }
    const gScale =
      rawEdgeCount > 0
        ? idealEdge2 / (rawEdgeSum / rawEdgeCount)
        : Math.min((WIDTH - 2 * margin) / 1, (HEIGHT - 2 * margin) / 1);

    const canvasCx = WIDTH / 2;
    const canvasCy = HEIGHT / 2;
    const gPx = new Array<number>(n).fill(0);
    const gPy = new Array<number>(n).fill(0);
    const gPad = gZoneRadius + margin;

    if (isTwoCluster) {
      const halfDrawW = WIDTH / 2 - gPad;
      const drawH = HEIGHT - 2 * gPad;

      gComponents.forEach((comp, compIdx) => {
        let cMinX = Infinity;
        let cMaxX = -Infinity;
        let cMinY = Infinity;
        let cMaxY = -Infinity;
        for (const i of comp) {
          const gp = zones[i].generatorPosition!;
          if (gp.x < cMinX) cMinX = gp.x;
          if (gp.x > cMaxX) cMaxX = gp.x;
          if (gp.y < cMinY) cMinY = gp.y;
          if (gp.y > cMaxY) cMaxY = gp.y;
        }
        const cSpanX = Math.max(cMaxX - cMinX, 0.001);
        const cSpanY = Math.max(cMaxY - cMinY, 0.001);

        const scaleX = halfDrawW / cSpanX;
        const scaleY = drawH / cSpanY;
        const localScale = Math.min(Math.min(scaleX, scaleY), gScale);

        const halfCx = compIdx === 0 ? gPad + halfDrawW / 2 : WIDTH - gPad - halfDrawW / 2;
        const halfCy = HEIGHT / 2;

        const rawCx = (cMinX + cMaxX) / 2;
        const rawCy = (cMinY + cMaxY) / 2;

        for (const i of comp) {
          const gp = zones[i].generatorPosition!;
          gPx[i] = halfCx + (gp.x - rawCx) * localScale;
          gPy[i] = halfCy + (gp.y - rawCy) * localScale;
        }
      });
    } else {
      let gCx = 0;
      let gCy = 0;
      for (const z of zones) {
        gCx += z.generatorPosition!.x;
        gCy += z.generatorPosition!.y;
      }
      gCx /= n;
      gCy /= n;

      for (let i = 0; i < n; i++) {
        const gp = zones[i].generatorPosition!;
        gPx[i] = (gp.x - gCx) * gScale;
        gPy[i] = (gp.y - gCy) * gScale;
      }

      const rawMinX = Math.min(...gPx);
      const rawMaxX = Math.max(...gPx);
      const rawMinY = Math.min(...gPy);
      const rawMaxY = Math.max(...gPy);
      const drawW2 = WIDTH - 2 * gPad;
      const drawH2 = HEIGHT - 2 * gPad;
      let fitScale = 1;
      if (rawMaxX - rawMinX > drawW2 && rawMaxX - rawMinX > 0.001) {
        fitScale = Math.min(fitScale, drawW2 / (rawMaxX - rawMinX));
      }
      if (rawMaxY - rawMinY > drawH2 && rawMaxY - rawMinY > 0.001) {
        fitScale = Math.min(fitScale, drawH2 / (rawMaxY - rawMinY));
      }

      for (let i = 0; i < n; i++) {
        gPx[i] = canvasCx + gPx[i] * fitScale;
        gPy[i] = canvasCy + gPy[i] * fitScale;
      }
    }

    const gMinDist = gZoneRadius * 3.8;
    const gEdgeClear = gZoneRadius * 1.2;
    resolveOverlaps(gPx, gPy, gAdj, gMinDist, gEdgeClear, 500);

    {
      let finalMinX = Math.min(...gPx);
      let finalMaxX = Math.max(...gPx);
      let finalMinY = Math.min(...gPy);
      let finalMaxY = Math.max(...gPy);
      const finalCx = (finalMinX + finalMaxX) / 2;
      const finalCy = (finalMinY + finalMaxY) / 2;
      for (let i = 0; i < n; i++) {
        gPx[i] += canvasCx - finalCx;
        gPy[i] += canvasCy - finalCy;
      }

      finalMinX = Math.min(...gPx);
      finalMaxX = Math.max(...gPx);
      finalMinY = Math.min(...gPy);
      finalMaxY = Math.max(...gPy);
      const spanX = finalMaxX - finalMinX;
      const spanY = finalMaxY - finalMinY;
      const allowW = WIDTH - 2 * gPad;
      const allowH = HEIGHT - 2 * gPad;
      let shrink = 1;
      if (spanX > allowW && spanX > 0.001) shrink = Math.min(shrink, allowW / spanX);
      if (spanY > allowH && spanY > 0.001) shrink = Math.min(shrink, allowH / spanY);
      if (shrink < 1) {
        for (let i = 0; i < n; i++) {
          gPx[i] = canvasCx + (gPx[i] - canvasCx) * shrink;
          gPy[i] = canvasCy + (gPy[i] - canvasCy) * shrink;
        }
        zoneRadius = Math.max(gZoneRadius * shrink, 8);
      }
    }

    const positions = new Map<string, ZoneLayoutPoint>();
    for (let i = 0; i < n; i++) positions.set(zones[i].name, { x: gPx[i], y: gPy[i] });
    return { positions, zoneRadius };
  }

  // ── Otherwise: Fruchterman-Reingold spring embedder per component ──
  const adj = buildAdjacency(n, idx, connections);
  const components = connectedComponents(adj, n);
  const numComps = components.length;
  const maxCompSize = components.reduce((m, c) => Math.max(m, c.length), 0);

  let zoneRadius: number;
  if (maxCompSize <= 1) {
    zoneRadius = ZONE_RADIUS_MAX;
  } else {
    const ringRadius0 = WIDTH / 2 - margin;
    const chord0 = 2 * ringRadius0 * Math.sin(Math.PI / maxCompSize);
    zoneRadius = Math.min(ZONE_RADIUS_MAX, (chord0 - minGap) / 2);
    zoneRadius = Math.max(zoneRadius, 8);
  }

  const idealEdge = zoneRadius * 3.2;
  const compPx: number[][] = [];
  const compPy: number[][] = [];

  for (let c = 0; c < numComps; c++) {
    const comp = components[c];
    const cn = comp.length;
    const lpx = new Array<number>(cn).fill(0);
    const lpy = new Array<number>(cn).fill(0);

    const localIdx = new Map<number, number>();
    comp.forEach((gi, i) => localIdx.set(gi, i));

    if (cn === 1) {
      compPx.push(lpx);
      compPy.push(lpy);
      continue;
    }

    const ladj: Set<number>[] = [];
    for (let i = 0; i < cn; i++) ladj.push(new Set<number>());
    for (let i = 0; i < cn; i++) {
      for (const gv of adj[comp[i]]) {
        const lv = localIdx.get(gv);
        if (lv !== undefined) {
          ladj[i].add(lv);
          ladj[lv].add(i);
        }
      }
    }

    if (cn === 2) {
      lpx[0] = -idealEdge / 2;
      lpx[1] = idealEdge / 2;
      compPx.push(lpx);
      compPy.push(lpy);
      continue;
    }

    // Seed on a ring, then run FR with cooling.
    let seedR = (idealEdge * cn) / (2 * Math.PI);
    seedR = Math.max(seedR, idealEdge);
    for (let i = 0; i < cn; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / cn;
      lpx[i] = Math.cos(ang) * seedR;
      lpy[i] = Math.sin(ang) * seedR;
    }

    springEmbed(lpx, lpy, ladj, idealEdge);

    const minDist = zoneRadius * 3.8;
    const edgeClear = zoneRadius * 1.2;
    resolveOverlaps(lpx, lpy, ladj, minDist, edgeClear, 500);
    snapEdgeClearance(lpx, lpy, ladj, edgeClear, minDist, 200);

    compPx.push(lpx);
    compPy.push(lpy);
  }

  const compMinX = compPx.map(p => Math.min(...p));
  const compMaxX = compPx.map(p => Math.max(...p));
  const compMinY = compPy.map(p => Math.min(...p));
  const compMaxY = compPy.map(p => Math.max(...p));

  const pad = zoneRadius + margin;
  const positions = new Map<string, ZoneLayoutPoint>();

  if (numComps === 1) {
    const comp = components[0];
    const spanX = Math.max(compMaxX[0] - compMinX[0], 1);
    const spanY = Math.max(compMaxY[0] - compMinY[0], 1);
    const drawW = WIDTH - 2 * pad;
    const drawH = HEIGHT - 2 * pad;
    const scale = Math.min(drawW / spanX, drawH / spanY);
    const offX = pad + (drawW - spanX * scale) / 2;
    const offY = pad + (drawH - spanY * scale) / 2;
    comp.forEach((gi, i) => {
      positions.set(zones[gi].name, {
        x: offX + (compPx[0][i] - compMinX[0]) * scale,
        y: offY + (compPy[0][i] - compMinY[0]) * scale,
      });
    });
  } else {
    const stackVertical = numComps === 2 && HEIGHT >= WIDTH;

    const interGap = zoneRadius * 3;
    const totalDraw = (stackVertical ? HEIGHT : WIDTH) - 2 * pad - interGap * (numComps - 1);
    const slotSize = totalDraw / numComps;
    const crossDraw = (stackVertical ? WIDTH : HEIGHT) - 2 * pad;

    let uniformScale = Number.MAX_VALUE;
    for (let c = 0; c < numComps; c++) {
      const spanMain = stackVertical ? compMaxY[c] - compMinY[c] : compMaxX[c] - compMinX[c];
      const spanCross = stackVertical ? compMaxX[c] - compMinX[c] : compMaxY[c] - compMinY[c];
      if (spanMain > 0.001) uniformScale = Math.min(uniformScale, (slotSize - 2 * zoneRadius) / spanMain);
      if (spanCross > 0.001) uniformScale = Math.min(uniformScale, crossDraw / spanCross);
    }
    if (uniformScale >= Number.MAX_VALUE / 2) uniformScale = 1;
    uniformScale = Math.max(uniformScale, 0.1);

    let cursor = pad;
    for (let c = 0; c < numComps; c++) {
      const comp = components[c];
      const spanMain = stackVertical ? compMaxY[c] - compMinY[c] : compMaxX[c] - compMinX[c];
      const spanCross = stackVertical ? compMaxX[c] - compMinX[c] : compMaxY[c] - compMinY[c];

      const mainExtent = spanMain * uniformScale;
      const crossExtent = spanCross * uniformScale;

      const mainStart = cursor + (slotSize - mainExtent) / 2;
      const crossStart = pad + (crossDraw - crossExtent) / 2;

      comp.forEach((gi, i) => {
        const mainVal = stackVertical ? compPy[c][i] : compPx[c][i];
        const crossVal = stackVertical ? compPx[c][i] : compPy[c][i];
        const mainOff = stackVertical ? compMinY[c] : compMinX[c];
        const crossOff = stackVertical ? compMinX[c] : compMinY[c];

        const px = stackVertical
          ? crossStart + (crossVal - crossOff) * uniformScale
          : mainStart + (mainVal - mainOff) * uniformScale;
        const py = stackVertical
          ? mainStart + (mainVal - mainOff) * uniformScale
          : crossStart + (crossVal - crossOff) * uniformScale;

        positions.set(zones[gi].name, { x: px, y: py });
      });

      cursor += slotSize + interGap;
    }
  }

  return { positions, zoneRadius };
}

// ── Ring-snap pass (Balanced) ────────────────────────────────────────────────

/**
 * Detects concentric rings in the raw generator positions (gap-based clustering
 * on distance-from-centroid) and snaps each ring to perfectly even spacing.
 * Returns null when no ring structure is found in any cluster.
 */
function tryRingSnap(
  zones: Zone[],
  connections: Connection[],
  idx: Map<string, number>,
  n: number,
  margin: number,
  minGap: number,
): ComputedLayout | null {
  const bAdj = buildAdjacency(n, idx, connections);
  const bComponents = connectedComponents(bAdj, n);
  const isTwoCluster = bComponents.length === 2;
  const ringGapThreshold = 0.03;

  const rPx = new Array<number>(n).fill(0);
  const rPy = new Array<number>(n).fill(0);
  let bestZoneRadius = ZONE_RADIUS_MAX;
  let allClustersSnapped = true;

  for (let ci = 0; ci < bComponents.length; ci++) {
    const comp = bComponents[ci];
    const cn = comp.length;

    const canvasXMin = isTwoCluster ? (ci === 0 ? margin : WIDTH / 2 + margin / 2) : margin;
    const canvasXMax = isTwoCluster ? (ci === 0 ? WIDTH / 2 - margin / 2 : WIDTH - margin) : WIDTH - margin;
    const canvasYMin = margin;
    const canvasYMax = HEIGHT - margin;
    const clCx = (canvasXMin + canvasXMax) / 2;
    const clCy = (canvasYMin + canvasYMax) / 2;
    const clW = canvasXMax - canvasXMin;
    const clH = canvasYMax - canvasYMin;

    let rawClCx = 0;
    let rawClCy = 0;
    for (const i of comp) {
      rawClCx += zones[i].generatorPosition!.x;
      rawClCy += zones[i].generatorPosition!.y;
    }
    rawClCx /= cn;
    rawClCy /= cn;

    const clusterByDist = comp
      .map(i => {
        const dx = zones[i].generatorPosition!.x - rawClCx;
        const dy = zones[i].generatorPosition!.y - rawClCy;
        return { idx: i, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((p, q) => p.dist - q.dist);

    const clRingLabel = new Array<number>(n).fill(0);
    let clRingCount = 0;
    clRingLabel[clusterByDist[0].idx] = 0;
    for (let k = 1; k < cn; k++) {
      if (clusterByDist[k].dist - clusterByDist[k - 1].dist > ringGapThreshold) clRingCount++;
      clRingLabel[clusterByDist[k].idx] = clRingCount;
    }
    clRingCount++;

    if (clRingCount < 2) {
      allClustersSnapped = false;
      break;
    }

    const clRingIndices: number[][] = [];
    for (let r = 0; r < clRingCount; r++) {
      clRingIndices.push(comp.filter(i => clRingLabel[i] === r));
    }

    const drawRadius = Math.min(clW, clH) / 2 - ZONE_RADIUS_MAX;

    const assignRingRadii = (zr: number): number[] => {
      const mc = 2 * zr + minGap;
      const radii = new Array<number>(clRingCount).fill(0);
      for (let r = 0; r < clRingCount; r++) {
        const cnt = clRingIndices[r].length;
        const natural = (drawRadius * (r + 1)) / clRingCount;
        const withinRing =
          cnt >= 2 ? mc / (2 * Math.sin(Math.PI / cnt)) : cnt === 1 && r > 0 ? mc : 0;
        const afterPrev = r > 0 ? radii[r - 1] + mc : 0;
        radii[r] = Math.max(natural, Math.max(withinRing, afterPrev));
      }
      return radii;
    };

    // Binary search the largest zone radius whose rings still fit the cluster.
    let lo = 8;
    let hi = ZONE_RADIUS_MAX;
    for (let iter = 0; iter < 32; iter++) {
      const mid = (lo + hi) / 2;
      const r2 = assignRingRadii(mid);
      if (r2[clRingCount - 1] <= drawRadius) lo = mid;
      else hi = mid;
    }
    const clZoneRadius = Math.max(lo, 8);
    bestZoneRadius = Math.min(bestZoneRadius, clZoneRadius);

    const ringRadii = assignRingRadii(clZoneRadius);

    for (let r = 0; r < clRingCount; r++) {
      const group = clRingIndices[r];
      const cnt = group.length;
      const canvasRadius = ringRadii[r];

      if (cnt === 1 && r === 0) {
        rPx[group[0]] = clCx;
        rPy[group[0]] = clCy;
        continue;
      }

      const sortedByAngle = group.slice().sort((i, j) => {
        const ai = Math.atan2(zones[i].generatorPosition!.y - rawClCy, zones[i].generatorPosition!.x - rawClCx);
        const aj = Math.atan2(zones[j].generatorPosition!.y - rawClCy, zones[j].generatorPosition!.x - rawClCx);
        return ai - aj;
      });

      const firstAngle = Math.atan2(
        zones[sortedByAngle[0]].generatorPosition!.y - rawClCy,
        zones[sortedByAngle[0]].generatorPosition!.x - rawClCx,
      );

      for (let j = 0; j < cnt; j++) {
        const angle = firstAngle + (2 * Math.PI * j) / cnt;
        rPx[sortedByAngle[j]] = clCx + Math.cos(angle) * canvasRadius;
        rPy[sortedByAngle[j]] = clCy + Math.sin(angle) * canvasRadius;
      }
    }
  }

  if (!allClustersSnapped) return null;

  const positions = new Map<string, ZoneLayoutPoint>();
  for (let i = 0; i < n; i++) positions.set(zones[i].name, { x: rPx[i], y: rPy[i] });
  return { positions, zoneRadius: bestZoneRadius };
}

// ── Ring layouts (structured topologies) ─────────────────────────────────────

/** Classic ring layout for Default/HubAndSpoke/Chain/SharedWeb. Hub goes centre. */
function layoutZonesRing(zones: Zone[], connections: Connection[]): ComputedLayout {
  const positions = new Map<string, ZoneLayoutPoint>();
  const n = zones.length;
  if (n === 0) {
    return { positions, zoneRadius: ZONE_RADIUS_MAX };
  }

  const multiHubs = zones.filter(z => z.name.startsWith("Hub-"));
  if (multiHubs.length >= 2) {
    return layoutZonesMultiHub(zones, connections, multiHubs);
  }

  const margin = 18;
  const ringRadius0 = WIDTH / 2 - margin;
  const chord0 = 2 * ringRadius0 * Math.sin(Math.PI / Math.max(1, n));
  const minGap = 6;
  const zoneRadius = Math.min(ZONE_RADIUS_MAX, (chord0 - minGap) / 2);

  const hub = zones.find(z => z.name === "Hub") ?? null;
  const outer = hub !== null ? zones.filter(z => z !== hub) : zones.slice();
  const outerN = Math.max(1, outer.length);

  const ringRadius = Math.max(
    HUB_RADIUS_MIN + zoneRadius + minGap,
    Math.min(ringRadius0, WIDTH / 2 - zoneRadius - margin),
  );
  const center: ZoneLayoutPoint = { x: WIDTH / 2, y: HEIGHT / 2 };

  if (hub !== null) positions.set(hub.name, { x: center.x, y: center.y });

  if (n === 1) {
    positions.set(zones[0].name, { x: center.x, y: center.y });
    return { positions, zoneRadius };
  }

  for (let i = 0; i < outer.length; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / outerN;
    positions.set(outer[i].name, {
      x: center.x + Math.cos(angle) * ringRadius,
      y: center.y + Math.sin(angle) * ringRadius,
    });
  }

  return { positions, zoneRadius };
}

/** Multi-hub cluster layout (tournament hub-and-spoke). */
function layoutZonesMultiHub(zones: Zone[], connections: Connection[], multiHubs: Zone[]): ComputedLayout {
  const positions = new Map<string, ZoneLayoutPoint>();
  const margin = 18;
  const minGap = 6;

  const zoneByName = new Map<string, Zone>();
  for (const z of zones) zoneByName.set(z.name, z);

  const hubSpokes = new Map<string, Zone[]>();
  for (const hub of multiHubs) {
    const spokes: Zone[] = [];
    const seen = new Set<string>();
    for (const c of connections) {
      if (c.connectionType === "Proximity") continue;
      if (c.connectionType === "Portal") continue;
      const other = c.from === hub.name ? c.to : c.to === hub.name ? c.from : null;
      if (other === null) continue;
      const z = zoneByName.get(other);
      if (z !== undefined && !seen.has(other)) {
        seen.add(other);
        spokes.push(z);
      }
    }
    hubSpokes.set(hub.name, spokes);
  }

  let maxSpokes = 0;
  for (const s of hubSpokes.values()) maxSpokes = Math.max(maxSpokes, s.length);
  const numHubs = multiHubs.length;

  const canvasHalf = WIDTH / 2 - margin;
  const sinB = numHubs > 1 ? Math.sin(Math.PI / numHubs) : 0;
  const sinA = maxSpokes > 1 ? Math.sin(Math.PI / maxSpokes) : 1;

  const hubRingRadius = numHubs > 1 ? (canvasHalf + minGap / 2) / (1 + sinB) : 0;

  const radialLeft = canvasHalf - hubRingRadius;
  const minSpokeR = HUB_RADIUS_MIN + minGap;
  let zoneRadius = Math.min(ZONE_RADIUS_MAX, (radialLeft * sinA - minGap / 2) / (1 + sinA));
  zoneRadius = Math.max(1, zoneRadius);
  const spokeRingRadius = Math.max(radialLeft - zoneRadius, minSpokeR + zoneRadius);

  const canvasCenter: ZoneLayoutPoint = { x: WIDTH / 2, y: HEIGHT / 2 };

  for (let h = 0; h < numHubs; h++) {
    const hub = multiHubs[h];

    const hubAngle = -Math.PI / 2 + (h * Math.PI * 2) / numHubs;
    const hubPos: ZoneLayoutPoint =
      numHubs === 1
        ? { x: canvasCenter.x, y: canvasCenter.y }
        : {
            x: canvasCenter.x + Math.cos(hubAngle) * hubRingRadius,
            y: canvasCenter.y + Math.sin(hubAngle) * hubRingRadius,
          };

    positions.set(hub.name, hubPos);

    const spokes = hubSpokes.get(hub.name) ?? [];
    const s = spokes.length;
    if (s === 0) continue;

    const spokeBaseAngle = numHubs === 1 ? -Math.PI / 2 : hubAngle;
    for (let i = 0; i < s; i++) {
      const spokeAngle = spokeBaseAngle + (i * Math.PI * 2) / s;
      positions.set(spokes[i].name, {
        x: hubPos.x + Math.cos(spokeAngle) * spokeRingRadius,
        y: hubPos.y + Math.sin(spokeAngle) * spokeRingRadius,
      });
    }
  }

  for (const zone of zones) {
    if (!positions.has(zone.name)) {
      positions.set(zone.name, { x: canvasCenter.x, y: canvasCenter.y });
    }
  }

  return { positions, zoneRadius };
}
