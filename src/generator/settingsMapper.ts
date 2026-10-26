import type { GuardReactionPreset, MapTopology } from "./enums";
import { isExperimentalMapSize } from "./knownValues";
import {
  defaultGeneratorSettings,
  emptyNeutralZoneContent,
  emptyZoneContentList,
  type AdvancedSettings,
  type GeneratorSettings,
  type TierOverrides,
} from "./settings";
import {
  defaultSettingsFile,
  effectiveResourceDensity,
  effectiveStructureDensity,
  type SettingsFile,
  type TierOverrideFile,
} from "./settingsFile";
import { joinSidCsv, parseSidCsv } from "./sidCsv";

/**
 * Перевод между персистентной формой SettingsFile (.oetgs) и внутренней
 * формой GeneratorSettings, с которой работают панели UI. Аналог пары
 * GatherSettings/ApplySettings из MainWindow: в памяти одна модель, поэтому
 * маппинг прямой.
 */

/**
 * Набор per-feature экспериментальных флагов (T-302), восстанавливаемый из
 * загруженного файла. Ключи — из реестра experimentalFeatures
 * ("game-mode", "starting-bonuses", "zone-content", "borders-roads",
 * "per-tier-overrides"). Плоский объект вместо именованных полей класса:
 * добавление фичи трогает только реестр и SettingsFile.
 */
export interface ExperimentalFlags {
  gameMode: boolean;
  startingBonuses: boolean;
  zoneContent: boolean;
  bordersRoads: boolean;
  perTierOverrides: boolean;
}

export function emptyExperimentalFlags(): ExperimentalFlags {
  return {
    gameMode: false,
    startingBonuses: false,
    zoneContent: false,
    bordersRoads: false,
    perTierOverrides: false,
  };
}

export function experimentalAnyEnabled(flags: ExperimentalFlags): boolean {
  return (
    flags.gameMode ||
    flags.startingBonuses ||
    flags.zoneContent ||
    flags.bordersRoads ||
    flags.perTierOverrides
  );
}

/** По ключу реестра экспериментальных фич; неизвестный ключ — ошибка (как в C#). */
export function getExperimentalFlag(flags: ExperimentalFlags, key: string): boolean {
  switch (key) {
    case "game-mode": return flags.gameMode;
    case "starting-bonuses": return flags.startingBonuses;
    case "zone-content": return flags.zoneContent;
    case "borders-roads": return flags.bordersRoads;
    case "per-tier-overrides": return flags.perTierOverrides;
    default: throw new Error(`Неизвестный ключ экспериментальной фичи: ${key}`);
  }
}

export function setExperimentalFlag(
  flags: ExperimentalFlags,
  key: string,
  value: boolean,
): void {
  switch (key) {
    case "game-mode": flags.gameMode = value; break;
    case "starting-bonuses": flags.startingBonuses = value; break;
    case "zone-content": flags.zoneContent = value; break;
    case "borders-roads": flags.bordersRoads = value; break;
    case "per-tier-overrides": flags.perTierOverrides = value; break;
    default: throw new Error(`Неизвестный ключ экспериментальной фичи: ${key}`);
  }
}

export function cloneExperimentalFlags(flags: ExperimentalFlags): ExperimentalFlags {
  return {
    gameMode: flags.gameMode,
    startingBonuses: flags.startingBonuses,
    zoneContent: flags.zoneContent,
    bordersRoads: flags.bordersRoads,
    perTierOverrides: flags.perTierOverrides,
  };
}

/** Полный результат fromFile: настройки + восстановленное состояние advanced-режима. */
export interface FromFileResult {
  settings: GeneratorSettings;
  advancedMode: boolean;
  experimentalMapSizes: boolean;
  experimental: ExperimentalFlags;
}

const GUARD_REACTION_PRESETS: GuardReactionPreset[] = [
  "Default",
  "FrontLoaded",
  "Even",
  "BackLoaded",
  "Custom",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseGuardReactionPreset(raw?: string | null): GuardReactionPreset {
  if (!raw || raw.trim().length === 0) return "Default";
  const needle = raw.trim().toLowerCase();
  const found = GUARD_REACTION_PRESETS.find((p) => p.toLowerCase() === needle);
  return found ?? "Default";
}

/** CSV из шести неотрицательных int; любой битый токен → пустой список (дефолт). */
function parseDistributionCsv(csv?: string | null): number[] {
  if (!csv || csv.trim().length === 0) return [];
  const parts = csv.split(",").filter((p) => p.length > 0);
  const result: number[] = [];
  for (const p of parts) {
    const token = p.trim();
    if (/^[+-]?\d+$/.test(token) && Number.parseInt(token, 10) >= 0) {
      result.push(Number.parseInt(token, 10));
    } else {
      return []; // любой некорректный токен → отбросить весь список
    }
  }
  return result;
}

// T-508 — CSV-кодеки для per-zone массивов случайного найма. Пустая / whitespace
// строка или любой битый токен → пустой список («не задано»).

function parseBoolListCsv(csv?: string | null): boolean[] {
  if (!csv || csv.trim().length === 0) return [];
  const parts = csv.split(",").filter((p) => p.length > 0);
  const result: boolean[] = [];
  for (const p of parts) {
    const token = p.trim().toLowerCase();
    if (token === "true" || token === "false") {
      result.push(token === "true");
    } else {
      return [];
    }
  }
  return result;
}

function parseIntListCsv(csv?: string | null): number[] {
  if (!csv || csv.trim().length === 0) return [];
  const parts = csv.split(",").filter((p) => p.length > 0);
  const result: number[] = [];
  for (const p of parts) {
    const token = p.trim();
    if (/^[+-]?\d+$/.test(token)) {
      result.push(Number.parseInt(token, 10));
    } else {
      return [];
    }
  }
  return result;
}

function joinBoolListCsv(list?: readonly boolean[] | null): string {
  return list && list.length > 0 ? list.map((b) => (b ? "true" : "false")).join(",") : "";
}

function joinIntListCsv(list?: readonly number[] | null): string {
  return list && list.length > 0 ? list.map((i) => String(i)).join(",") : "";
}

function tierFromFile(f?: TierOverrideFile | null): TierOverrides {
  return {
    obstaclesFill: f?.obstaclesFill ?? 0,
    lakesFill: f?.lakesFill ?? 0,
    buildingPreset: f?.buildingPreset ?? "",
    guardWeeklyIncrement: f?.guardWeeklyIncrement ?? 0,
  };
}

function tierToFile(t: TierOverrides): TierOverrideFile {
  return {
    obstaclesFill: t.obstaclesFill,
    lakesFill: t.lakesFill,
    buildingPreset: t.buildingPreset,
    guardWeeklyIncrement: t.guardWeeklyIncrement,
  };
}

/**
 * Построить полный результат из загруженного файла: настройки, вычисленный
 * advanced-режим, флаг экспериментальных размеров карты и per-feature
 * экспериментальные флаги.
 */
export function fromFileFull(file: SettingsFile): FromFileResult {
  const hasCustomZoneSizes =
    Math.abs(file.playerZoneSize - 1.0) > 0.0001 ||
    Math.abs(file.neutralZoneSize - 1.0) > 0.0001;
  const needsExperimentalMapSizes =
    file.experimentalMapSizes || isExperimentalMapSize(file.mapSize);
  const advanced =
    file.advancedMode || needsExperimentalMapSizes || hasCustomZoneSizes;

  // Миграция: до появления топологии Balanced файлы писали Topology=Random +
  // legacy-флаг experimentalBalancedZonePlacement в значении «то же, что сегодня
  // MapTopology.Balanced». При загрузке повышаем до новой топологии.
  const migratedTopology: MapTopology =
    file.topology === "Random" && file.experimentalBalancedZonePlacement
      ? "Balanced"
      : file.topology;

  const settings = defaultGeneratorSettings();

  settings.templateName = file.templateName ? file.templateName : "Custom Template";
  // T-504 — пользовательские переопределения; "" = автогенерация. Пробрасываем как есть.
  settings.description = file.descriptionOverride ?? "";
  settings.displayWinCondition = file.displayWinConditionOverride ?? "";
  settings.gameMode = file.gameMode ? file.gameMode : "Classic";
  settings.mapSize = file.mapSize;
  settings.playerCount = file.playerCount;
  settings.heroHireBan = file.heroHireBan;
  settings.desertionDay = file.desertionDay;
  settings.desertionValue = file.desertionValue;
  settings.terrain = {
    obstaclesFill: file.terrainObstaclesFill,
    lakesFill: file.terrainLakesFill,
  };
  settings.bordersRoads = {
    cornerRadius: file.borderCornerRadius,
    obstaclesWidth: file.borderObstaclesWidth,
    waterBorderEnabled: file.waterBorderEnabled,
    waterWidth: file.waterWidth,
    roadType: file.roadType ? file.roadType : null,
  };
  settings.zoneOverrides = {
    diplomacyModifier: file.zoneDiplomacyModifier,
    crossroadsPosition: file.zoneCrossroadsPosition,
    contentBiomeType: file.zoneContentBiomeType ?? "",
    contentBiomeArg: file.zoneContentBiomeArg ?? "",
    metaObjectsBiomeType: file.zoneMetaObjectsBiomeType ?? "",
    metaObjectsBiomeArg: file.zoneMetaObjectsBiomeArg ?? "",
    guardCutoffValue: file.zoneGuardCutoffValue,
    guardedContentPool: parseSidCsv(file.zoneGuardedContentPool),
    unguardedContentPool: parseSidCsv(file.zoneUnguardedContentPool),
    contentCountLimitRefs: parseSidCsv(file.zoneContentCountLimits),
    guardMultiplier: file.zoneGuardMultiplier,
    guardRandomization: file.zoneGuardRandomization,
    // T-503 — per-zone переопределения значений контента/ресурсов.
    resourcesValue: file.zoneResourcesValue,
    resourcesValuePerArea: file.zoneResourcesValuePerArea,
    guardedContentValue: file.zoneGuardedContentValue,
    guardedContentValuePerArea: file.zoneGuardedContentValuePerArea,
    unguardedContentValue: file.zoneUnguardedContentValue,
    unguardedContentValuePerArea: file.zoneUnguardedContentValuePerArea,
    // T-508 — per-zone переопределения роста существ случайного найма.
    randomHireEnableWeeklyUnitIncrement: parseBoolListCsv(file.zoneRandomHireEnableWeeklyUnitIncrement),
    randomHireInitialUnitIncrement: parseIntListCsv(file.zoneRandomHireInitialUnitIncrement),
  };
  settings.encounterHoles = {
    enabled: file.encounterHolesEnabled,
    affectedEncounters: file.encounterHolesAffectedEncounters,
    twoHoleEncounters: file.encounterHolesTwoHoleEncounters,
  };
  settings.buildingPresets = {
    playerZonePreset: file.buildingPresetPlayer ?? "",
    neutralZonePreset: file.buildingPresetNeutral ?? "",
  };
  settings.guardProgression = {
    zoneGuardWeeklyIncrement: file.zoneGuardWeeklyIncrement,
    connectionGuardWeeklyIncrement: file.connectionGuardWeeklyIncrement,
  };
  settings.guardReaction = {
    preset: parseGuardReactionPreset(file.guardReactionPreset),
    customDistribution: parseDistributionCsv(file.guardReactionCustomDistribution),
  };
  settings.connectionDefaults = {
    length: file.connectionLength,
    gatePlacement: file.connectionGatePlacement ?? "",
    guardEscape: file.connectionGuardEscape,
    simTurnSquad: file.connectionSimTurnSquad,
    guardRandomization: file.connectionGuardRandomization,
  };
  settings.neutralCities = {
    guardChance: file.neutralCityGuardChance,
    guardValuePercent:
      file.neutralCityGuardValuePercent <= 0 ? 100 : file.neutralCityGuardValuePercent,
    removeGuardIfHasOwner: file.neutralCityRemoveGuardIfHasOwner,
  };
  settings.content = {
    globalBans: file.globalBans ? [...file.globalBans] : [],
    contentCountLimits: (file.contentCountLimits ?? []).map((l) => ({
      sid: l.sid,
      maxPerPlayer: l.maxPerPlayer,
    })),
    valueOverrides: (file.valueOverrides ?? []).map((v) => ({
      sid: v.sid ?? "",
      variant: v.variant,
      guardValue: v.guardValue,
    })),
  };
  settings.bonuses = {
    resources: file.bonusResources ? { ...file.bonusResources } : {},
    heroAttack: file.bonusHeroAttack,
    heroDefense: file.bonusHeroDefense,
    heroSpellpower: file.bonusHeroSpellpower,
    heroKnowledge: file.bonusHeroKnowledge,
    heroStatStartHeroOnly: file.bonusHeroStatStartHeroOnly,
    itemSid: file.bonusItemSid ?? "",
    itemStartHeroOnly: file.bonusItemStartHeroOnly,
    spellSid: file.bonusSpellSid ?? "",
    spellStartHeroOnly: file.bonusSpellStartHeroOnly,
    unitMultiplier: file.bonusUnitMultiplier,
    unitMultiplierStartHeroOnly: file.bonusUnitMultiplierStartHeroOnly,
    perPlayerOverrides: (file.bonusPerPlayerOverrides ?? []).map((o) => ({
      playerSlot: o.playerSlot,
      bonuses: {
        resources: o.resources ? { ...o.resources } : {},
        heroAttack: o.heroAttack,
        heroDefense: o.heroDefense,
        heroSpellpower: o.heroSpellpower,
        heroKnowledge: o.heroKnowledge,
        heroStatStartHeroOnly: o.heroStatStartHeroOnly,
        itemSid: o.itemSid ?? "",
        itemStartHeroOnly: o.itemStartHeroOnly,
        spellSid: o.spellSid ?? "",
        spellStartHeroOnly: o.spellStartHeroOnly,
        unitMultiplier: o.unitMultiplier,
        unitMultiplierStartHeroOnly: o.unitMultiplierStartHeroOnly,
        perPlayerOverrides: [],
      },
    })),
  };
  settings.heroSettings = {
    heroCountMin: file.heroMin,
    heroCountMax: file.heroMax,
    heroCountIncrement: file.heroIncrement,
    heroBans: file.heroBans ? [...file.heroBans] : [],
    bannedSpells: file.bannedSpells ? [...file.bannedSpells] : [],
  };
  settings.topology = migratedTopology;
  settings.randomPortals = file.randomPortals;
  settings.maxPortalConnections = clamp(file.maxPortalConns, 1, 32);
  settings.spawnRemoteFootholds = file.spawnFootholds;
  settings.generateRoads = file.generateRoads;
  settings.noDirectPlayerConnections = file.isolateplayers;
  settings.matchPlayerCastleFactions = file.matchPlayerCastleFactions;
  settings.minNeutralZonesBetweenPlayers = file.minNeutralZonesBetweenPlayers;
  settings.factionLawsExpPercent = clamp(file.factionLawsExp, 25, 200);
  settings.astrologyExpPercent = clamp(file.astrologyExp, 25, 200);
  settings.zoneCfg = {
    neutralZoneCount: file.neutralZoneCount,
    playerZoneCastles: file.playerCastles,
    neutralZoneCastles: file.neutralCastles,
    // Легаси contentDensity сидирует оба split-слайдера (см. effective*Density).
    resourceDensityPercent: effectiveResourceDensity(file),
    structureDensityPercent: effectiveStructureDensity(file),
    neutralStackStrengthPercent: file.neutralStackStrength,
    borderGuardStrengthPercent: file.borderGuardStrength,
    hubZoneSize: clamp(file.hubZoneSize, 0.25, 3.0),
    hubZoneCastles: clamp(file.hubCastles, 0, 4),
    advanced: {
      enabled: advanced,
      neutralLowNoCastleCount: file.neutralLowNoCastle,
      neutralLowCastleCount: file.neutralLowCastle,
      neutralMediumNoCastleCount: file.neutralMediumNoCastle,
      neutralMediumCastleCount: file.neutralMediumCastle,
      neutralHighNoCastleCount: file.neutralHighNoCastle,
      neutralHighCastleCount: file.neutralHighCastle,
      playerZoneSize: clamp(file.playerZoneSize, 0.1, 2.0),
      neutralZoneSize: clamp(file.neutralZoneSize, 0.1, 2.0),
      guardRandomization: file.guardRandomization,
      lowTier: tierFromFile(file.tierLow),
      mediumTier: tierFromFile(file.tierMedium),
      highTier: tierFromFile(file.tierHigh),
    } satisfies AdvancedSettings,
  };
  settings.gameEndConditions = {
    victoryCondition: file.victoryCondition ? file.victoryCondition : "win_condition_1",
    lostStartCity: file.lostStartCity,
    lostStartCityDay: clamp(file.lostStartCityDay, 1, 30),
    lostStartHero: file.lostStartHero,
    cityHold: file.cityHold,
    cityHoldDays: clamp(file.cityHoldDays, 1, 30),
    // T-506 — round-trip переключателя подсветки героев и дня.
    heroLighting: file.heroLighting,
    heroLightingDay: clamp(file.heroLightingDay, 1, 30),
  };
  settings.gladiatorArenaRules = {
    enabled: file.gladiatorArena,
    daysDelayStart: clamp(file.gladiatorArenaDaysDelayStart, 1, 60),
    countDay: clamp(file.gladiatorArenaCountDay, 1, 30),
  };
  settings.tournamentRules = {
    enabled: file.tournament,
    firstTournamentDay: clamp(file.tournamentFirstTournamentDay, 1, 60),
    interval: clamp(file.tournamentInterval, 1, 30),
    pointsToWin: clamp(file.tournamentPointsToWin, 1, 10),
    saveArmy: file.tournamentSaveArmy,
  };

  // Вложенные деревья DTO передаются по ссылке (как в C#): после присвоения
  // владельцем файла. UI должен клонировать перед мутацией, если важно
  // расхождение файл/память.
  settings.playerZoneContent = file.playerZoneContent ?? emptyZoneContentList();
  settings.neutralZoneContent = file.neutralZoneContent ?? emptyNeutralZoneContent();
  settings.forcedContent = (file.forcedContent ?? []).map((f) => ({
    sid: f.sid,
    count: f.count,
    target: f.zoneTarget,
  }));
  settings.zoneRoadDecorations = file.zoneRoadDecorations ?? [];

  const flags: ExperimentalFlags = {
    gameMode: file.expFeatureGameMode,
    startingBonuses: file.expFeatureStartingBonuses,
    zoneContent: file.expFeatureZoneContent,
    bordersRoads: file.expFeatureBordersRoads,
    perTierOverrides: file.expFeaturePerTierOverrides,
  };

  // Миграция T-302: .oetgs до T-302 хранили только master-флаг. Если master
  // включён, но ни один per-feature флаг не выставлен, включаем все пять,
  // чтобы пользователи сохранили доступ к тому, чем уже пользовались.
  if (file.experimentalEnabled && !experimentalAnyEnabled(flags)) {
    flags.gameMode = true;
    flags.startingBonuses = true;
    flags.zoneContent = true;
    flags.bordersRoads = true;
    flags.perTierOverrides = true;
  }

  return { settings, advancedMode: advanced, experimentalMapSizes: needsExperimentalMapSizes, experimental: flags };
}

/** Построить GeneratorSettings из загруженного файла (только настройки). */
export function fromFile(file: SettingsFile): GeneratorSettings {
  return fromFileFull(file).settings;
}

/**
 * Зафиксировать текущее состояние в SettingsFile для JSON-сериализации.
 * Необязательные аргументы соответствуют сигнатуре C# ToFile; по умолчанию
 * advancedMode берётся из settings.zoneCfg.advanced.enabled, а
 * experimentalMapSizes — из фактического размера карты (round-trip через
 * fromFile сохраняется).
 */
export function toFile(
  settings: GeneratorSettings,
  advancedMode?: boolean,
  experimentalMapSizes?: boolean,
  experimental?: ExperimentalFlags | null,
): SettingsFile {
  const flags = experimental ?? emptyExperimentalFlags();
  const resolvedAdvancedMode = advancedMode ?? settings.zoneCfg.advanced.enabled;
  const resolvedExperimentalMapSizes =
    experimentalMapSizes ?? isExperimentalMapSize(settings.mapSize);
  const a = settings.zoneCfg.advanced;

  const file = defaultSettingsFile();

  file.templateName = settings.templateName;
  // T-504 — пользовательские переопределения; "" = автогенерация.
  file.descriptionOverride = settings.description ?? "";
  file.displayWinConditionOverride = settings.displayWinCondition ?? "";
  file.mapSize = settings.mapSize;
  file.playerCount = settings.playerCount;
  file.neutralZoneCount = settings.zoneCfg.neutralZoneCount;
  file.playerCastles = settings.zoneCfg.playerZoneCastles;
  file.neutralCastles = settings.zoneCfg.neutralZoneCastles;
  file.advancedMode = resolvedAdvancedMode;
  file.neutralLowNoCastle = a.neutralLowNoCastleCount;
  file.neutralLowCastle = a.neutralLowCastleCount;
  file.neutralMediumNoCastle = a.neutralMediumNoCastleCount;
  file.neutralMediumCastle = a.neutralMediumCastleCount;
  file.neutralHighNoCastle = a.neutralHighNoCastleCount;
  file.neutralHighCastle = a.neutralHighCastleCount;
  file.matchPlayerCastleFactions = settings.matchPlayerCastleFactions;
  file.minNeutralZonesBetweenPlayers = settings.minNeutralZonesBetweenPlayers;
  // experimentalBalancedZonePlacement: legacy-поле, больше не пишется. Оставлено
  // в SettingsFile только для back-compat чтения; fromFile выполняет миграцию.
  file.experimentalMapSizes = resolvedExperimentalMapSizes;
  file.playerZoneSize = a.playerZoneSize;
  file.neutralZoneSize = a.neutralZoneSize;
  file.hubZoneSize = settings.zoneCfg.hubZoneSize;
  file.hubCastles = settings.zoneCfg.hubZoneCastles;
  file.guardRandomization = a.guardRandomization;
  file.heroMin = settings.heroSettings.heroCountMin;
  file.heroMax = settings.heroSettings.heroCountMax;
  file.heroIncrement = settings.heroSettings.heroCountIncrement;
  file.heroBans = [...settings.heroSettings.heroBans];
  file.bannedSpells = [...settings.heroSettings.bannedSpells];
  file.topology = settings.topology;
  file.randomPortals = settings.randomPortals;
  file.maxPortalConns = settings.maxPortalConnections;
  file.spawnFootholds = settings.spawnRemoteFootholds;
  file.generateRoads = settings.generateRoads;
  file.isolateplayers = settings.noDirectPlayerConnections;
  file.resourceDensity = settings.zoneCfg.resourceDensityPercent;
  file.structureDensity = settings.zoneCfg.structureDensityPercent;
  file.neutralStackStrength = settings.zoneCfg.neutralStackStrengthPercent;
  file.borderGuardStrength = settings.zoneCfg.borderGuardStrengthPercent;
  file.victoryCondition = settings.gameEndConditions.victoryCondition;
  file.factionLawsExp = settings.factionLawsExpPercent;
  file.astrologyExp = settings.astrologyExpPercent;
  file.lostStartCity = settings.gameEndConditions.lostStartCity;
  file.lostStartCityDay = settings.gameEndConditions.lostStartCityDay;
  file.lostStartHero = settings.gameEndConditions.lostStartHero;
  file.cityHold = settings.gameEndConditions.cityHold;
  file.cityHoldDays = settings.gameEndConditions.cityHoldDays;
  // T-506 — персистенция переключателя подсветки героев и дня.
  file.heroLighting = settings.gameEndConditions.heroLighting;
  file.heroLightingDay = settings.gameEndConditions.heroLightingDay;
  file.gladiatorArena = settings.gladiatorArenaRules.enabled;
  file.gladiatorArenaDaysDelayStart = settings.gladiatorArenaRules.daysDelayStart;
  file.gladiatorArenaCountDay = settings.gladiatorArenaRules.countDay;
  file.tournament = settings.tournamentRules.enabled;
  file.tournamentFirstTournamentDay = settings.tournamentRules.firstTournamentDay;
  file.tournamentInterval = settings.tournamentRules.interval;
  file.tournamentPointsToWin = settings.tournamentRules.pointsToWin;
  file.tournamentSaveArmy = settings.tournamentRules.saveArmy;
  // Master-флаг теперь выводится из per-feature флагов, чтобы старые читатели
  // (до T-302) по-прежнему видели экспериментальную навигацию. Per-feature
  // флаги ниже — источник истины.
  file.experimentalEnabled = experimentalAnyEnabled(flags);
  file.expFeatureGameMode = flags.gameMode;
  file.expFeatureStartingBonuses = flags.startingBonuses;
  file.expFeatureZoneContent = flags.zoneContent;
  file.expFeatureBordersRoads = flags.bordersRoads;
  file.expFeaturePerTierOverrides = flags.perTierOverrides;
  file.gameMode = settings.gameMode;
  file.heroHireBan = settings.heroHireBan;
  file.desertionDay = settings.desertionDay;
  file.desertionValue = settings.desertionValue;
  file.terrainObstaclesFill = settings.terrain.obstaclesFill;
  file.terrainLakesFill = settings.terrain.lakesFill;
  file.borderCornerRadius = settings.bordersRoads.cornerRadius;
  file.borderObstaclesWidth = settings.bordersRoads.obstaclesWidth;
  file.waterBorderEnabled = settings.bordersRoads.waterBorderEnabled;
  file.waterWidth = settings.bordersRoads.waterWidth;
  file.roadType = settings.bordersRoads.roadType ?? "";
  file.zoneDiplomacyModifier = settings.zoneOverrides.diplomacyModifier;
  file.zoneCrossroadsPosition = settings.zoneOverrides.crossroadsPosition;
  file.zoneContentBiomeType = settings.zoneOverrides.contentBiomeType ?? "";
  file.zoneContentBiomeArg = settings.zoneOverrides.contentBiomeArg ?? "";
  file.zoneMetaObjectsBiomeType = settings.zoneOverrides.metaObjectsBiomeType ?? "";
  file.zoneMetaObjectsBiomeArg = settings.zoneOverrides.metaObjectsBiomeArg ?? "";
  file.zoneGuardCutoffValue = settings.zoneOverrides.guardCutoffValue;
  file.zoneGuardedContentPool = joinSidCsv(settings.zoneOverrides.guardedContentPool);
  file.zoneUnguardedContentPool = joinSidCsv(settings.zoneOverrides.unguardedContentPool);
  file.zoneContentCountLimits = joinSidCsv(settings.zoneOverrides.contentCountLimitRefs);
  file.zoneGuardMultiplier = settings.zoneOverrides.guardMultiplier;
  file.zoneGuardRandomization = settings.zoneOverrides.guardRandomization;
  // T-503 — per-zone переопределения значений контента/ресурсов.
  file.zoneResourcesValue = settings.zoneOverrides.resourcesValue;
  file.zoneResourcesValuePerArea = settings.zoneOverrides.resourcesValuePerArea;
  file.zoneGuardedContentValue = settings.zoneOverrides.guardedContentValue;
  file.zoneGuardedContentValuePerArea = settings.zoneOverrides.guardedContentValuePerArea;
  file.zoneUnguardedContentValue = settings.zoneOverrides.unguardedContentValue;
  file.zoneUnguardedContentValuePerArea = settings.zoneOverrides.unguardedContentValuePerArea;
  // T-508 — per-zone переопределения роста существ случайного найма.
  file.zoneRandomHireEnableWeeklyUnitIncrement = joinBoolListCsv(
    settings.zoneOverrides.randomHireEnableWeeklyUnitIncrement,
  );
  file.zoneRandomHireInitialUnitIncrement = joinIntListCsv(
    settings.zoneOverrides.randomHireInitialUnitIncrement,
  );
  file.encounterHolesEnabled = settings.encounterHoles.enabled;
  file.encounterHolesAffectedEncounters = settings.encounterHoles.affectedEncounters;
  file.encounterHolesTwoHoleEncounters = settings.encounterHoles.twoHoleEncounters;
  file.buildingPresetPlayer = settings.buildingPresets.playerZonePreset;
  file.buildingPresetNeutral = settings.buildingPresets.neutralZonePreset;
  file.zoneGuardWeeklyIncrement = settings.guardProgression.zoneGuardWeeklyIncrement;
  file.connectionGuardWeeklyIncrement = settings.guardProgression.connectionGuardWeeklyIncrement;
  file.guardReactionPreset =
    settings.guardReaction.preset === "Default" ? "" : settings.guardReaction.preset;
  file.guardReactionCustomDistribution =
    settings.guardReaction.customDistribution.length > 0
      ? settings.guardReaction.customDistribution.join(",")
      : "";
  file.connectionLength = settings.connectionDefaults.length;
  file.connectionGatePlacement = settings.connectionDefaults.gatePlacement ?? "";
  file.connectionGuardEscape = settings.connectionDefaults.guardEscape;
  file.connectionSimTurnSquad = settings.connectionDefaults.simTurnSquad;
  file.connectionGuardRandomization = settings.connectionDefaults.guardRandomization;
  file.neutralCityGuardChance = settings.neutralCities.guardChance;
  file.neutralCityGuardValuePercent = settings.neutralCities.guardValuePercent;
  file.neutralCityRemoveGuardIfHasOwner = settings.neutralCities.removeGuardIfHasOwner;
  file.globalBans = [...settings.content.globalBans];
  file.contentCountLimits = settings.content.contentCountLimits.map((l) => ({
    sid: l.sid,
    maxPerPlayer: l.maxPerPlayer,
  }));
  file.valueOverrides = settings.content.valueOverrides.map((v) => ({
    sid: v.sid,
    variant: v.variant,
    guardValue: v.guardValue,
  }));
  file.bonusResources = { ...settings.bonuses.resources };
  file.bonusHeroAttack = settings.bonuses.heroAttack;
  file.bonusHeroDefense = settings.bonuses.heroDefense;
  file.bonusHeroSpellpower = settings.bonuses.heroSpellpower;
  file.bonusHeroKnowledge = settings.bonuses.heroKnowledge;
  file.bonusHeroStatStartHeroOnly = settings.bonuses.heroStatStartHeroOnly;
  file.bonusItemSid = settings.bonuses.itemSid;
  file.bonusItemStartHeroOnly = settings.bonuses.itemStartHeroOnly;
  file.bonusSpellSid = settings.bonuses.spellSid;
  file.bonusSpellStartHeroOnly = settings.bonuses.spellStartHeroOnly;
  file.bonusUnitMultiplier = settings.bonuses.unitMultiplier;
  file.bonusUnitMultiplierStartHeroOnly = settings.bonuses.unitMultiplierStartHeroOnly;
  file.bonusPerPlayerOverrides = settings.bonuses.perPlayerOverrides.map((o) => ({
    playerSlot: o.playerSlot,
    resources: { ...o.bonuses.resources },
    heroAttack: o.bonuses.heroAttack,
    heroDefense: o.bonuses.heroDefense,
    heroSpellpower: o.bonuses.heroSpellpower,
    heroKnowledge: o.bonuses.heroKnowledge,
    heroStatStartHeroOnly: o.bonuses.heroStatStartHeroOnly,
    itemSid: o.bonuses.itemSid,
    itemStartHeroOnly: o.bonuses.itemStartHeroOnly,
    spellSid: o.bonuses.spellSid,
    spellStartHeroOnly: o.bonuses.spellStartHeroOnly,
    unitMultiplier: o.bonuses.unitMultiplier,
    unitMultiplierStartHeroOnly: o.bonuses.unitMultiplierStartHeroOnly,
  }));
  file.tierLow = tierToFile(a.lowTier);
  file.tierMedium = tierToFile(a.mediumTier);
  file.tierHigh = tierToFile(a.highTier);

  // Вложенные деревья DTO передаются по ссылке (как в C#): после присвоения
  // владельцем внутренней модели. UI должен клонировать перед мутацией.
  file.playerZoneContent = settings.playerZoneContent;
  file.neutralZoneContent = settings.neutralZoneContent;
  file.forcedContent = settings.forcedContent.map((f) => ({
    sid: f.sid,
    count: f.count,
    zoneTarget: f.target,
  }));
  file.zoneRoadDecorations = settings.zoneRoadDecorations;
  return file;
}
