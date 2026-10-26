import type { GeneratorSettings } from "../settings";
import type { Connection, Variant, Zone } from "../template";
import type { Rng } from "../rng";
import { CONNECTIONS_PER_ZONE, scaleBorderGuardValue, type GenerationTuning, type NeutralZonePlan, NEUTRAL_QUALITY_ORDER } from "./shared";
import {
  buildBalancedNeutralRing,
  buildBalancedRingLetters,
  buildOrderedLetters,
  canHonorNeutralSeparation,
  compareOrdinal,
} from "./neutralPlan";
import { buildConnectorZoneRoads, buildHubZone, buildNeutralZone, buildSpawnZone } from "./zones";
import {
  buildBalancedRandomPositions,
  buildRandomPortalConnections,
  buildRingConnections,
  delaunayEdges,
  ensureFullConnectivity,
  ensurePlayerZonesConnected,
  makeConnection,
  makeVariant,
  orderByRandomKey,
  zoneQualityGroup,
  type Pos,
  type ProximityEdge,
} from "./topology";

/**
 * Порт топологий TemplateGenerator.cs: Default (ring), Random, Balanced,
 * Hub & Spoke, Chain, SharedWeb и турнирные кластеры.
 */

export function buildVariant(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
  hubIsHoldCity = false,
): Variant {
  // Всегда тасуем буквы игроков, чтобы игроки не всегда стояли на одних и тех
  // же геометрических позициях.
  playerLetters = orderByRandomKey(playerLetters, rng);

  const isTournament =
    settings.tournamentRules.enabled || settings.gameEndConditions.victoryCondition === "win_condition_6";
  if (isTournament) {
    if (playerLetters.length !== 2) {
      throw new Error(
        `Tournament mode requires exactly 2 players, but ${playerLetters.length} were configured.`,
      );
    }
    return buildVariantTournament(settings, playerLetters, neutralZones, tuning, rng);
  }

  switch (settings.topology) {
    case "HubAndSpoke":
      return buildVariantHubAndSpoke(settings, playerLetters, neutralZones, tuning, rng, hubIsHoldCity);
    case "Chain":
      return buildVariantChain(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
    case "SharedWeb":
      return buildVariantSharedWeb(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
    case "Random":
      return buildVariantRandom(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
    case "Balanced":
      return buildVariantBalanced(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
    default:
      return buildVariantDefault(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter);
  }
}

// ── Топология: турнир (2 полностью изолированных кластера игроков) ──────────

/**
 * Оба игрока полностью изолированы друг от друга. Нейтральные зоны делятся
 * примерно поровну; каждый игрок подключает свои эксклюзивные нейтральные
 * выбранной топологией. Chain / Default (Ring) / SharedWeb → простая цепочка
 * на кластер. Random → Delaunay-кластер. Hub & Spoke → не имеет смысла для
 * изоляции; fallback на цепочку. Путь между кластерами никогда не возникает.
 */
export function buildVariantTournament(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
): Variant {
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));

  // Сбалансированное round-robin распределение нейтральных зон: сортировка
  // по убыванию quality/castle score, затем чередование: индексы
  // 0,2,4,… → игрок 0; 1,3,5,… → игрок 1.
  const sorted = neutralZones
    .slice()
    .sort((a, b) => {
      if (a.quality !== b.quality) return NEUTRAL_QUALITY_ORDER[b.quality] - NEUTRAL_QUALITY_ORDER[a.quality];
      if (a.castleCount !== b.castleCount) return b.castleCount - a.castleCount;
      return compareOrdinal(a.letter, b.letter);
    });

  const neutralsForPlayer: NeutralZonePlan[][] = [[], []];
  for (let i = 0; i < sorted.length; i++) neutralsForPlayer[i % 2].push(sorted[i]);

  // Тасуем порядок цепочки, но используем одну перестановку для обоих
  // игроков — у кластеров идентичная слотовая структура (зеркальная карта).
  const maxSlots = Math.max(neutralsForPlayer[0].length, neutralsForPlayer[1].length);
  const slotOrder = orderByRandomKey(
    Array.from({ length: maxSlots }, (_, i) => i),
    rng,
  );
  for (let p = 0; p < 2; p++) {
    const original = neutralsForPlayer[p];
    neutralsForPlayer[p] = slotOrder
      .filter((i) => i < original.length)
      .map((i) => original[i]);
  }

  const zones: Zone[] = [];
  const connections: Connection[] = [];

  const useRandom = settings.topology === "Random";
  const useHub = settings.topology === "HubAndSpoke";
  const useBalanced = settings.topology === "Balanced";

  if (useHub) {
    // Каждый игрок получает собственный приватный мини-hub. Перестановка
    // слотов для hub не имеет значения (все нейтральные подключаются напрямую
    // к hub), поэтому кластеры строятся независимо.
    for (let p = 0; p < 2; p++) {
      buildTournamentHubCluster(p, playerLetters[p], neutralsForPlayer[p], neutralByLetter, settings, tuning, zones, connections);
    }
  } else if (useRandom) {
    // Позиции и Delaunay-рёбра генерируются один раз по большему кластеру,
    // затем идентичная топология рёбер переиспользуется для обоих кластеров —
    // раскладки зеркальны.
    const templateSize = maxSlots + 1; // +1 за player-зону
    const templatePos: Pos[] = [];
    for (let i = 0; i < templateSize; i++) {
      templatePos.push({ x: rng.nextDouble() * 0.9 + 0.05, y: rng.nextDouble() * 0.9 + 0.05 });
    }
    const templateEdges = delaunayEdges(templatePos);

    // Нормализация templatePos в [0,1] для маппинга кластера на свою половину
    // канвы превью: кластер 0 → слева, кластер 1 → справа, с deliberate
    // центральным зазором, чтобы кластеры не соприкасались на превью.
    let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
    for (const p of templatePos) {
      if (p.x < tMinX) tMinX = p.x;
      if (p.x > tMaxX) tMaxX = p.x;
      if (p.y < tMinY) tMinY = p.y;
      if (p.y > tMaxY) tMaxY = p.y;
    }
    const tSpanX = Math.max(tMaxX - tMinX, 0.001);
    const tSpanY = Math.max(tMaxY - tMinY, 0.001);

    // Каждый кластер занимает ~43% ширины канвы; центральные 14% — зазор.
    const previewPositions: Pos[][] = [];
    for (let p = 0; p < 2; p++) {
      const xMin = p === 0 ? 0.03 : 0.57;
      const xMax = p === 0 ? 0.43 : 0.97;
      previewPositions.push(
        templatePos.map((pt) => ({
          x: xMin + ((pt.x - tMinX) / tSpanX) * (xMax - xMin),
          y: 0.05 + ((pt.y - tMinY) / tSpanY) * 0.9,
        })),
      );
    }

    for (let p = 0; p < 2; p++) {
      buildTournamentRandomCluster(p, playerLetters[p], neutralsForPlayer[p], neutralByLetter, settings, tuning, zones, connections, templateEdges, previewPositions[p]);
    }
  } else if (useBalanced) {
    // Каждый игрок получает полностью изолированный balanced-кластер
    // (концентрические кольца); кластеры на противоположных половинах канвы.
    for (let p = 0; p < 2; p++) {
      buildTournamentBalancedCluster(p, playerLetters[p], neutralsForPlayer[p], neutralByLetter, settings, tuning, zones, connections);
    }
  } else {
    for (let p = 0; p < 2; p++) {
      buildTournamentChainCluster(p, playerLetters[p], neutralsForPlayer[p], neutralByLetter, settings, tuning, zones, connections);
    }
  }

  const totalZones = zones.length;
  return makeVariant(playerLetters, playerLetters[0], totalZones, zones, connections);
}

/** Кластер игрока цепочкой: player → n0 → n1 → … */
function buildTournamentChainCluster(
  playerIndex: number,
  playerLetter: string,
  myNeutrals: NeutralZonePlan[],
  neutralByLetter: Map<string, NeutralZonePlan>,
  settings: GeneratorSettings,
  tuning: GenerationTuning,
  zones: Zone[],
  connections: Connection[],
): void {
  const chainLetters = [playerLetter, ...myNeutrals.map((n) => n.letter)];

  const connNamesInChain: string[] = new Array(chainLetters.length - 1);
  for (let i = 0; i < connNamesInChain.length; i++) {
    connNamesInChain[i] = `Tourney-${chainLetters[i]}-${chainLetters[i + 1]}`;
  }

  for (let i = 0; i < chainLetters.length; i++) {
    const letter = chainLetters[i];
    const myConns: string[] = [];
    if (i > 0) myConns.push(connNamesInChain[i - 1]);
    if (i < connNamesInChain.length) myConns.push(connNamesInChain[i]);

    if (i === 0) {
      zones.push(
        buildSpawnZone(
          letter,
          `Player${playerIndex + 1}`,
          myConns,
          settings.zoneCfg.playerZoneCastles,
          settings.matchPlayerCastleFactions,
          settings.zoneCfg.advanced.playerZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    } else {
      zones.push(
        buildNeutralZone(
          neutralByLetter.get(letter) as NeutralZonePlan,
          myConns,
          settings.zoneCfg.advanced.neutralZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    }
  }

  for (let i = 0; i < connNamesInChain.length; i++) {
    const fromLetter = chainLetters[i];
    const toLetter = chainLetters[i + 1];
    const fromZone = i === 0 ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: connNamesInChain[i],
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `tourney_guard_${fromLetter}_${toLetter}`,
      }),
    );
  }
}

/**
 * Кластер игрока как приватный hub-and-spoke: выделенная мини-hub зона
 * («Hub-{playerLetter}») в центре, напрямую подключённая к spawn игрока и
 * всем его эксклюзивным нейтральным. Никакое подключение не касается
 * кластера другого игрока.
 */
function buildTournamentHubCluster(
  playerIndex: number,
  playerLetter: string,
  myNeutrals: NeutralZonePlan[],
  neutralByLetter: Map<string, NeutralZonePlan>,
  settings: GeneratorSettings,
  tuning: GenerationTuning,
  zones: Zone[],
  connections: Connection[],
): void {
  const hubName = `Hub-${playerLetter}`;

  // Все spokes: spawn игрока + каждая нейтральная.
  const spokeLetters = [playerLetter, ...myNeutrals.map((n) => n.letter)];

  // Имя подключения для каждого spoke: «THubSpoke-{playerLetter}-{spokeLetter}».
  const spokeConnNames = spokeLetters.map((l) => `THubSpoke-${playerLetter}-${l}`);

  // Сам hub строится общим билдером — замки, дороги, биомы, пулы контента
  // и guard-настройки всегда консистентны.
  const hubZone = buildHubZone(
    spokeConnNames,
    tuning,
    false,
    settings.zoneCfg.hubZoneSize,
    settings.zoneCfg.hubZoneCastles,
    settings.generateRoads,
  );
  hubZone.name = hubName;
  zones.push(hubZone);

  // Каждый spoke (spawn игрока или нейтральная).
  for (let i = 0; i < spokeLetters.length; i++) {
    const letter = spokeLetters[i];
    const connName = spokeConnNames[i];

    if (i === 0) {
      zones.push(
        buildSpawnZone(
          letter,
          `Player${playerIndex + 1}`,
          [connName],
          settings.zoneCfg.playerZoneCastles,
          settings.matchPlayerCastleFactions,
          settings.zoneCfg.advanced.playerZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    } else {
      zones.push(
        buildNeutralZone(
          neutralByLetter.get(letter) as NeutralZonePlan,
          [connName],
          settings.zoneCfg.advanced.neutralZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    }
  }

  // Подключения hub → spoke.
  for (let i = 0; i < spokeLetters.length; i++) {
    const spokeLetter = spokeLetters[i];
    const spokeZone = i === 0 ? `Spawn-${spokeLetter}` : `Neutral-${spokeLetter}`;
    connections.push(
      makeConnection({
        name: spokeConnNames[i],
        from: hubName,
        to: spokeZone,
        connectionType: "Direct",
        guardZone: hubName,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `tourney_hub_guard_${playerLetter}_${spokeLetter}`,
      }),
    );
  }

  // Proximity-кольцо вокруг spokes, чтобы движок расставил их вокруг hub
  // в разумном порядке, а не произвольно.
  for (let i = 0; i < spokeLetters.length; i++) {
    const next = (i + 1) % spokeLetters.length;
    const fromLetter = spokeLetters[i];
    const toLetter = spokeLetters[next];
    const fromZone = i === 0 ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = next === 0 ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: `TPseudo-${playerLetter}-${fromLetter}-${toLetter}`,
        from: fromZone,
        to: toZone,
        connectionType: "Proximity",
      }),
    );
  }
}

/**
 * Кластер игрока по общему Delaunay-шаблону рёбер: у обоих кластеров
 * идентичная внутренняя топология (зеркальная раскладка). Используются
 * только рёбра, у которых оба конца попадают в число зон этого кластера.
 */
function buildTournamentRandomCluster(
  playerIndex: number,
  playerLetter: string,
  myNeutrals: NeutralZonePlan[],
  neutralByLetter: Map<string, NeutralZonePlan>,
  settings: GeneratorSettings,
  tuning: GenerationTuning,
  zones: Zone[],
  connections: Connection[],
  templateEdges: ProximityEdge[],
  previewPositions: Pos[],
): void {
  const clusterLetters = [playerLetter, ...myNeutrals.map((n) => n.letter)];
  const count = clusterLetters.length;

  // Только рёбра с обоими концами внутри кластера (нечётное деление,
  // когда у одного кластера зон меньше, чем в шаблоне).
  const pairs = templateEdges.filter((e) => e[0] < count && e[1] < count);

  const connsByIndex: string[][] = Array.from({ length: count }, () => []);

  for (const [a, b] of pairs) {
    const fromLetter = clusterLetters[a];
    const toLetter = clusterLetters[b];
    const connName = `TourneyRnd-${fromLetter}-${toLetter}`;
    connsByIndex[a].push(connName);
    connsByIndex[b].push(connName);

    const fromZone = a === 0 ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = b === 0 ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: connName,
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `tourney_rnd_guard_${fromLetter}_${toLetter}`,
      }),
    );
  }

  for (let i = 0; i < count; i++) {
    const letter = clusterLetters[i];
    const myConns = connsByIndex[i];
    let zone: Zone;
    if (i === 0) {
      zone = buildSpawnZone(
        letter,
        `Player${playerIndex + 1}`,
        myConns,
        settings.zoneCfg.playerZoneCastles,
        settings.matchPlayerCastleFactions,
        settings.zoneCfg.advanced.playerZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      );
    } else {
      zone = buildNeutralZone(
        neutralByLetter.get(letter) as NeutralZonePlan,
        myConns,
        settings.zoneCfg.advanced.neutralZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      );
    }
    // Позиция превью: рендер кладёт каждый кластер в свою половину канвы.
    if (i < previewPositions.length) zone.generatorPosition = previewPositions[i];
    zones.push(zone);
  }
}

/**
 * Кластер игрока по balanced-раскладке концентрических колец (зеркало
 * BuildVariantBalanced в рамках эксклюзивных нейтральных одного игрока).
 * Кластеры отображаются на противоположные половины канвы с явным зазором.
 */
function buildTournamentBalancedCluster(
  playerIndex: number,
  playerLetter: string,
  myNeutrals: NeutralZonePlan[],
  neutralByLetter: Map<string, NeutralZonePlan>,
  settings: GeneratorSettings,
  tuning: GenerationTuning,
  zones: Zone[],
  connections: Connection[],
): void {
  const singlePlayerList = [playerLetter];
  const orderedLetters = buildBalancedRingLetters(singlePlayerList, myNeutrals, 0);

  // Концентрические позиции, перемапленные на половину канвы этого игрока.
  const rawPos = buildBalancedRandomPositions(orderedLetters, singlePlayerList, neutralByLetter);

  const xMin = playerIndex === 0 ? 0.03 : 0.57;
  const xMax = playerIndex === 0 ? 0.43 : 0.97;
  const rawXMin = rawPos.length > 0 ? Math.min(...rawPos.map((p) => p.x)) : 0.05;
  const rawXMax = rawPos.length > 0 ? Math.max(...rawPos.map((p) => p.x)) : 0.95;
  const rawYMin = rawPos.length > 0 ? Math.min(...rawPos.map((p) => p.y)) : 0.05;
  const rawYMax = rawPos.length > 0 ? Math.max(...rawPos.map((p) => p.y)) : 0.95;
  const spanX = Math.max(rawXMax - rawXMin, 0.001);
  const spanY = Math.max(rawYMax - rawYMin, 0.001);

  const pos: Pos[] = rawPos.map((pt) => ({
    x: xMin + ((pt.x - rawXMin) / spanX) * (xMax - xMin),
    y: 0.05 + ((pt.y - rawYMin) / spanY) * 0.9,
  }));

  let pairs = delaunayEdges(pos);

  const presentGroups = new Set(
    orderedLetters.map((l) => zoneQualityGroup(l, singlePlayerList, neutralByLetter)),
  );

  pairs = pairs.filter((p) => {
    const la = orderedLetters[p[0]];
    const lb = orderedLetters[p[1]];
    if (la === playerLetter && lb === playerLetter) return false;
    const ga = zoneQualityGroup(la, singlePlayerList, neutralByLetter);
    const gb = zoneQualityGroup(lb, singlePlayerList, neutralByLetter);
    const lo = Math.min(ga, gb);
    const hi = Math.max(ga, gb);
    if (hi === lo) return true;
    if (hi - lo <= 2) return true;
    for (let g = lo + 1; g < hi; g++) {
      if (presentGroups.has(g)) return false;
    }
    return true;
  });

  const count = orderedLetters.length;
  const connsByZone: string[][] = Array.from({ length: count }, () => []);

  for (const [a, b] of pairs) {
    const fromLetter = orderedLetters[a];
    const toLetter = orderedLetters[b];
    const connName = `TBal-${fromLetter}-${toLetter}`;
    connsByZone[a].push(connName);
    connsByZone[b].push(connName);

    const fromZone = fromLetter === playerLetter ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = toLetter === playerLetter ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: connName,
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `tourney_bal_guard_${fromLetter}_${toLetter}`,
      }),
    );
  }

  for (let i = 0; i < count; i++) {
    const letter = orderedLetters[i];
    const myConns = connsByZone[i];
    let zone: Zone;
    if (letter === playerLetter) {
      zone = buildSpawnZone(
        letter,
        `Player${playerIndex + 1}`,
        myConns,
        settings.zoneCfg.playerZoneCastles,
        settings.matchPlayerCastleFactions,
        settings.zoneCfg.advanced.playerZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      );
    } else {
      zone = buildNeutralZone(
        neutralByLetter.get(letter) as NeutralZonePlan,
        myConns,
        settings.zoneCfg.advanced.neutralZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      );
    }
    zone.generatorPosition = pos[i];
    zones.push(zone);
  }

  ensureFullConnectivity(singlePlayerList, orderedLetters, pos, zones, connections, tuning, neutralByLetter);
}

// ── Топология: Default (Ring) ────────────────────────────────────────────────

export function buildVariantDefault(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
): Variant {
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  const orderedLetters = buildOrderedLetters(settings, playerLetters, neutralZones, true);
  const outerCount = orderedLetters.length;
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;

  // Имена ring-подключений считаются заранее, но только для реально
  // связываемых пар. Пара пропускается при изоляции, если обе зоны —
  // player-зоны.
  const ringConnRight: (string | null)[] = new Array(outerCount).fill(null); // имя подключения i → i+1
  const ringConnLeft: (string | null)[] = new Array(outerCount).fill(null); // имя подключения i-1 → i
  for (let i = 0; i < outerCount; i++) {
    const next = (i + 1) % outerCount;
    const bothPlayers = playerLetters.includes(orderedLetters[i]) && playerLetters.includes(orderedLetters[next]);
    if (isolate && bothPlayers) continue; // остаётся null — подключения нет
    const name = `Ring-${orderedLetters[i]}-${orderedLetters[next]}`;
    ringConnRight[i] = name;
    ringConnLeft[next] = name;
  }

  const zones: Zone[] = [];
  for (let i = 0; i < outerCount; i++) {
    const letter = orderedLetters[i];
    // Только не-null имена подключений попадают в дороги зоны.
    const myConns = Array.from(
      new Set([ringConnLeft[i], ringConnRight[i]].filter((c): c is string => c !== null)),
    );

    const playerIdx = playerLetters.indexOf(letter);
    if (playerIdx >= 0) {
      zones.push(
        buildSpawnZone(
          letter,
          `Player${playerIdx + 1}`,
          myConns,
          settings.zoneCfg.playerZoneCastles,
          settings.matchPlayerCastleFactions,
          settings.zoneCfg.advanced.playerZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    } else {
      zones.push(
        buildNeutralZone(
          neutralByLetter.get(letter) as NeutralZonePlan,
          myConns,
          settings.zoneCfg.advanced.neutralZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
          letter === holdCityNeutralLetter,
        ),
      );
    }
  }

  const connections: Connection[] = [];
  connections.push(...buildRingConnections(playerLetters, orderedLetters, tuning, isolate));
  if (settings.randomPortals) {
    connections.push(
      ...buildRandomPortalConnections(playerLetters, orderedLetters, tuning, rng, settings.maxPortalConnections),
    );
  }

  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning);
  return makeVariant(playerLetters, orderedLetters[0], outerCount, zones, connections);
}

// ── Топология: Random Proximity ──────────────────────────────────────────────

export function buildVariantRandom(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
): Variant {
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  const neutralLetters = neutralZones.map((z) => z.letter);
  // Тасуем зоны — порядок player/neutral полностью случаен.
  const allLetters = orderByRandomKey([...playerLetters, ...neutralLetters], rng);
  const count = allLetters.length;
  // Случайные 2D-позиции в единичном квадрате; лёгкий джиттер от
  // вырожденных коллинеарных/конциклических случаев.
  const pos: Pos[] = [];
  for (let i = 0; i < count; i++) {
    pos.push({ x: rng.nextDouble() * 0.9 + 0.05, y: rng.nextDouble() * 0.9 + 0.05 });
  }

  const pairs = delaunayEdges(pos);
  return buildVariantFromDelaunay(
    settings,
    playerLetters,
    neutralZones,
    neutralByLetter,
    allLetters,
    pos,
    pairs,
    false,
    tuning,
    rng,
    holdCityNeutralLetter,
    "Rnd",
    "rnd_guard",
  );
}

// ── Топология: Balanced (концентрические кольца по quality-тиру) ─────────────

export function buildVariantBalanced(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
): Variant {
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  // Зоны на концентрических кольцах, упорядоченных по quality-тиру.
  const allLetters = buildBalancedRingLetters(playerLetters, neutralZones, 0);
  const pos = buildBalancedRandomPositions(allLetters, playerLetters, neutralByLetter);

  const pairs = delaunayEdges(pos);
  return buildVariantFromDelaunay(
    settings,
    playerLetters,
    neutralZones,
    neutralByLetter,
    allLetters,
    pos,
    pairs,
    true,
    tuning,
    rng,
    holdCityNeutralLetter,
    "Bal",
    "bal_guard",
  );
}

// ── Общий Delaunay → Variant билдер ──────────────────────────────────────────

function buildVariantFromDelaunay(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  neutralByLetter: Map<string, NeutralZonePlan>,
  allLetters: string[],
  pos: Pos[],
  pairs: ProximityEdge[],
  filterByTier: boolean,
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null,
  connNamePrefix: string,
  guardMatchPrefix: string,
): Variant {
  const count = allLetters.length;
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;

  // Для balanced-раскладки срезать рёбра, перескакивающие quality-тир.
  // Разрешены: та же группа, соседние; пропуск групп — только когда
  // промежуточные группы отсутствуют (иначе граф несвязен).
  if (filterByTier) {
    const presentGroups = new Set(
      allLetters.map((l) => zoneQualityGroup(l, playerLetters, neutralByLetter)),
    );
    pairs = pairs.filter((p) => {
      const la = allLetters[p[0]];
      const lb = allLetters[p[1]];
      const aPlayer = playerLetters.includes(la);
      const bPlayer = playerLetters.includes(lb);
      if (isolate && aPlayer && bPlayer) return false;
      const ga = zoneQualityGroup(la, playerLetters, neutralByLetter);
      const gb = zoneQualityGroup(lb, playerLetters, neutralByLetter);
      const lo = Math.min(ga, gb);
      const hi = Math.max(ga, gb);
      if (hi === lo) return true;
      if (hi - lo <= 2) return true;
      for (let g = lo + 1; g < hi; g++) {
        if (presentGroups.has(g)) return false;
      }
      return true;
    });
  }

  const connsByZone: string[][] = Array.from({ length: count }, () => []);
  const connections: Connection[] = [];

  for (const [a, b] of pairs) {
    const fromLetter = allLetters[a];
    const toLetter = allLetters[b];
    if (isolate && playerLetters.includes(fromLetter) && playerLetters.includes(toLetter)) continue;

    const connName = `${connNamePrefix}-${fromLetter}-${toLetter}`;
    connsByZone[a].push(connName);
    connsByZone[b].push(connName);

    const fromZone = playerLetters.includes(fromLetter) ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = playerLetters.includes(toLetter) ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: connName,
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `${guardMatchPrefix}_${fromLetter}_${toLetter}`,
      }),
    );
  }

  const zones: Zone[] = [];
  for (let i = 0; i < count; i++) {
    const letter = allLetters[i];
    const myConns = connsByZone[i];
    const playerIdx = playerLetters.indexOf(letter);
    let zone: Zone;
    if (playerIdx >= 0) {
      zone = buildSpawnZone(
        letter,
        `Player${playerIdx + 1}`,
        myConns,
        settings.zoneCfg.playerZoneCastles,
        settings.matchPlayerCastleFactions,
        settings.zoneCfg.advanced.playerZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      );
    } else {
      zone = buildNeutralZone(
        neutralByLetter.get(letter) as NeutralZonePlan,
        myConns,
        settings.zoneCfg.advanced.neutralZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
        letter === holdCityNeutralLetter,
      );
    }
    zone.generatorPosition = pos[i];
    zones.push(zone);
  }

  if (settings.randomPortals) {
    connections.push(
      ...buildRandomPortalConnections(playerLetters, allLetters, tuning, rng, settings.maxPortalConnections),
    );
  }

  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning);
  ensureFullConnectivity(
    playerLetters,
    allLetters,
    pos,
    zones,
    connections,
    tuning,
    filterByTier ? neutralByLetter : null,
  );
  return makeVariant(playerLetters, allLetters[0], count, zones, connections);
}

// ── Топология: Hub & Spoke ───────────────────────────────────────────────────

export function buildVariantHubAndSpoke(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  hubIsHoldCity = false,
): Variant {
  // Центральная «Hub»-зона подключена к каждой внешней зоне; внешние —
  // игроки + нейтральные по кольцу вокруг hub.
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  let outerLetters: string[];
  {
    const honoredSeparation =
      settings.minNeutralZonesBetweenPlayers > 0 &&
      canHonorNeutralSeparation(settings, neutralZones.length)
        ? settings.minNeutralZonesBetweenPlayers
        : 0;
    outerLetters = buildBalancedRingLetters(playerLetters, neutralZones, honoredSeparation);
  }
  const zones: Zone[] = [];
  const connections: Connection[] = [];

  // Hub-зона (нейтральная, настраиваемые замки, высокий лут).
  const hubConns = outerLetters.map((l) => `Hub-${l}`);
  zones.push(
    buildHubZone(
      hubConns,
      tuning,
      hubIsHoldCity,
      settings.zoneCfg.hubZoneSize,
      settings.zoneCfg.hubZoneCastles,
      settings.generateRoads,
    ),
  );

  // Каждая внешняя зона подключена только к hub.
  for (let i = 0; i < outerLetters.length; i++) {
    const letter = outerLetters[i];
    const spokeConns = [`Hub-${letter}`];
    const playerIdx = playerLetters.indexOf(letter);
    if (playerIdx >= 0) {
      zones.push(
        buildSpawnZone(
          letter,
          `Player${playerIdx + 1}`,
          spokeConns,
          settings.zoneCfg.playerZoneCastles,
          settings.matchPlayerCastleFactions,
          settings.zoneCfg.advanced.playerZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    } else {
      zones.push(
        buildNeutralZone(
          neutralByLetter.get(letter) as NeutralZonePlan,
          spokeConns,
          settings.zoneCfg.advanced.neutralZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    }
  }

  // Hub → каждая внешняя зона: охраняемые Direct-подключения (по несколько
  // на зону, как в JCC).
  for (const letter of outerLetters) {
    const outerZone = playerLetters.includes(letter) ? `Spawn-${letter}` : `Neutral-${letter}`;
    // Главное именованное подключение.
    connections.push(
      makeConnection({
        name: `Hub-${letter}`,
        from: "Hub",
        to: outerZone,
        connectionType: "Direct",
        guardZone: "Hub",
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `hub_guard_${letter}`,
      }),
    );
    // Дополнительные Direct-подключения с уникальными guardMatchGroups
    // (паттерн JCC).
    for (let e = 1; e < CONNECTIONS_PER_ZONE; e++) {
      connections.push(
        makeConnection({
          from: "Hub",
          to: outerZone,
          connectionType: "Direct",
          guardZone: "Hub",
          guardEscape: false,
          simTurnSquad: true,
          guardValue: scaleBorderGuardValue(30000, tuning),
          guardWeeklyIncrement: 0.15,
          guardMatchGroup: `hub_guard_${letter}_${e}`,
        }),
      );
    }
  }

  // Proximity-подключения по всему внешнему кольцу: подсказки движку, какие
  // зоны соседние. Без них движок игнорирует порядок зон и расставляет
  // произвольно, и игроки оказываются рядом даже при нейтральных буферах.
  for (let i = 0; i < outerLetters.length; i++) {
    const next = (i + 1) % outerLetters.length;
    const fromLetter = outerLetters[i];
    const toLetter = outerLetters[next];
    const fromIsPlayer = playerLetters.includes(fromLetter);
    const toIsPlayer = playerLetters.includes(toLetter);

    // Прямое player–player proximity пропускается при изоляции.
    if (settings.noDirectPlayerConnections && fromIsPlayer && toIsPlayer) continue;

    const fromZone = fromIsPlayer ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = toIsPlayer ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: `Pseudo-${fromLetter}-${toLetter}`,
        from: fromZone,
        to: toZone,
        connectionType: "Proximity",
      }),
    );
  }

  if (settings.randomPortals) {
    connections.push(
      ...buildRandomPortalConnections(playerLetters, outerLetters, tuning, rng, settings.maxPortalConnections),
    );
  }

  return makeVariant(playerLetters, outerLetters[0], outerLetters.length + 1, zones, connections);
}

// ── Топология: Chain ─────────────────────────────────────────────────────────

export function buildVariantChain(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
): Variant {
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  const orderedLetters = buildOrderedLetters(settings, playerLetters, neutralZones, false);
  const count = orderedLetters.length;
  const isolate = settings.noDirectPlayerConnections && playerLetters.length > 1;

  // Имена подключений для каждой смежной пары; player–player пары
  // пропускаются при изоляции. null = подключения в этой позиции нет.
  const connNames: (string | null)[] = new Array(Math.max(0, count - 1)).fill(null);
  for (let i = 0; i < count - 1; i++) {
    const bothPlayers =
      playerLetters.includes(orderedLetters[i]) && playerLetters.includes(orderedLetters[i + 1]);
    if (isolate && bothPlayers) continue;
    connNames[i] = `Chain-${orderedLetters[i]}-${orderedLetters[i + 1]}`;
  }

  const zones: Zone[] = [];
  for (let i = 0; i < count; i++) {
    const letter = orderedLetters[i];
    const myConns: string[] = [];
    if (i > 0 && connNames[i - 1] !== null) myConns.push(connNames[i - 1] as string);
    if (i < count - 1 && connNames[i] !== null) myConns.push(connNames[i] as string);

    const playerIdx = playerLetters.indexOf(letter);
    if (playerIdx >= 0) {
      zones.push(
        buildSpawnZone(
          letter,
          `Player${playerIdx + 1}`,
          myConns,
          settings.zoneCfg.playerZoneCastles,
          settings.matchPlayerCastleFactions,
          settings.zoneCfg.advanced.playerZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
        ),
      );
    } else {
      zones.push(
        buildNeutralZone(
          neutralByLetter.get(letter) as NeutralZonePlan,
          myConns,
          settings.zoneCfg.advanced.neutralZoneSize,
          settings.spawnRemoteFootholds,
          settings.generateRoads,
          tuning,
          letter === holdCityNeutralLetter,
        ),
      );
    }
  }

  const connections: Connection[] = [];
  for (let i = 0; i < count - 1; i++) {
    if (connNames[i] === null) continue;
    const fromLetter = orderedLetters[i];
    const toLetter = orderedLetters[i + 1];
    const fromZone = playerLetters.includes(fromLetter) ? `Spawn-${fromLetter}` : `Neutral-${fromLetter}`;
    const toZone = playerLetters.includes(toLetter) ? `Spawn-${toLetter}` : `Neutral-${toLetter}`;
    connections.push(
      makeConnection({
        name: connNames[i] as string,
        from: fromZone,
        to: toZone,
        connectionType: "Direct",
        guardZone: fromZone,
        guardEscape: false,
        simTurnSquad: true,
        guardValue: scaleBorderGuardValue(30000, tuning),
        guardWeeklyIncrement: 0.15,
        guardMatchGroup: `chain_guard_${fromLetter}_${toLetter}`,
      }),
    );
  }

  if (settings.randomPortals) {
    connections.push(
      ...buildRandomPortalConnections(playerLetters, orderedLetters, tuning, rng, settings.maxPortalConnections),
    );
  }

  if (isolate) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning);
  return makeVariant(playerLetters, orderedLetters[0], count, zones, connections);
}

// ── Топология: Shared Web ────────────────────────────────────────────────────

export function buildVariantSharedWeb(
  settings: GeneratorSettings,
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  tuning: GenerationTuning,
  rng: Rng,
  holdCityNeutralLetter: string | null = null,
): Variant {
  // Каждый игрок подключён к двум нейтральным зонам; нейтральные образуют
  // кольцо, связывающее всех игроков. При нехватке нейтральных — wraparound
  // (несколько игроков делят нейтральную). Нужна хотя бы одна нейтральная.
  const neutralByLetter = new Map<string, NeutralZonePlan>(neutralZones.map((z): [string, NeutralZonePlan] => [z.letter, z]));
  const neutrals = buildBalancedNeutralRing(neutralZones, playerLetters.length);

  const p = playerLetters.length;
  const n = neutrals.length;

  // Имена подключений нейтрального кольца считаются заранее.
  const neutralRingConns: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    neutralRingConns[i] = `NRing-${neutrals[i]}-${neutrals[next]}`;
  }

  const spokeConnsByPlayer = new Map<string, string[]>(playerLetters.map((l): [string, string[]] => [l, []]));
  const spokeConnsByNeutral = new Map<string, string[]>(neutrals.map((l): [string, string[]] => [l, []]));
  const addSpoke = (playerLetter: string, neutralLetter: string): void => {
    const connName = `Web-${playerLetter}-${neutralLetter}`;
    (spokeConnsByPlayer.get(playerLetter) as string[]).push(connName);
    (spokeConnsByNeutral.get(neutralLetter) as string[]).push(connName);
  };
  for (let i = 0; i < p; i++) {
    // Игроки распределяются по нейтральному кольцу равномерно.
    const n1 = Math.floor((i * n) / p) % n;
    const n2 = (Math.floor((i * n) / p) + 1) % n;

    addSpoke(playerLetters[i], neutrals[n1]);
    if (n1 !== n2) addSpoke(playerLetters[i], neutrals[n2]);
  }

  const zones: Zone[] = [];
  const connections: Connection[] = [];

  // Нейтральные зоны: каждая получает endpoints кольца и player-spoke.
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const neutralConns: string[] = [];
    if (n > 1) {
      neutralConns.push(neutralRingConns[prev]);
      neutralConns.push(neutralRingConns[i]);
    }

    neutralConns.push(...(spokeConnsByNeutral.get(neutrals[i]) as string[]));
    const nConns = Array.from(new Set(neutralConns));
    const neutralZone = buildNeutralZone(
      neutralByLetter.get(neutrals[i]) as NeutralZonePlan,
      nConns,
      settings.zoneCfg.advanced.neutralZoneSize,
      settings.spawnRemoteFootholds,
      settings.generateRoads,
      tuning,
      neutrals[i] === holdCityNeutralLetter,
    );
    if ((neutralByLetter.get(neutrals[i]) as NeutralZonePlan).castleCount === 0) {
      neutralZone.roads = buildConnectorZoneRoads(nConns, settings.generateRoads);
    }
    zones.push(neutralZone);
  }

  // Player-зоны — каждая подключена к двум нейтральным (равномерно).
  for (let i = 0; i < p; i++) {
    const spokeConns = spokeConnsByPlayer.get(playerLetters[i]) as string[];

    zones.push(
      buildSpawnZone(
        playerLetters[i],
        `Player${i + 1}`,
        spokeConns,
        settings.zoneCfg.playerZoneCastles,
        settings.matchPlayerCastleFactions,
        settings.zoneCfg.advanced.playerZoneSize,
        settings.spawnRemoteFootholds,
        settings.generateRoads,
        tuning,
      ),
    );

    // Player → нейтральная: Direct-подключения.
    for (const connName of spokeConns) {
      const neutralLetter = connName.split("-")[2]; // «Web-A-I» → индекс 2 = «I»
      const neutralZone = `Neutral-${neutralLetter}`;
      connections.push(
        makeConnection({
          name: connName,
          from: `Spawn-${playerLetters[i]}`,
          to: neutralZone,
          connectionType: "Direct",
          guardZone: neutralZone,
          guardEscape: false,
          simTurnSquad: true,
          guardValue: scaleBorderGuardValue(30000, tuning),
          guardWeeklyIncrement: 0.15,
          guardMatchGroup: `web_guard_${playerLetters[i]}_${neutralLetter}`,
        }),
      );
    }
  }

  // Подключения нейтрального кольца.
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      connections.push(
        makeConnection({
          name: neutralRingConns[i],
          from: `Neutral-${neutrals[i]}`,
          to: `Neutral-${neutrals[next]}`,
          connectionType: "Direct",
          guardZone: `Neutral-${neutrals[i]}`,
          guardEscape: false,
          simTurnSquad: true,
          guardValue: scaleBorderGuardValue(20000, tuning),
          guardWeeklyIncrement: 0.15,
          guardMatchGroup: `nring_guard_${neutrals[i]}_${neutrals[next]}`,
        }),
      );
    }
  }

  if (settings.randomPortals) {
    const allLetters = [...playerLetters, ...neutrals];
    connections.push(
      ...buildRandomPortalConnections(playerLetters, allLetters, tuning, rng, settings.maxPortalConnections),
    );
  }

  const isolateWeb = settings.noDirectPlayerConnections && playerLetters.length > 1;
  if (isolateWeb) ensurePlayerZonesConnected(playerLetters, zones, connections, tuning);

  return makeVariant(playerLetters, playerLetters[0], zones.length, zones, connections);
}
