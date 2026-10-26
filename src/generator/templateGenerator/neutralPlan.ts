import type { NeutralZoneQuality } from "../enums";
import type { GeneratorSettings } from "../settings";
import {
  NEUTRAL_QUALITY_ORDER,
  ZoneLetters,
  type NeutralZonePlan,
} from "./shared";

/**
 * Порт planning-части TemplateGenerator.cs: план нейтральных зон,
 * выбор hold-city по BFS, граф смежности топологии, сбалансированные
 * ring/chain-порядки букв.
 */

export function buildNeutralZonePlan(settings: GeneratorSettings): NeutralZonePlan[] {
  const plans: NeutralZonePlan[] = [];
  const maxNeutralZones = Math.max(0, ZoneLetters.length - settings.playerCount);
  const castleZoneCastleCount = clamp(settings.zoneCfg.neutralZoneCastles, 1, 4);

  const add = (requestedCount: number, quality: NeutralZoneQuality, castleCount: number): void => {
    const count = clamp(requestedCount, 0, 30);
    for (let i = 0; i < count && plans.length < maxNeutralZones; i++) {
      const letter = ZoneLetters[settings.playerCount + plans.length];
      plans.push({ letter, quality, castleCount });
    }
  };

  if (settings.zoneCfg.advanced.enabled) {
    add(settings.zoneCfg.advanced.neutralLowNoCastleCount, "Low", 0);
    add(settings.zoneCfg.advanced.neutralLowCastleCount, "Low", castleZoneCastleCount);
    add(settings.zoneCfg.advanced.neutralMediumNoCastleCount, "Medium", 0);
    add(settings.zoneCfg.advanced.neutralMediumCastleCount, "Medium", castleZoneCastleCount);
    add(settings.zoneCfg.advanced.neutralHighNoCastleCount, "High", 0);
    add(settings.zoneCfg.advanced.neutralHighCastleCount, "High", castleZoneCastleCount);
  } else {
    const castleCount = clamp(settings.zoneCfg.neutralZoneCastles, 0, 4);
    add(settings.zoneCfg.neutralZoneCount, "Medium", castleCount);
  }

  if (settings.topology === "SharedWeb" && plans.length === 0 && maxNeutralZones > 0) {
    const letter = ZoneLetters[settings.playerCount];
    const castleCount = clamp(settings.zoneCfg.neutralZoneCastles, 0, 4);
    plans.push({ letter, quality: "Medium", castleCount });
  }

  return plans;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function canHonorNeutralSeparation(settings: GeneratorSettings, neutralZoneCount: number): boolean {
  const min = settings.minNeutralZonesBetweenPlayers;
  if (min <= 0) return true;
  if (settings.randomPortals) return false;

  switch (settings.topology) {
    case "Default":
      return neutralZoneCount >= settings.playerCount * min;
    case "Chain":
      return neutralZoneCount >= (settings.playerCount - 1) * min;
    case "HubAndSpoke":
      return min <= 1;
    case "SharedWeb":
      return min <= 1 && neutralZoneCount >= 1;
    default:
      return false;
  }
}

/**
 * Выбор буквы нейтральной зоны, которая станет hold city.
 *
 * BFS по реальному графу смежности топологии даёт точные hop-дистанции от
 * каждой player-зоны до каждой нейтральной; выбирается максимально
 * равнодалёкая от всех игроков:
 *   1. Максимум минимальной hop-дистанции до любого игрока (дальше от всех).
 *   2. Минимум дисперсии дистанций (наиболее равнодалёкая).
 *   3. Предпочтение более высокому quality-тиру.
 *   4. Предпочтение зонам, у которых уже есть замок.
 *
 * adjacency: буква зоны → множество смежных букв (неориентированный граф).
 * null, когда подходящих нейтральных зон нет.
 */
export function pickHoldCityNeutralLetter(
  neutralZones: NeutralZonePlan[],
  playerLetters: string[],
  adjacency: Map<string, Set<string>>,
): string | null {
  if (neutralZones.length === 0) return null;

  // BFS от заданной буквы игрока; hop-дистанции до всех достижимых зон.
  const bfs = (start: string): Map<string, number> => {
    const dist = new Map<string, number>([[start, 0]]);
    const queue: string[] = [start];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      const neighbours = adjacency.get(cur);
      if (!neighbours) continue;
      for (const nb of neighbours) {
        if (!dist.has(nb)) {
          dist.set(nb, (dist.get(cur) as number) + 1);
          queue.push(nb);
        }
      }
    }
    return dist;
  };

  // BFS-дистанции от каждого игрока до всех зон.
  const distsByPlayer = playerLetters.map((p) => bfs(p));

  const UNREACHABLE = Number.MAX_SAFE_INTEGER; // аналог int.MaxValue / 2 в C#

  const candidates = neutralZones.map((plan) => {
    const letter = plan.letter;
    const dists = distsByPlayer.map((d) => d.get(letter) ?? UNREACHABLE);
    const minDist = Math.min(...dists);
    const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
    const variance = dists.reduce((acc, d) => acc + (d - mean) * (d - mean), 0) / dists.length;
    return {
      letter,
      minDist,
      variance,
      quality: NEUTRAL_QUALITY_ORDER[plan.quality],
      hasCastle: plan.castleCount > 0 ? 1 : 0,
    };
  });

  // OrderByDescending(minDist).ThenBy(variance).ThenByDescending(quality)
  // .ThenByDescending(hasCastle) — стабильная сортировка; ties сохраняют
  // порядок neutralZones.
  const sorted = candidates.slice().sort((a, b) => {
    if (a.minDist !== b.minDist) return b.minDist - a.minDist;
    if (a.variance !== b.variance) return a.variance - b.variance;
    if (a.quality !== b.quality) return b.quality - a.quality;
    return b.hasCastle - a.hasCastle;
  });
  return sorted[0].letter;
}

/**
 * Граф смежности букв зон для заданной топологии, чтобы
 * pickHoldCityNeutralLetter считал точные hop-дистанции.
 */
export function buildTopologyAdjacency(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  const link = (a: string, b: string): void => {
    let sa = adj.get(a);
    if (!sa) adj.set(a, (sa = new Set<string>()));
    let sb = adj.get(b);
    if (!sb) adj.set(b, (sb = new Set<string>()));
    sa.add(b);
    sb.add(a);
  };

  switch (settings.topology) {
    case "Chain": {
      const ordered = buildOrderedLetters(settings, playerLetters, neutralZones, false);
      const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;
      const playerSet = new Set(playerLetters);
      for (let i = 0; i < ordered.length - 1; i++) {
        const bothPlayers = playerSet.has(ordered[i]) && playerSet.has(ordered[i + 1]);
        if (isolate && bothPlayers) continue;
        link(ordered[i], ordered[i + 1]);
      }
      break;
    }

    case "Default": {
      // Точная копия BuildVariantDefault: рёбра кольца, player–player пары
      // пропускаются при включённой изоляции.
      const ordered = buildOrderedLetters(settings, playerLetters, neutralZones, true);
      const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;
      const playerSet = new Set(playerLetters);
      const n = ordered.length;
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const bothPlayers = playerSet.has(ordered[i]) && playerSet.has(ordered[next]);
        if (isolate && bothPlayers) continue;
        link(ordered[i], ordered[next]);
      }
      break;
    }

    case "Random":
    case "Balanced": {
      // Delaunay-смежность считается из позиций в момент генерации и не
      // воспроизводится точно на фазе выбора. Balanced ring-порядок — лучшее
      // структурное приближение для обеих топологий.
      const ordered = buildOrderedLetters(settings, playerLetters, neutralZones, true);
      const rn = ordered.length;
      for (let i = 0; i < rn; i++) link(ordered[i], ordered[(i + 1) % rn]);
      break;
    }

    default: {
      const ordered = buildOrderedLetters(settings, playerLetters, neutralZones, true);
      const dn = ordered.length;
      for (let i = 0; i < dn; i++) link(ordered[i], ordered[(i + 1) % dn]);
      break;
    }
  }

  return adj;
}

export function buildOrderedLetters(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  isRing: boolean,
): string[] {
  const honoredSeparation =
    settings.minNeutralZonesBetweenPlayers > 0 &&
    canHonorNeutralSeparation(settings, neutralZones.length)
      ? settings.minNeutralZonesBetweenPlayers
      : 0;

  return isRing
    ? buildBalancedRingLetters(playerLetters, neutralZones, honoredSeparation)
    : buildBalancedChainLetters(playerLetters, neutralZones, honoredSeparation);
}

export function buildBalancedRingLetters(
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  minNeutralZonesBetweenPlayers: number,
): string[] {
  if (playerLetters.length === 0) return buildBalancedNeutralRing(neutralZones, 1);

  if (neutralZones.length === 0) return [...playerLetters];

  const gapCapacities = buildEvenGapCapacities(
    playerLetters.length,
    neutralZones.length,
    minNeutralZonesBetweenPlayers,
  );
  const gaps = assignNeutralZonesToGaps(neutralZones, gapCapacities, false);

  const ordered: string[] = [];
  for (let i = 0; i < playerLetters.length; i++) {
    ordered.push(playerLetters[i]);
    ordered.push(...orderNeutralsWithinGap(gaps[i]).map((zone) => zone.letter));
  }

  return ordered;
}

export function buildBalancedChainLetters(
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  minNeutralZonesBetweenPlayers: number,
): string[] {
  if (playerLetters.length === 0) return neutralZones.map((zone) => zone.letter);

  const gapCount = playerLetters.length + 1;
  const capacities = new Array<number>(gapCount).fill(0);
  let remaining = neutralZones.length;

  const requiredInterior = Math.max(0, playerLetters.length - 1) * minNeutralZonesBetweenPlayers;
  if (minNeutralZonesBetweenPlayers > 0 && neutralZones.length >= requiredInterior) {
    for (let i = 1; i < gapCount - 1; i++) capacities[i] = minNeutralZonesBetweenPlayers;
    remaining -= requiredInterior;
  }

  const extras = buildEvenGapCapacities(gapCount, remaining, 0);
  for (let i = 0; i < gapCount; i++) capacities[i] += extras[i];

  const gaps = assignNeutralZonesToGaps(neutralZones, capacities, true);
  const ordered: string[] = [];

  ordered.push(...orderEdgeGap(gaps[0], true).map((zone) => zone.letter));
  for (let i = 0; i < playerLetters.length; i++) {
    ordered.push(playerLetters[i]);
    const gap = gaps[i + 1];
    const trailingEdge = i === playerLetters.length - 1;
    ordered.push(
      ...(trailingEdge ? orderEdgeGap(gap, false) : orderNeutralsWithinGap(gap)).map(
        (zone) => zone.letter,
      ),
    );
  }

  return ordered.length > 0
    ? ordered
    : [...playerLetters, ...neutralZones.map((zone) => zone.letter)];
}

export function buildBalancedNeutralRing(neutralZones: NeutralZonePlan[], playerCount: number): string[] {
  if (neutralZones.length <= 1) return neutralZones.map((zone) => zone.letter);

  const gapCount = Math.max(1, playerCount);
  const gapCapacities = buildEvenGapCapacities(gapCount, neutralZones.length, 0);
  const gaps = assignNeutralZonesToGaps(neutralZones, gapCapacities, false);
  return gaps.flatMap((gap) => orderNeutralsWithinGap(gap)).map((zone) => zone.letter);
}

export function buildEvenGapCapacities(gapCount: number, itemCount: number, minimumPerGap: number): number[] {
  const capacities = new Array<number>(Math.max(0, gapCount)).fill(0);
  if (gapCount <= 0 || itemCount <= 0) return capacities;

  const minimum = Math.max(0, minimumPerGap);
  const reserved = minimum * gapCount;
  let remaining = itemCount;
  if (minimum > 0 && itemCount >= reserved) {
    for (let i = 0; i < gapCount; i++) capacities[i] = minimum;
    remaining -= reserved;
  }

  for (let i = 0; i < remaining; i++) {
    const gap = Math.floor(((i + 0.5) * gapCount) / remaining);
    capacities[clamp(gap, 0, gapCount - 1)]++;
  }

  return capacities;
}

export function assignNeutralZonesToGaps(
  neutralZones: NeutralZonePlan[],
  gapCapacities: number[],
  preferInteriorGaps: boolean,
): NeutralZonePlan[][] {
  const gaps: NeutralZonePlan[][] = gapCapacities.map(() => []);
  const loads = new Array<number>(gapCapacities.length).fill(0);
  // Стабильная сортировка по score↓, затем буква↑ (ordinal).
  const orderedNeutrals = stableSort(neutralZones.slice(), (a, b) => {
    const sa = neutralZoneBalanceScore(a);
    const sb = neutralZoneBalanceScore(b);
    if (sa !== sb) return sb - sa;
    return compareOrdinal(a.letter, b.letter);
  });

  for (const neutralZone of orderedNeutrals) {
    let candidates: number[] = [];
    for (let i = 0; i < gapCapacities.length; i++) {
      if (gaps[i].length < gapCapacities[i]) candidates.push(i);
    }

    if (candidates.length === 0) break;

    if (preferInteriorGaps) {
      const interiorCandidates = candidates.filter((i) => i > 0 && i < gapCapacities.length - 1);
      if (interiorCandidates.length > 0) candidates = interiorCandidates;
    }

    // OrderBy(loads).ThenBy(count).ThenBy(index).First() — индексы идут
    // по возрастанию, ties оставляют наименьший индекс.
    let selectedGap = candidates[0];
    for (const i of candidates) {
      if (loads[i] < loads[selectedGap]) {
        selectedGap = i;
      } else if (loads[i] === loads[selectedGap] && gaps[i].length < gaps[selectedGap].length) {
        selectedGap = i;
      }
    }

    gaps[selectedGap].push(neutralZone);
    loads[selectedGap] += neutralZoneBalanceScore(neutralZone);
  }

  return gaps;
}

export function orderNeutralsWithinGap(neutralZones: NeutralZonePlan[]): NeutralZonePlan[] {
  const count = neutralZones.length;
  if (count <= 1) return [...neutralZones];

  const sorted = stableSort(neutralZones.slice(), (a, b) => {
    const sa = neutralZoneBalanceScore(a);
    const sb = neutralZoneBalanceScore(b);
    if (sa !== sb) return sb - sa;
    return compareOrdinal(a.letter, b.letter);
  });
  const slots = new Array<NeutralZonePlan>(count);
  const positions = stableSort(
    Array.from({ length: count }, (_, i) => i),
    (a, b) => Math.abs(a - (count - 1) / 2.0) - Math.abs(b - (count - 1) / 2.0),
  );

  for (let i = 0; i < sorted.length; i++) slots[positions[i]] = sorted[i];

  return slots;
}

export function orderEdgeGap(neutralZones: NeutralZonePlan[], highQualityNearPlayer: boolean): NeutralZonePlan[] {
  const ordered = stableSort(neutralZones.slice(), (a, b) => {
    const sa = neutralZoneBalanceScore(a);
    const sb = neutralZoneBalanceScore(b);
    if (sa !== sb) return sa - sb;
    return compareOrdinal(a.letter, b.letter);
  });

  if (highQualityNearPlayer) return ordered;

  ordered.reverse();
  return ordered;
}

export function neutralZoneBalanceScore(zone: NeutralZonePlan): number {
  const quality =
    zone.quality === "High" ? 3.0 : zone.quality === "Medium" ? 2.0 : 1.0;
  return quality + Math.min(zone.castleCount, 4) * 0.15;
}

// ── Вспомогательные ──────────────────────────────────────────────────────────

/** Стабильная сортировка компаратором (Array#sort стабилен по спецификации ES2019). */
export function stableSort<T>(list: T[], compare: (a: T, b: T) => number): T[] {
  return list.sort(compare);
}

/** Сравнение строк по кодовым единицам (StringComparer.Ordinal для ASCII-букв зон). */
export function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
