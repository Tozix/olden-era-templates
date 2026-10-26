import type { Rng } from "../rng";
import type { Connection, Variant, Zone } from "../template";
import {
  scaleBorderGuardValue,
  type GenerationTuning,
  type NeutralZonePlan,
} from "./shared";
import { compareOrdinal, neutralZoneBalanceScore } from "./neutralPlan";
import { connectionEndpoint, mainObjectEndpoint, plainRoad } from "./zones";

/**
 * Порт геометрии/связностей TemplateGenerator.cs: триангуляция
 * Bowyer–Watson, portal-пиринг через неравнозначную перестановку,
 * ring-подключения, фейлсейфы связности, фабрика варианта.
 */

/** Точка [0..1]² — позиционная подсказка (C#-кортеж (double X, double Y)). */
export interface Pos {
  x: number;
  y: number;
}

/** Ребро (A, B), A < B — неориентированное. */
export type ProximityEdge = [number, number];

/**
 * Connection-литерал в порядке объявления свойств C#-модели.
 * Не заданные поля получают null (при сериализации отбрасываются), поэтому
 * поздние штампы (guardProgression, connectionDefaults) не меняют порядок
 * ключей относительно C#-эмиата.
 */
export function makeConnection(
  p: Partial<Connection> & Pick<Connection, "from" | "to">,
): Connection {
  return {
    name: p.name ?? null,
    from: p.from,
    to: p.to,
    connectionType: p.connectionType ?? null,
    guardZone: p.guardZone ?? null,
    guardEscape: p.guardEscape ?? null,
    simTurnSquad: p.simTurnSquad ?? null,
    guardValue: p.guardValue ?? null,
    guardWeeklyIncrement: p.guardWeeklyIncrement ?? null,
    guardRandomization: p.guardRandomization ?? null,
    guardMatchGroup: p.guardMatchGroup ?? null,
    portalPlacementRulesFrom: p.portalPlacementRulesFrom ?? null,
    portalPlacementRulesTo: p.portalPlacementRulesTo ?? null,
    road: p.road ?? null,
    gatePlacement: p.gatePlacement ?? null,
    length: p.length ?? null,
  };
}

/** Группа качества зоны для balanced-фильтра рёбер (0 = игрок). */
export function zoneQualityGroup(
  letter: string,
  playerLetters: string[],
  neutralByLetter: Map<string, NeutralZonePlan>,
): number {
  if (playerLetters.includes(letter)) return 0;
  const plan = neutralByLetter.get(letter);
  if (!plan) return 2;
  const isCity = plan.castleCount > 0;
  switch (plan.quality) {
    case "High":
      return isCity ? 7 : 6;
    case "Medium":
      return isCity ? 5 : 4;
    default:
      return isCity ? 3 : 2;
  }
}

export function buildBalancedRandomPositions(
  orderedLetters: string[],
  playerLetters: string[],
  neutralByLetter: Map<string, NeutralZonePlan>,
): Pos[] {
  const count = orderedLetters.length;
  if (count === 0) return [];

  const playerSet = new Set(playerLetters);
  const positions: Pos[] = [];
  for (let i = 0; i < count; i++) {
    const letter = orderedLetters[i];
    const isPlayer = playerSet.has(letter);
    const angle = (2.0 * Math.PI * i) / count;
    const jitter = isPlayer ? 0.0 : ((i % 3) - 1) * 0.018;

    let radius = 0.43;
    const neutralZone = neutralByLetter.get(letter);
    if (!isPlayer && neutralZone) {
      radius = 0.3 + neutralZoneBalanceScore(neutralZone) * 0.035 + (i % 2) * 0.012;
    }

    positions.push({
      x: clamp(0.5 + Math.cos(angle + jitter) * radius, 0.05, 0.95),
      y: clamp(0.5 + Math.sin(angle + jitter) * radius, 0.05, 0.95),
    });
  }

  return positions;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Треугольник — индексы вершин в массиве точек. */
interface Triangle {
  i0: number;
  i1: number;
  i2: number;
}

// ── Триангуляция Делоне (Bowyer–Watson) ──────────────────────────────────────

/**
 * Уникальные неориентированные рёбра триангуляции Делоне заданных точек.
 * Каждое ребро (A, B) имеет A < B.
 */
export function delaunayEdges(pts: Pos[]): ProximityEdge[] {
  const n = pts.length;
  if (n === 1) return [];
  if (n === 2) return [[0, 1]];

  // Супер-треугольник, достаточно большой, чтобы вместить все точки.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX, dy = maxY - minY;
  const delta = Math.max(dx, dy) * 10;
  const superPts: Pos[] = [
    ...pts,
    { x: minX - delta, y: minY - delta * 3 },
    { x: minX + delta * 3, y: minY - delta },
    { x: minX, y: minY + delta * 3 },
  ];
  const s0 = n, s1 = n + 1, s2 = n + 2;

  // Каждый треугольник — (i0, i1, i2) в superPts.
  const triangles: Triangle[] = [{ i0: s0, i1: s1, i2: s2 }];

  const sameTriangle = (t: Triangle, o: Triangle): boolean =>
    t.i0 === o.i0 && t.i1 === o.i1 && t.i2 === o.i2;

  for (let p = 0; p < n; p++) {
    const px = superPts[p].x, py = superPts[p].y;

    // Треугольники, чья описанная окружность содержит точку.
    const bad = triangles.filter((t) => inCircumcircle(superPts, t, px, py));

    // Граница плохих треугольников (рёбра, не разделённые двумя плохими).
    const boundary: ProximityEdge[] = [];
    for (const t of bad) {
      const edges: ProximityEdge[] = [
        [t.i0, t.i1],
        [t.i1, t.i2],
        [t.i2, t.i0],
      ];
      for (const e of edges) {
        const shared = bad.some(
          (other) =>
            !sameTriangle(other, t) &&
            ((other.i0 === e[0] && other.i1 === e[1]) ||
              (other.i1 === e[0] && other.i0 === e[1]) ||
              (other.i1 === e[0] && other.i2 === e[1]) ||
              (other.i2 === e[0] && other.i1 === e[1]) ||
              (other.i2 === e[0] && other.i0 === e[1]) ||
              (other.i0 === e[0] && other.i2 === e[1])),
        );
        if (!shared) boundary.push(e);
      }
    }

    for (const t of bad) {
      const idx = triangles.findIndex((x) => sameTriangle(x, t));
      if (idx >= 0) triangles.splice(idx, 1);
    }
    for (const [a, b] of boundary) triangles.push({ i0: a, i1: b, i2: p });
  }

  // Убрать треугольники с вершиной в супер-треугольнике.
  for (let i = triangles.length - 1; i >= 0; i--) {
    const t = triangles[i];
    if (t.i0 >= n || t.i1 >= n || t.i2 >= n) triangles.splice(i, 1);
  }

  // Уникальные рёбра только по реальным точкам.
  const edgeSet = new Set<string>();
  for (const t of triangles) {
    edgeSet.add(`${Math.min(t.i0, t.i1)},${Math.max(t.i0, t.i1)}`);
    edgeSet.add(`${Math.min(t.i1, t.i2)},${Math.max(t.i1, t.i2)}`);
    edgeSet.add(`${Math.min(t.i2, t.i0)},${Math.max(t.i2, t.i0)}`);
  }
  return Array.from(edgeSet).map((k) => {
    const [a, b] = k.split(",").map(Number);
    return [a, b] as ProximityEdge;
  });
}

export function inCircumcircle(pts: Pos[], t: Triangle, px: number, py: number): boolean {
  const ax = pts[t.i0].x - px, ay = pts[t.i0].y - py;
  const bx = pts[t.i1].x - px, by = pts[t.i1].y - py;
  const cx = pts[t.i2].x - px, cy = pts[t.i2].y - py;
  const det =
    ax * (by * (cx * cx + cy * cy) - cy * (bx * bx + by * by)) -
    ay * (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) +
    (ax * ax + ay * ay) * (bx * cy - by * cx);
  return det > 0;
}

// ── Подключения ──────────────────────────────────────────────────────────────

/**
 * Охраняемые Direct-подключения между каждой смежной парой внешних зон,
 * расставленных кольцом (zone[i] ↔ zone[i+1], с замыканием).
 * isolatePlayers: player–player смежные пары пропускаются.
 */
export function buildRingConnections(
  playerLetters: string[],
  orderedLetters: string[],
  tuning: GenerationTuning,
  isolatePlayers = false,
): Connection[] {
  const count = orderedLetters.length;
  if (count < 2) return [];

  const connections: Connection[] = [];
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const fromLetter = orderedLetters[i];
    const toLetter = orderedLetters[next];

    if (isolatePlayers && playerLetters.includes(fromLetter) && playerLetters.includes(toLetter)) {
      continue;
    }

    const fromZone = playerLetters.includes(fromLetter) ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = playerLetters.includes(toLetter) ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;

    connections.push(
      makeConnection({
        name: `Ring-${fromLetter}-${toLetter}`,
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `ring_guard_${fromLetter}_${toLetter}`,
      }),
    );
  }
  return connections;
}

/**
 * Каждая зона парится со случайной несмежной зоной через Portal-подключение.
 * Тасованная неравнозначная перестановка: у каждой зоны ровно один исходящий
 * портал, НЕ ведущий к её кольцевым соседям.
 */
export function buildRandomPortalConnections(
  playerLetters: string[],
  orderedLetters: string[],
  tuning: GenerationTuning,
  rng: Rng,
  maxCount = 32,
): Connection[] {
  const count = orderedLetters.length;
  if (count < 2) return []; // для портала нужно хотя бы 2 зоны

  // Перестановка: zone[i] -> zone[dest[i]], dest[i] никогда не сосед
  // (i-1, i, i+1 mod count).
  const dest = buildNonAdjacentDerangement(count, rng);

  // Тасуем, какие зоны получают порталы, чтобы лимит выбирал случайные
  // зоны, а не всегда первые по порядку раскладки.
  const indices = orderByRandomKey(
    Array.from({ length: count }, (_, i) => i),
    rng,
  );

  const limit = Math.min(count, maxCount);
  const connections: Connection[] = [];
  for (let i = 0; i < limit; i++) {
    const idx = indices[i];
    const fromLetter = orderedLetters[idx];
    const toLetter = orderedLetters[dest[idx]];

    const fromZone = playerLetters.includes(fromLetter) ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = playerLetters.includes(toLetter) ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;

    connections.push(
      makeConnection({
        name: `Portal-${fromLetter}-${toLetter}`,
        from: fromZone,
        to: toZone,
        connectionType: "Portal",
        guardEscape: false,
        guardValue: scaleBorderGuardValue(25000, tuning),
        guardWeeklyIncrement: 0.15,
        portalPlacementRulesFrom: [
          { type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 },
        ],
        portalPlacementRulesTo: [
          { type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 },
        ],
        road: true,
      }),
    );
  }
  return connections;
}

/**
 * Массив, где result[i] != i и каждый индекс встречается ровно один раз как
 * назначение. Предпочтение несмежным целям; при отсутствии вариантов —
 * смежным соседям.
 */
export function buildNonAdjacentDerangement(count: number, rng: Rng): number[] {
  const dest = new Array<number>(count).fill(0);
  let attempts = 0;
  for (;;) {
    attempts++;
    const candidates = orderByRandomKey(
      Array.from({ length: count }, (_, i) => i),
      rng,
    );
    let valid = true;
    for (let i = 0; i < count; i++) {
      // Предпочтение несмежным; иначе любой не-сам.
      let found = -1;
      for (let j = 0; j < candidates.length; j++) {
        const c = candidates[j];
        if (c !== i && c !== (i + 1) % count && c !== (i - 1 + count) % count) {
          found = j;
          break;
        }
      }
      if (found < 0) {
        // Несмежных не осталось — берём любой не-сам.
        for (let j = 0; j < candidates.length; j++) {
          if (candidates[j] !== i) {
            found = j;
            break;
          }
        }
      }
      if (found < 0) {
        valid = false;
        break;
      }
      dest[i] = candidates[found];
      candidates.splice(found, 1);
    }
    if (valid) return dest;
    if (attempts > 100) break; // не должно происходить; защита от вечного цикла
  }
  // Крайний фолбэк: простой сдвиг на половину.
  const shift = Math.max(1, Math.floor(count / 2));
  return Array.from({ length: count }, (_, i) => (i + shift) % count);
}

/**
 * Аналог LINQ OrderBy(_ => rng.Next()): стабильная сортировка по ключам,
 * сгенерированным в порядке элементов (rng.Next() без аргументов).
 */
export function orderByRandomKey<T>(list: readonly T[], rng: Rng): T[] {
  const keyed = list.map((item) => ({ item, key: rng.nextIntFull() }));
  keyed.sort((a, b) => a.key - b.key);
  return keyed.map((e) => e.item);
}

// ── Фейлсейф изоляции ────────────────────────────────────────────────────────

/**
 * Когда активна «изоляция player-зон», зоны игроков, оставшиеся без
 * подключений (все соседи — тоже игроки), должны остаться достижимыми.
 * Добавляет минимальный прямой player–player fallback для каждой такой зоны.
 */
export function ensurePlayerZonesConnected(
  playerLetters: string[],
  zones: Zone[],
  connections: Connection[],
  tuning: GenerationTuning,
): void {
  if (playerLetters.length < 2) return;

  // Множество имён подключений, уже присутствующих в списке.
  const connNames = new Set<string>(
    connections.map((c) => c.name).filter((n): n is string => n !== null && n !== undefined),
  );

  const findZoneByName = (zoneName: string): Zone | undefined => {
    return zones.find((z) => z.name === zoneName);
  };

  const roadHasConnection = (zone: Zone | undefined): boolean => {
    if (!zone?.roads) return false;
    return zone.roads.some((r) => {
      const arg0 = r.to?.args?.[0];
      return r.to?.type === "Connection" && arg0 !== undefined && connNames.has(arg0);
    });
  };

  for (const letter of playerLetters) {
    const zoneName = `Spawn-${letter}`;
    const zone = findZoneByName(zoneName);
    if (!zone) continue;

    // Есть ли у зоны именованная дорога на существующее подключение?
    if (roadHasConnection(zone)) continue;

    // Ищем другого игрока, тоже отключённого, либо любого другого игрока.
    const candidates = playerLetters.filter((pl) => pl !== letter);
    const sortedCandidates = candidates
      .map((pl) => ({
        pl,
        isolated: !roadHasConnection(findZoneByName(`Spawn-${pl}`)),
      }))
      .sort((a, b) => Number(a.isolated) - Number(b.isolated)); // стабильная сортировка
    const partnerLetter = sortedCandidates.length > 0 ? sortedCandidates[0].pl : null;

    if (partnerLetter === null) continue;

    // Добавляем, только если fallback между этими двумя ещё не существует.
    const pair =
      compareOrdinal(letter, partnerLetter) < 0
        ? `${letter}-${partnerLetter}`
        : `${partnerLetter}-${letter}`;
    const fallbackName = `Fallback-${pair}`;
    if (connNames.has(fallbackName)) continue;

    // Регистрируем подключение.
    connections.push(
      makeConnection({
        name: fallbackName,
        from: `Spawn-${letter}`,
        to: `Spawn-${partnerLetter}`,
        connectionType: "Direct",
        guardZone: `Spawn-${letter}`,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `fallback_guard_${fallbackName}`,
      }),
    );
    connNames.add(fallbackName);

    // Добавляем road-endpoint обеим зонам.
    for (const pLetter of [letter, partnerLetter]) {
      const pZone = findZoneByName(`Spawn-${pLetter}`);
      if (pZone) {
        pZone.roads ??= [];
        pZone.roads.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(fallbackName)));
      }
    }
  }
}

// ── Фейлсейф полной связности графа ──────────────────────────────────────────

/**
 * Проверяет, что каждая зона достижима из каждой через Direct-подключения,
 * и добавляет минимальные мосты между изолированными компонентами.
 * Евклидовы позиции (pos) выбирают кратчайший межкомпонентный мост на каждом
 * шаге — добавляемые подключения остаются географически правдоподобными.
 */
export function ensureFullConnectivity(
  playerLetters: string[],
  allLetters: string[],
  pos: Pos[],
  zones: Zone[],
  connections: Connection[],
  tuning: GenerationTuning,
  neutralByLetter: Map<string, NeutralZonePlan> | null = null,
): void {
  if (allLetters.length <= 1) return;

  // Смежность по существующим Direct-подключениям (Portal тоже проходит).
  const zoneNameToIndex = new Map<string, number>();
  allLetters.forEach((l, i) => {
    zoneNameToIndex.set(playerLetters.includes(l) ? `Spawn-${l}` : `Neutral-${l}`, i);
  });

  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < allLetters.length; i++) adj.set(i, new Set<number>());

  for (const conn of connections) {
    if (conn.connectionType !== "Direct" && conn.connectionType !== "Portal") continue;
    const a = zoneNameToIndex.get(conn.from);
    if (a === undefined) continue;
    const b = zoneNameToIndex.get(conn.to);
    if (b === undefined) continue;
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }

  // BFS-поиск компонент связности.
  const findComponents = (graph: Map<number, Set<number>>, nodeCount: number): number[][] => {
    const visited = new Array<boolean>(nodeCount).fill(false);
    const components: number[][] = [];
    for (let start = 0; start < nodeCount; start++) {
      if (visited[start]) continue;
      const component: number[] = [];
      const queue: number[] = [start];
      visited[start] = true;
      while (queue.length > 0) {
        const cur = queue.shift() as number;
        component.push(cur);
        for (const nb of graph.get(cur) ?? []) {
          if (!visited[nb]) {
            visited[nb] = true;
            queue.push(nb);
          }
        }
      }
      components.push(component);
    }
    return components;
  };

  const connNameSet = new Set<string>(
    connections.map((c) => c.name).filter((n): n is string => n !== null && n !== undefined),
  );

  // Штрафы (только когда передан neutralByLetter — balanced layout):
  //   0 — та же или соседняя группа (идеал)
  //   N — разрыв групп в N
  //   100 — игрок ↔ игрок (последний шанс)
  const bridgePenalty = (idxA: number, idxB: number): number => {
    if (neutralByLetter === null) return 0;
    const ga = zoneQualityGroup(allLetters[idxA], playerLetters, neutralByLetter);
    const gb = zoneQualityGroup(allLetters[idxB], playerLetters, neutralByLetter);
    if (ga === 0 && gb === 0) return 100;
    return Math.abs(ga - gb);
  };

  for (;;) {
    const components = findComponents(adj, allLetters.length);
    if (components.length <= 1) break;

    let bestA = -1, bestB = -1;
    let bestPenalty = Number.MAX_SAFE_INTEGER;
    let bestDist = Number.MAX_VALUE;

    for (const a of components[0]) {
      for (let ci = 1; ci < components.length; ci++) {
        const otherComp = components[ci];
        for (const b of otherComp) {
          const penalty = bridgePenalty(a, b);
          const dx = pos[a].x - pos[b].x;
          const dy = pos[a].y - pos[b].y;
          const dist = dx * dx + dy * dy;
          if (penalty < bestPenalty || (penalty === bestPenalty && dist < bestDist)) {
            bestPenalty = penalty;
            bestDist = dist;
            bestA = a;
            bestB = b;
          }
        }
      }
    }

    if (bestA < 0 || bestB < 0) break; // не должно происходить

    const letterA = allLetters[bestA];
    const letterB = allLetters[bestB];
    const aIsPlayer = playerLetters.includes(letterA);
    const bIsPlayer = playerLetters.includes(letterB);
    const zoneA = aIsPlayer ? `Spawn-${letterA}` : `Neutral-${letterA}`;
    const zoneB = bIsPlayer ? `Spawn-${letterB}` : `Neutral-${letterB}`;

    const pair =
      compareOrdinal(letterA, letterB) < 0 ? `${letterA}-${letterB}` : `${letterB}-${letterA}`;
    const bridgeName = `Bridge-${pair}`;

    if (!connNameSet.has(bridgeName)) {
      connections.push(
        makeConnection({
          name: bridgeName,
          from: zoneA,
          to: zoneB,
          connectionType: "Direct",
          guardZone: zoneA,
          guardEscape: false,
          simTurnSquad: true,
          guardValue: scaleBorderGuardValue(30000, tuning),
          guardWeeklyIncrement: 0.15,
          guardMatchGroup: `bridge_guard_${pair}`,
        }),
      );
      connNameSet.add(bridgeName);

      // Дороги обеим зонам, чтобы дороги корректно рисовались.
      const endpoints: Array<[string, boolean]> = [
        [zoneA, aIsPlayer],
        [zoneB, bIsPlayer],
      ];
      for (const [zoneName, isPlayer] of endpoints) {
        const zone = zones.find((z) => z.name === zoneName);
        if (!zone) continue;
        zone.roads ??= [];
        if (isPlayer || (zone.mainObjects?.length ?? 0) > 0) {
          zone.roads.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(bridgeName)));
        } else {
          // Коннекторный стиль: от первого существующего connection-endpoint
          // к этому; при отсутствии — петля на самом мосте.
          const firstFrom = zone.roads
            .map((r) => (r.from?.type === "Connection" ? (r.from.args?.[0] ?? null) : null))
            .find((n) => n !== null);
          const firstTo = zone.roads
            .map((r) => (r.to?.type === "Connection" ? (r.to.args?.[0] ?? null) : null))
            .find((n) => n !== null);
          const existingConn = firstFrom ?? firstTo;
          if (existingConn !== null && existingConn !== undefined) {
            zone.roads.push(plainRoad(connectionEndpoint(existingConn), connectionEndpoint(bridgeName)));
          } else {
            zone.roads.push(plainRoad(connectionEndpoint(bridgeName), connectionEndpoint(bridgeName)));
          }
        }
      }
    }

    // Обновляем смежность, чтобы BFS увидел новое ребро.
    adj.get(bestA)!.add(bestB);
    adj.get(bestB)!.add(bestA);
  }
}

// ── Фабрика варианта ─────────────────────────────────────────────────────────

export function makeVariant(
  playerLetters: string[],
  firstLetter: string,
  totalZones: number,
  zones: Zone[],
  connections: Connection[],
): Variant {
  return {
    orientation: {
      zeroAngleZone: playerLetters.includes(firstLetter) ? `Spawn-${firstLetter}` : `Neutral-${firstLetter}`,
      baseAngleMin: 45,
      baseAngleMax: 45,
      randomAngleAmplitude: 360,
      randomAngleStep: 360.0 / totalZones,
    },
    border: {
      cornerRadius: 0.0,
      obstaclesWidth: 3,
      obstaclesNoise: [{ amp: 1, freq: 12 }],
      waterWidth: 0,
      waterNoise: [{ amp: 1, freq: 12 }],
      waterType: "water grass",
    },
    zones,
    connections,
  };
}
