import type {
  GuardReactionPreset,
  MapTopology,
  NeutralZoneTier,
  RoadDistance,
  ZoneContentPool,
  ZoneRoadEndpointKind,
  ZoneRoadType,
} from "./enums";

// ── Zone content (настройки контента зон) ───────────────────────────────────

export interface ZoneContentRule {
  type?: string | null; // "MainObject" | "Road" | "Crossroads" | "Border" | …; пустое → строка отбрасывается
  args: string[];
  targetMin?: number | null;
  targetMax?: number | null;
  weight?: number | null;
}

export interface ZoneContentItem {
  sid: string;
  handle?: string | null;
  isGroup: boolean;
  minCount: number;
  maxCount: number;
  pool: ZoneContentPool;
  isGuarded: boolean;
  nearCastle: boolean;
  roadDistance?: RoadDistance | null;
  factionAffinity: string[];
  biomeFilter: string[];
  includeListIds: string[];
  rules: ZoneContentRule[];
}

export interface ZoneContentList {
  items: ZoneContentItem[];
}

export type NeutralZoneContentByTier = Partial<Record<NeutralZoneTier, ZoneContentList>>;

export interface NeutralZoneContent {
  global: ZoneContentList;
  byTier: NeutralZoneContentByTier;
  byZoneLetter: Record<string, ZoneContentList>;
}

export interface ZoneRoadEndpoint {
  kind: ZoneRoadEndpointKind;
  arg: string;
}

export interface ZoneRoadDecoration {
  zone: string;
  roadType: ZoneRoadType;
  from: ZoneRoadEndpoint;
  to: ZoneRoadEndpoint;
}

export const emptyZoneContentList = (): ZoneContentList => ({ items: [] });

export const emptyNeutralZoneContent = (): NeutralZoneContent => ({
  global: emptyZoneContentList(),
  byTier: {},
  byZoneLetter: {},
});

export const emptyZoneRoadDecoration = (): ZoneRoadDecoration => ({
  zone: "",
  roadType: "Stone",
  from: { kind: "Connection", arg: "" },
  to: { kind: "Connection", arg: "" },
});

// ── Вложенные группы настроек ───────────────────────────────────────────────

export interface TournamentRules {
  enabled: boolean;
  firstTournamentDay: number;
  interval: number;
  pointsToWin: number;
  saveArmy: boolean;
}

export interface GladiatorArenaRules {
  enabled: boolean;
  daysDelayStart: number;
  countDay: number;
}

export interface GameEndConditions {
  victoryCondition: string;
  lostStartCity: boolean;
  lostStartCityDay: number;
  lostStartHero: boolean;
  cityHold: boolean;
  cityHoldDays: number;
  heroLighting: boolean;
  heroLightingDay: number;
}

export interface HeroSettings {
  heroCountMin: number;
  heroCountMax: number;
  heroCountIncrement: number;
  heroBans: string[];
  bannedSpells: string[];
}

export interface TierOverrides {
  obstaclesFill: number;
  lakesFill: number;
  buildingPreset: string;
  guardWeeklyIncrement: number;
}

export interface AdvancedSettings {
  enabled: boolean;
  neutralLowNoCastleCount: number;
  neutralLowCastleCount: number;
  neutralMediumNoCastleCount: number;
  neutralMediumCastleCount: number;
  neutralHighNoCastleCount: number;
  neutralHighCastleCount: number;
  playerZoneSize: number;
  neutralZoneSize: number;
  guardRandomization: number;
  lowTier: TierOverrides;
  mediumTier: TierOverrides;
  highTier: TierOverrides;
}

export interface ZoneConfiguration {
  neutralZoneCount: number;
  playerZoneCastles: number;
  neutralZoneCastles: number;
  resourceDensityPercent: number;
  structureDensityPercent: number;
  neutralStackStrengthPercent: number;
  borderGuardStrengthPercent: number;
  hubZoneSize: number;
  hubZoneCastles: number;
  advanced: AdvancedSettings;
}

export interface TerrainSettings {
  obstaclesFill: number;
  lakesFill: number;
}

export interface BuildingPresetSettings {
  playerZonePreset: string;
  neutralZonePreset: string;
}

export interface GuardProgressionSettings {
  zoneGuardWeeklyIncrement: number;
  connectionGuardWeeklyIncrement: number;
}

export interface GuardReactionSettings {
  preset: GuardReactionPreset;
  customDistribution: number[];
}

export interface NeutralCitySettings {
  guardChance: number;
  guardValuePercent: number;
  removeGuardIfHasOwner: boolean;
}

export interface ContentLimit {
  sid: string;
  maxPerPlayer: number;
}

export interface ValueOverrideSetting {
  sid: string;
  /** -1 = любой вариант. */
  variant: number;
  /** 0 = не задано (строка не эмитится). */
  guardValue: number;
}

export interface ContentControlSettings {
  globalBans: string[];
  contentCountLimits: ContentLimit[];
  valueOverrides: ValueOverrideSetting[];
}

export interface StartingBonusSettings {
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
  perPlayerOverrides: PerPlayerBonusOverride[];
}

export interface PerPlayerBonusOverride {
  /** Слот 1..PlayerCount; вне диапазона — пропускается при эмите. */
  playerSlot: number;
  bonuses: StartingBonusSettings;
}

export interface ConnectionDefaultsSettings {
  length: number;
  gatePlacement: string;
  guardEscape?: boolean | null;
  simTurnSquad?: boolean | null;
  guardRandomization?: number | null;
}

export interface ZoneOverridesSettings {
  diplomacyModifier?: number | null;
  crossroadsPosition?: number | null;
  contentBiomeType: string;
  contentBiomeArg: string;
  metaObjectsBiomeType: string;
  metaObjectsBiomeArg: string;
  guardCutoffValue?: number | null;
  guardedContentPool: string[];
  unguardedContentPool: string[];
  contentCountLimitRefs: string[];
  guardMultiplier?: number | null;
  guardRandomization?: number | null;
  resourcesValue?: number | null;
  resourcesValuePerArea?: number | null;
  guardedContentValue?: number | null;
  guardedContentValuePerArea?: number | null;
  unguardedContentValue?: number | null;
  unguardedContentValuePerArea?: number | null;
  randomHireEnableWeeklyUnitIncrement: boolean[];
  randomHireInitialUnitIncrement: number[];
}

export interface EncounterHolesOptions {
  enabled: boolean;
  affectedEncounters: number;
  twoHoleEncounters: number;
}

// ── Гарантированный контент («тонкие настройки») ────────────────────────────

export type ForcedContentTarget = "player" | "neutral";

export interface ForcedObjectSetting {
  /** SID объекта из каталога (например, dragon_utopia). */
  sid: string;
  /** Сколько копий разместить на всю карту. */
  count: number;
  /** Куда класть: в зоны игроков или нейтральные зоны (распределение по кругу). */
  target: ForcedContentTarget;
}

export interface BordersRoadsSettings {
  cornerRadius?: number | null;
  obstaclesWidth?: number | null;
  waterBorderEnabled: boolean;
  waterWidth: number;
  roadType?: string | null;
}

// ── Корневое дерево настроек (аналог GeneratorSettings) ─────────────────────

export interface GeneratorSettings {
  templateName: string;
  gameMode: string;
  playerCount: number;
  mapSize: number;
  description: string;
  displayWinCondition: string;
  seed?: number | null;
  heroSettings: HeroSettings;
  noDirectPlayerConnections: boolean;
  randomPortals: boolean;
  maxPortalConnections: number;
  spawnRemoteFootholds: boolean;
  generateRoads: boolean;
  matchPlayerCastleFactions: boolean;
  minNeutralZonesBetweenPlayers: number;
  topology: MapTopology;
  zoneCfg: ZoneConfiguration;
  factionLawsExpPercent: number;
  astrologyExpPercent: number;
  gameEndConditions: GameEndConditions;
  gladiatorArenaRules: GladiatorArenaRules;
  tournamentRules: TournamentRules;
  heroHireBan: boolean;
  desertionDay: number;
  desertionValue: number;
  terrain: TerrainSettings;
  buildingPresets: BuildingPresetSettings;
  guardProgression: GuardProgressionSettings;
  guardReaction: GuardReactionSettings;
  neutralCities: NeutralCitySettings;
  content: ContentControlSettings;
  bonuses: StartingBonusSettings;
  bordersRoads: BordersRoadsSettings;
  connectionDefaults: ConnectionDefaultsSettings;
  zoneOverrides: ZoneOverridesSettings;
  encounterHoles: EncounterHolesOptions;
  forcedContent: ForcedObjectSetting[];
  playerZoneContent: ZoneContentList;
  neutralZoneContent: NeutralZoneContent;
  zoneRoadDecorations: ZoneRoadDecoration[];
}

const defaultTierOverrides = (): TierOverrides => ({
  obstaclesFill: 0,
  lakesFill: 0,
  buildingPreset: "",
  guardWeeklyIncrement: 0,
});

const defaultAdvanced = (): AdvancedSettings => ({
  enabled: false,
  neutralLowNoCastleCount: 0,
  neutralLowCastleCount: 0,
  neutralMediumNoCastleCount: 0,
  neutralMediumCastleCount: 0,
  neutralHighNoCastleCount: 0,
  neutralHighCastleCount: 0,
  playerZoneSize: 1.0,
  neutralZoneSize: 1.0,
  guardRandomization: 0.05,
  lowTier: defaultTierOverrides(),
  mediumTier: defaultTierOverrides(),
  highTier: defaultTierOverrides(),
});

const defaultStartingBonuses = (): StartingBonusSettings => ({
  resources: {},
  heroAttack: 0,
  heroDefense: 0,
  heroSpellpower: 0,
  heroKnowledge: 0,
  heroStatStartHeroOnly: false,
  itemSid: "",
  itemStartHeroOnly: false,
  spellSid: "",
  spellStartHeroOnly: false,
  unitMultiplier: 0,
  unitMultiplierStartHeroOnly: false,
  perPlayerOverrides: [],
});

export function defaultGeneratorSettings(): GeneratorSettings {
  return {
    templateName: "Custom Template",
    gameMode: "Classic",
    playerCount: 2,
    mapSize: 160,
    description: "",
    displayWinCondition: "",
    seed: null,
    heroSettings: {
      heroCountMin: 4,
      heroCountMax: 8,
      heroCountIncrement: 1,
      heroBans: [],
      bannedSpells: [],
    },
    noDirectPlayerConnections: false,
    randomPortals: false,
    maxPortalConnections: 32,
    spawnRemoteFootholds: true,
    generateRoads: true,
    matchPlayerCastleFactions: false,
    minNeutralZonesBetweenPlayers: 0,
    topology: "Random",
    zoneCfg: {
      neutralZoneCount: 0,
      playerZoneCastles: 1,
      neutralZoneCastles: 1,
      resourceDensityPercent: 100,
      structureDensityPercent: 100,
      neutralStackStrengthPercent: 100,
      borderGuardStrengthPercent: 100,
      hubZoneSize: 1.0,
      hubZoneCastles: 0,
      advanced: defaultAdvanced(),
    },
    factionLawsExpPercent: 100,
    astrologyExpPercent: 100,
    gameEndConditions: {
      victoryCondition: "win_condition_1",
      lostStartCity: false,
      lostStartCityDay: 3,
      lostStartHero: false,
      cityHold: false,
      cityHoldDays: 6,
      heroLighting: true,
      heroLightingDay: 1,
    },
    gladiatorArenaRules: {
      enabled: false,
      daysDelayStart: 30,
      countDay: 3,
    },
    tournamentRules: {
      enabled: false,
      firstTournamentDay: 14,
      interval: 7,
      pointsToWin: 2,
      saveArmy: true,
    },
    heroHireBan: false,
    desertionDay: 0,
    desertionValue: 0,
    terrain: { obstaclesFill: 0, lakesFill: 0 },
    buildingPresets: { playerZonePreset: "", neutralZonePreset: "" },
    guardProgression: { zoneGuardWeeklyIncrement: 0, connectionGuardWeeklyIncrement: 0 },
    guardReaction: { preset: "Default", customDistribution: [] },
    neutralCities: { guardChance: 0, guardValuePercent: 100, removeGuardIfHasOwner: false },
    content: { globalBans: [], contentCountLimits: [], valueOverrides: [] },
    bonuses: defaultStartingBonuses(),
    bordersRoads: {
      cornerRadius: null,
      obstaclesWidth: null,
      waterBorderEnabled: false,
      waterWidth: 4,
      roadType: null,
    },
    connectionDefaults: {
      length: 0,
      gatePlacement: "",
      guardEscape: null,
      simTurnSquad: null,
      guardRandomization: null,
    },
    zoneOverrides: {
      diplomacyModifier: null,
      crossroadsPosition: null,
      contentBiomeType: "",
      contentBiomeArg: "",
      metaObjectsBiomeType: "",
      metaObjectsBiomeArg: "",
      guardCutoffValue: null,
      guardedContentPool: [],
      unguardedContentPool: [],
      contentCountLimitRefs: [],
      guardMultiplier: null,
      guardRandomization: null,
      resourcesValue: null,
      resourcesValuePerArea: null,
      guardedContentValue: null,
      guardedContentValuePerArea: null,
      unguardedContentValue: null,
      unguardedContentValuePerArea: null,
      randomHireEnableWeeklyUnitIncrement: [],
      randomHireInitialUnitIncrement: [],
    },
    encounterHoles: { enabled: false, affectedEncounters: 0.66, twoHoleEncounters: 0.66 },
    forcedContent: [],
    playerZoneContent: emptyZoneContentList(),
    neutralZoneContent: emptyNeutralZoneContent(),
    zoneRoadDecorations: [],
  };
}
