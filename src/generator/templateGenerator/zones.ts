import type { NeutralZoneQuality } from "../enums";
import type { MainObject, Road, RoadEndpoint, Zone } from "../template";
import {
  CENTER_LAYOUT_NAME,
  GENERAL_RESOURCES_MEDIUM,
  GENERAL_RESOURCES_POOR,
  SPAWN_LAYOUT_NAME,
  T2_GUARDED_POOLS,
  T2_UNGUARDED_POOLS,
  T3_GUARDED_POOLS,
  T3_UNGUARDED_POOLS,
  neutralZoneProfile,
  normalizeZoneSize,
  scaleGuardMultiplier,
  scaleNeutralGuardValue,
  scaleResourceValue,
  scaleStructureValue,
  type GenerationTuning,
  type NeutralZonePlan,
} from "./shared";

/**
 * Порт билдеров зон TemplateGenerator.cs: BuildSpawnZone / BuildNeutralZone /
 * BuildHubZone, фабрики дорог и endpoint'ов, списки content-limits.
 * Все объекты строятся в порядке объявления свойств C#-моделей — это
 * фиксирует порядок ключей при JSON-эмите.
 */

export function buildSpawnZone(
  letter: string,
  player: string,
  ringConns: string[],
  castleCount: number,
  matchCastleFactions: boolean,
  zoneSize: number,
  spawnFootholds: boolean,
  generateRoads: boolean,
  tuning: GenerationTuning,
): Zone {
  // Индекс 0 = Spawn (город игрока), индексы 1..castleCount-1 = доп. города.
  const mainObjects: MainObject[] = [
    {
      type: "Spawn",
      spawn: player,
      guardChance: 1.0,
      guardValue: scaleNeutralGuardValue(5000, tuning),
      guardWeeklyIncrement: 0.10,
      removeGuardIfHasOwner: true,
      buildingsConstructionSid: "default_buildings_construction",
      placement: "Uniform",
      placementArgs: ["true", "0.7", "0"],
    },
  ];

  for (let i = 1; i < castleCount; i++) {
    mainObjects.push({
      type: "City",
      guardChance: 1.0,
      guardValue: scaleNeutralGuardValue(2500, tuning),
      guardWeeklyIncrement: 0.1,
      removeGuardIfHasOwner: null,
      buildingsConstructionSid: "poor_buildings_construction",
      faction: matchCastleFactions
        ? { type: "Match", args: ["0"] }
        : { type: "Random", args: [] },
      placement: "Uniform",
      placementArgs: ["false", "-0.8", "3"],
    });
  }

  return {
    name: `Spawn-${letter}`,
    size: normalizeZoneSize(zoneSize),
    layout: SPAWN_LAYOUT_NAME,
    guardCutoffValue: 2000,
    guardRandomization: tuning.guardRandomization,
    guardMultiplier: scaleGuardMultiplier(1.0, tuning),
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [
      ...(tuning.guardReactionOverride ?? [60, 20, 10, 10, 2, 0]),
    ],
    diplomacyModifier: -0.5,
    encounterHolesSettings: null,
    guardedContentPool: [...T2_GUARDED_POOLS],
    unguardedContentPool: [...T2_UNGUARDED_POOLS],
    resourcesContentPool: [...GENERAL_RESOURCES_POOR],
    mandatoryContent: [`mandatory_content_side_${letter}`],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaleStructureValue(200000 * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(2000 * Math.sqrt(tuning.contentScale), tuning),
    unguardedContentValue: scaleStructureValue(50000 * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(400 * Math.sqrt(tuning.contentScale), tuning),
    resourcesValue: scaleResourceValue(80000 * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(600 * Math.sqrt(tuning.contentScale), tuning),
    mainObjects,
    zoneBiome: { type: "MatchMainObject", args: ["0"] },
    contentBiome: { type: "MatchMainObject", args: ["0"] },
    metaObjectsBiome: { type: "MatchMainObject", args: ["0"] },
    randomHireEnableWeeklyUnitIncrement: null,
    randomHireInitialUnitIncrement: null,
    crossroadsPosition: 0,
    roads:
      castleCount > 0
        ? buildOuterZoneRoads(ringConns, castleCount, spawnFootholds, generateRoads)
        : buildConnectorZoneRoads(ringConns, generateRoads),
  };
}

export function buildNeutralZone(
  plan: NeutralZonePlan,
  ringConns: string[],
  zoneSize: number,
  spawnFootholds: boolean,
  generateRoads: boolean,
  tuning: GenerationTuning,
  isHoldCity = false,
): Zone {
  const letter = plan.letter;
  // Когда зона — hold city, гарантирован хотя бы один замок.
  const castleCount = isHoldCity ? Math.max(1, plan.castleCount) : plan.castleCount;
  const profile = neutralZoneProfile(plan.quality);

  const mainObjects: MainObject[] = [];
  if (castleCount > 0) {
    mainObjects.push({
      type: "City",
      guardChance: 1.0,
      guardValue: scaleNeutralGuardValue(
        isHoldCity ? Math.max(profile.primaryCityGuardValue, 20000) : profile.primaryCityGuardValue,
        tuning,
      ),
      guardWeeklyIncrement: 0.1,
      removeGuardIfHasOwner: null,
      buildingsConstructionSid: isHoldCity
        ? "ultra_rich_buildings_construction"
        : profile.primaryBuildingsConstructionSid,
      faction: { type: "FromList", args: [] },
      placement: isHoldCity ? "Center" : "Uniform",
      placementArgs: isHoldCity ? [] : ["true", "0.8", "2"],
      holdCityWinCon: isHoldCity ? true : undefined,
    });
  }

  for (let i = 1; i < castleCount; i++) {
    mainObjects.push({
      type: "City",
      guardChance: 1.0,
      guardValue: scaleNeutralGuardValue(profile.extraCityGuardValue, tuning),
      guardWeeklyIncrement: 0.1,
      removeGuardIfHasOwner: null,
      buildingsConstructionSid: profile.extraBuildingsConstructionSid,
      faction: { type: "FromList", args: [] },
      placement: "Uniform",
      placementArgs: ["false", "-0.8", "3"],
    });
  }

  return {
    name: `Neutral-${letter}`,
    size: normalizeZoneSize(zoneSize),
    layout: profile.layout,
    guardCutoffValue: 2000,
    guardRandomization: tuning.guardRandomization,
    guardMultiplier: scaleGuardMultiplier(profile.guardMultiplier, tuning),
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [
      ...(tuning.guardReactionOverride ??
        (plan.quality === "High" ? [0, 10, 10, 20, 10, 0] : [0, 10, 10, 10, 10, 0])),
    ],
    diplomacyModifier: -0.5,
    encounterHolesSettings: null,
    guardedContentPool: [...profile.guardedContentPool],
    unguardedContentPool: [...profile.unguardedContentPool],
    resourcesContentPool: [...profile.resourcesContentPool],
    mandatoryContent: [`mandatory_content_neutral_${letter}`],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaleStructureValue(profile.guardedContentValue * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(
      profile.guardedContentValuePerArea * Math.sqrt(tuning.contentScale),
      tuning,
    ),
    unguardedContentValue: scaleStructureValue(profile.unguardedContentValue * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(
      profile.unguardedContentValuePerArea * Math.sqrt(tuning.contentScale),
      tuning,
    ),
    resourcesValue: scaleResourceValue(profile.resourcesValue * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(profile.resourcesValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    mainObjects,
    zoneBiome:
      castleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    contentBiome:
      castleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    metaObjectsBiome:
      castleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    randomHireEnableWeeklyUnitIncrement: null,
    randomHireInitialUnitIncrement: null,
    crossroadsPosition: 0,
    roads:
      castleCount > 0
        ? buildOuterZoneRoads(ringConns, castleCount, spawnFootholds, generateRoads)
        : buildConnectorZoneRoads(ringConns, generateRoads),
  };
}

/** Hub-зона — используется только топологией Hub & Spoke (и турнирными hub-кластерами). */
export function buildHubZone(
  spokeConns: string[],
  tuning: GenerationTuning,
  isHoldCity = false,
  size = 1.0,
  castleCount = 0,
  generateRoads = true,
): Zone {
  // При активном hold city нужен хотя бы один замок. Если замки уже
  // сконфигурированы (>0), один из них выбирается hold-city замком;
  // иначе форсируется ровно один.
  const effectiveCastleCount = isHoldCity ? Math.max(1, castleCount) : castleCount;

  const mainObjects: MainObject[] = [];
  for (let i = 0; i < effectiveCastleCount; i++) {
    const isHoldCastleSlot = isHoldCity && i === 0;
    mainObjects.push({
      type: "City",
      guardChance: isHoldCastleSlot ? 1.0 : 0.5,
      // Math.Max(25000, 20000) в C# — всегда 25000.
      guardValue: scaleNeutralGuardValue(isHoldCastleSlot ? 25000 : 16000, tuning),
      guardWeeklyIncrement: 0.1,
      removeGuardIfHasOwner: null,
      buildingsConstructionSid: isHoldCastleSlot
        ? "ultra_rich_buildings_construction"
        : "rich_buildings_construction",
      faction: { type: "FromList", args: [] },
      placement: isHoldCastleSlot ? "Center" : "Uniform",
      placementArgs: isHoldCastleSlot ? [] : ["true", "0.8", "2"],
      holdCityWinCon: isHoldCastleSlot ? true : undefined,
    });
  }

  return {
    name: "Hub",
    size,
    layout: CENTER_LAYOUT_NAME,
    guardCutoffValue: 2000,
    guardRandomization: 0.05,
    guardMultiplier: scaleGuardMultiplier(1.5, tuning),
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [
      ...(tuning.guardReactionOverride ?? [0, 10, 10, 20, 10, 0]),
    ],
    diplomacyModifier: -0.5,
    encounterHolesSettings: null,
    guardedContentPool: [...T3_GUARDED_POOLS],
    unguardedContentPool: [...T3_UNGUARDED_POOLS],
    resourcesContentPool: [...GENERAL_RESOURCES_MEDIUM],
    mandatoryContent: [],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaleStructureValue(300000 * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(2400 * Math.sqrt(tuning.contentScale), tuning),
    unguardedContentValue: scaleStructureValue(50000 * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(600 * Math.sqrt(tuning.contentScale), tuning),
    resourcesValue: scaleResourceValue(80000 * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(600 * Math.sqrt(tuning.contentScale), tuning),
    mainObjects,
    zoneBiome:
      effectiveCastleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    contentBiome:
      effectiveCastleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    metaObjectsBiome:
      effectiveCastleCount > 0
        ? { type: "MatchMainObject", args: ["0"] }
        : { type: "MatchZone", args: [] },
    randomHireEnableWeeklyUnitIncrement: null,
    randomHireInitialUnitIncrement: null,
    crossroadsPosition: 0,
    roads:
      effectiveCastleCount > 0
        ? buildOuterZoneRoads(spokeConns, effectiveCastleCount, false, generateRoads)
        : buildConnectorZoneRoads(spokeConns, generateRoads),
  };
}

// ── Content limit helpers ────────────────────────────────────────────────────

export function buildCenterContentLimits(playerCount: number): string[] {
  // JCC имеет лимиты под каждый вариант числа игроков 1..6.
  const limits: string[] = [];
  for (let n = 1; n <= playerCount; n++) limits.push(`content_limits_center_${n}`);
  return limits;
}

export function buildSideContentLimits(): string[] {
  // Одинаковый список для каждой внешней зоны в JCC.
  const limits: string[] = [];
  for (let a = 1; a <= 5; a++) {
    for (let b = a + 1; b <= 6; b++) {
      limits.push(`content_limits_side_${a}_${b}`);
    }
  }
  return limits;
}

// ── Фабрики дорог и endpoint'ов ──────────────────────────────────────────────

/**
 * Список дорог для spawn- или нейтральной внешней зоны: дороги к каждому
 * смежному ring-подключению, ко второму городу (индекс 1) и к удалённому
 * foothold'у.
 */
export function buildOuterZoneRoads(
  ringConns: string[],
  castleCount: number,
  includeFoothold: boolean,
  generateRoads: boolean,
): Road[] {
  const roads: Road[] = [];
  if (!generateRoads || castleCount === 0) return roads;

  for (let i = 1; i < castleCount; i++) {
    roads.push(plainRoad(mainObjectEndpoint("0"), mainObjectEndpoint(String(i))));
  }

  if (includeFoothold) {
    roads.push(plainRoad(mainObjectEndpoint("0"), mandatoryContentEndpoint("name_remote_foothold_1")));
  }
  for (const rc of ringConns) {
    roads.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(rc)));
  }
  return roads;
}

export function buildConnectorZoneRoads(connectionNames: string[], generateRoads: boolean): Road[] {
  const roads: Road[] = [];
  if (!generateRoads) return roads;

  const distinctConnections = Array.from(
    new Set(connectionNames.filter((name) => name.trim().length > 0)),
  );

  if (distinctConnections.length === 1) {
    const connectionName = distinctConnections[0];
    roads.push(plainRoad(connectionEndpoint(connectionName), connectionEndpoint(connectionName)));
    return roads;
  }

  const anchor = distinctConnections.length > 0 ? distinctConnections[0] : null;
  if (anchor === null) return roads;

  for (const connectionName of distinctConnections.slice(1)) {
    roads.push(plainRoad(connectionEndpoint(anchor), connectionEndpoint(connectionName)));
  }
  return roads;
}

export function plainRoad(from: RoadEndpoint, to: RoadEndpoint): Road {
  // type: null — поле стоит первым в C#-модели Road; поздний штамп
  // bordersRoads.roadType не должен менять порядок ключей.
  return { type: null, from, to };
}

export function mainObjectEndpoint(index: string): RoadEndpoint {
  return { type: "MainObject", args: [index] };
}

export function connectionEndpoint(name: string): RoadEndpoint {
  return { type: "Connection", args: [name] };
}

export function mandatoryContentEndpoint(name: string): RoadEndpoint {
  return { type: "MandatoryContent", args: [name] };
}

/** Экспорт профиля нейтральной зоны для тестов (GetNeutralZoneProfile). */
export function getNeutralZoneProfile(quality: NeutralZoneQuality) {
  return neutralZoneProfile(quality);
}
