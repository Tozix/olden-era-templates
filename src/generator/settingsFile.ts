import type { MapTopology } from "./enums";
import type {
  NeutralZoneContent,
  ZoneContentList,
  ZoneRoadDecoration,
} from "./settings";

/**
 * Формат файла настроек .oetgs и встроенных пресетов. Имена полей = JSON-имена
 * из C#-модели — НЕ переименовывать, иначе сломается совместимость с файлами
 * существующих пользователей и share-кодами.
 */

export interface ContentLimitFile {
  sid: string;
  maxPerPlayer: number;
}

export interface ValueOverrideFile {
  sid: string;
  variant: number;
  guardValue: number;
}

export interface TierOverrideFile {
  obstaclesFill: number;
  lakesFill: number;
  buildingPreset: string;
  guardWeeklyIncrement: number;
}

export interface PerPlayerBonusFile {
  playerSlot: number;
  resources: Record<string, number>;
  heroAttack: number;
  heroDefense: number;
  heroSpellpower: number;
  heroKnowledge: number;
  heroStatStartHeroOnly: boolean;
  itemSid: string;
  itemStartHeroOnly: boolean;
  spellSid: string;
  spellStartHeroOnly: boolean;
  unitMultiplier: number;
  unitMultiplierStartHeroOnly: boolean;
}

export interface SettingsFile {
  templateName: string;
  descriptionOverride: string;
  displayWinConditionOverride: string;
  seed?: number | null;
  mapSize: number;
  playerCount: number;
  neutralZoneCount: number;
  playerCastles: number;
  neutralCastles: number;
  advancedMode: boolean;
  neutralLowNoCastle: number;
  neutralLowCastle: number;
  neutralMediumNoCastle: number;
  neutralMediumCastle: number;
  neutralHighNoCastle: number;
  neutralHighCastle: number;
  matchPlayerCastleFactions: boolean;
  minNeutralZonesBetweenPlayers: number;
  /** legacy: мигрируется в Topology=Balanced при загрузке */
  experimentalBalancedZonePlacement: boolean;
  experimentalMapSizes: boolean;
  playerZoneSize: number;
  neutralZoneSize: number;
  hubZoneSize: number;
  hubCastles: number;
  guardRandomization: number;
  heroMin: number;
  heroMax: number;
  heroIncrement: number;
  heroBans: string[];
  bannedSpells: string[];
  topology: MapTopology;
  randomPortals: boolean;
  maxPortalConns: number;
  spawnFootholds: boolean;
  generateRoads: boolean;
  isolateplayers: boolean;
  resourceDensity?: number | null;
  structureDensity?: number | null;
  neutralStackStrength: number;
  borderGuardStrength: number;
  victoryCondition: string;
  factionLawsExp: number;
  astrologyExp: number;
  lostStartCity: boolean;
  lostStartCityDay: number;
  lostStartHero: boolean;
  cityHold: boolean;
  cityHoldDays: number;
  heroLighting: boolean;
  heroLightingDay: number;
  gladiatorArena: boolean;
  gladiatorArenaDaysDelayStart: number;
  gladiatorArenaCountDay: number;
  tournament: boolean;
  tournamentFirstTournamentDay: number;
  tournamentInterval: number;
  tournamentPointsToWin: number;
  tournamentSaveArmy: boolean;
  /** legacy master-флаг; на загрузке мигрируется в per-feature флаги */
  experimentalEnabled: boolean;
  expFeatureGameMode: boolean;
  expFeatureStartingBonuses: boolean;
  expFeatureZoneContent: boolean;
  expFeatureBordersRoads: boolean;
  expFeaturePerTierOverrides: boolean;
  gameMode: string;
  heroHireBan: boolean;
  desertionDay: number;
  desertionValue: number;
  terrainObstaclesFill: number;
  terrainLakesFill: number;
  borderCornerRadius?: number | null;
  borderObstaclesWidth?: number | null;
  waterBorderEnabled: boolean;
  waterWidth: number;
  roadType: string;
  zoneDiplomacyModifier?: number | null;
  zoneCrossroadsPosition?: number | null;
  zoneContentBiomeType: string;
  zoneContentBiomeArg: string;
  zoneMetaObjectsBiomeType: string;
  zoneMetaObjectsBiomeArg: string;
  zoneGuardCutoffValue?: number | null;
  /** CSV строка SID'ов */
  zoneGuardedContentPool: string;
  zoneUnguardedContentPool: string;
  zoneContentCountLimits: string;
  zoneGuardMultiplier?: number | null;
  zoneGuardRandomization?: number | null;
  zoneResourcesValue?: number | null;
  zoneResourcesValuePerArea?: number | null;
  zoneGuardedContentValue?: number | null;
  zoneGuardedContentValuePerArea?: number | null;
  zoneUnguardedContentValue?: number | null;
  zoneUnguardedContentValuePerArea?: number | null;
  /** CSV из "true"/"false" */
  zoneRandomHireEnableWeeklyUnitIncrement: string;
  /** CSV из int */
  zoneRandomHireInitialUnitIncrement: string;
  encounterHolesEnabled: boolean;
  encounterHolesAffectedEncounters: number;
  encounterHolesTwoHoleEncounters: number;
  buildingPresetPlayer: string;
  buildingPresetNeutral: string;
  zoneGuardWeeklyIncrement: number;
  connectionGuardWeeklyIncrement: number;
  guardReactionPreset: string;
  /** CSV из шести int */
  guardReactionCustomDistribution: string;
  connectionLength: number;
  connectionGatePlacement: string;
  connectionGuardEscape?: boolean | null;
  connectionSimTurnSquad?: boolean | null;
  connectionGuardRandomization?: number | null;
  neutralCityGuardChance: number;
  neutralCityGuardValuePercent: number;
  neutralCityRemoveGuardIfHasOwner: boolean;
  globalBans: string[];
  contentCountLimits: ContentLimitFile[];
  valueOverrides: ValueOverrideFile[];
  bonusResources: Record<string, number>;
  bonusHeroAttack: number;
  bonusHeroDefense: number;
  bonusHeroSpellpower: number;
  bonusHeroKnowledge: number;
  bonusHeroStatStartHeroOnly: boolean;
  bonusItemSid: string;
  bonusItemStartHeroOnly: boolean;
  bonusSpellSid: string;
  bonusSpellStartHeroOnly: boolean;
  bonusUnitMultiplier: number;
  bonusUnitMultiplierStartHeroOnly: boolean;
  bonusPerPlayerOverrides: PerPlayerBonusFile[];
  tierLow: TierOverrideFile;
  tierMedium: TierOverrideFile;
  tierHigh: TierOverrideFile;
  /** legacy v0.2; при наличии сидирует оба density-слайдера */
  contentDensity?: number | null;
  playerZoneContent: ZoneContentList;
  neutralZoneContent: NeutralZoneContent;
  zoneRoadDecorations: ZoneRoadDecoration[];
}

export function defaultSettingsFile(): SettingsFile {
  return {
    templateName: "Custom Template",
    descriptionOverride: "",
    displayWinConditionOverride: "",
    seed: null,
    mapSize: 160,
    playerCount: 2,
    neutralZoneCount: 0,
    playerCastles: 1,
    neutralCastles: 1,
    advancedMode: false,
    neutralLowNoCastle: 0,
    neutralLowCastle: 0,
    neutralMediumNoCastle: 0,
    neutralMediumCastle: 0,
    neutralHighNoCastle: 0,
    neutralHighCastle: 0,
    matchPlayerCastleFactions: false,
    minNeutralZonesBetweenPlayers: 0,
    experimentalBalancedZonePlacement: false,
    experimentalMapSizes: false,
    playerZoneSize: 1.0,
    neutralZoneSize: 1.0,
    hubZoneSize: 1.0,
    hubCastles: 0,
    guardRandomization: 0.05,
    heroMin: 4,
    heroMax: 8,
    heroIncrement: 1,
    heroBans: [],
    bannedSpells: [],
    topology: "Random",
    randomPortals: false,
    maxPortalConns: 32,
    spawnFootholds: true,
    generateRoads: true,
    isolateplayers: false,
    resourceDensity: null,
    structureDensity: null,
    neutralStackStrength: 100,
    borderGuardStrength: 100,
    victoryCondition: "win_condition_1",
    factionLawsExp: 100,
    astrologyExp: 100,
    lostStartCity: false,
    lostStartCityDay: 3,
    lostStartHero: false,
    cityHold: false,
    cityHoldDays: 6,
    heroLighting: true,
    heroLightingDay: 1,
    gladiatorArena: false,
    gladiatorArenaDaysDelayStart: 30,
    gladiatorArenaCountDay: 3,
    tournament: false,
    tournamentFirstTournamentDay: 14,
    tournamentInterval: 7,
    tournamentPointsToWin: 2,
    tournamentSaveArmy: true,
    experimentalEnabled: false,
    expFeatureGameMode: false,
    expFeatureStartingBonuses: false,
    expFeatureZoneContent: false,
    expFeatureBordersRoads: false,
    expFeaturePerTierOverrides: false,
    gameMode: "Classic",
    heroHireBan: false,
    desertionDay: 0,
    desertionValue: 0,
    terrainObstaclesFill: 0,
    terrainLakesFill: 0,
    borderCornerRadius: null,
    borderObstaclesWidth: null,
    waterBorderEnabled: false,
    waterWidth: 4,
    roadType: "",
    zoneDiplomacyModifier: null,
    zoneCrossroadsPosition: null,
    zoneContentBiomeType: "",
    zoneContentBiomeArg: "",
    zoneMetaObjectsBiomeType: "",
    zoneMetaObjectsBiomeArg: "",
    zoneGuardCutoffValue: null,
    zoneGuardedContentPool: "",
    zoneUnguardedContentPool: "",
    zoneContentCountLimits: "",
    zoneGuardMultiplier: null,
    zoneGuardRandomization: null,
    zoneResourcesValue: null,
    zoneResourcesValuePerArea: null,
    zoneGuardedContentValue: null,
    zoneGuardedContentValuePerArea: null,
    zoneUnguardedContentValue: null,
    zoneUnguardedContentValuePerArea: null,
    zoneRandomHireEnableWeeklyUnitIncrement: "",
    zoneRandomHireInitialUnitIncrement: "",
    encounterHolesEnabled: false,
    encounterHolesAffectedEncounters: 0.66,
    encounterHolesTwoHoleEncounters: 0.66,
    buildingPresetPlayer: "",
    buildingPresetNeutral: "",
    zoneGuardWeeklyIncrement: 0,
    connectionGuardWeeklyIncrement: 0,
    guardReactionPreset: "",
    guardReactionCustomDistribution: "",
    connectionLength: 0,
    connectionGatePlacement: "",
    connectionGuardEscape: null,
    connectionSimTurnSquad: null,
    connectionGuardRandomization: null,
    neutralCityGuardChance: 0,
    neutralCityGuardValuePercent: 100,
    neutralCityRemoveGuardIfHasOwner: false,
    globalBans: [],
    contentCountLimits: [],
    valueOverrides: [],
    bonusResources: {},
    bonusHeroAttack: 0,
    bonusHeroDefense: 0,
    bonusHeroSpellpower: 0,
    bonusHeroKnowledge: 0,
    bonusHeroStatStartHeroOnly: false,
    bonusItemSid: "",
    bonusItemStartHeroOnly: false,
    bonusSpellSid: "",
    bonusSpellStartHeroOnly: false,
    bonusUnitMultiplier: 0,
    bonusUnitMultiplierStartHeroOnly: false,
    bonusPerPlayerOverrides: [],
    tierLow: { obstaclesFill: 0, lakesFill: 0, buildingPreset: "", guardWeeklyIncrement: 0 },
    tierMedium: { obstaclesFill: 0, lakesFill: 0, buildingPreset: "", guardWeeklyIncrement: 0 },
    tierHigh: { obstaclesFill: 0, lakesFill: 0, buildingPreset: "", guardWeeklyIncrement: 0 },
    contentDensity: null,
    playerZoneContent: { items: [] },
    neutralZoneContent: { global: { items: [] }, byTier: {}, byZoneLetter: {} },
    zoneRoadDecorations: [],
  };
}

/** Легаси contentDensity сидирует оба split-слайдера. */
export function effectiveResourceDensity(f: SettingsFile): number {
  return f.resourceDensity ?? f.contentDensity ?? 100;
}

export function effectiveStructureDensity(f: SettingsFile): number {
  return f.structureDensity ?? f.contentDensity ?? 100;
}
