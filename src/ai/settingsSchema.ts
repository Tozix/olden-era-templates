import { defaultSettingsFile } from "../generator/settingsFile";
import { MAP_SIZES, EXPERIMENTAL_MAP_SIZES, ALL_MAP_SIZES } from "../generator/knownValues";

/**
 * Компактный каталог полей SettingsFile для систем-промпта ассистента.
 * Типы выводятся из дефолтов — каталог не может разойтись с реальной моделью.
 */

type FieldInfo = { type: string; range?: string; ru?: string };

const RU: Record<string, string> = {
  templateName: "имя шаблона",
  descriptionOverride: "описание шаблона (пусто = автогенерация)",
  displayWinConditionOverride: "отображаемое условие победы",
  seed: "seed (null = случайный)",
  mapSize: "размер карты",
  playerCount: "количество игроков",
  neutralZoneCount: "доп. нейтральные зоны",
  playerCastles: "замков в зоне игрока",
  neutralCastles: "замков в нейтральной зоне",
  advancedMode: "расширенный режим зон",
  neutralLowNoCastle: "нейтральные: слабые без замка",
  neutralLowCastle: "нейтральные: слабые с замком",
  neutralMediumNoCastle: "нейтральные: средние без замка",
  neutralMediumCastle: "нейтральные: средние с замком",
  neutralHighNoCastle: "нейтральные: богатые без замка",
  neutralHighCastle: "нейтральные: богатые с замком",
  matchPlayerCastleFactions: "одна фракция у всех замков игроков",
  minNeutralZonesBetweenPlayers: "мин. нейтральных зон между игроками",
  experimentalMapSizes: "экспериментальные размеры карты",
  playerZoneSize: "размер зон игроков (×)",
  neutralZoneSize: "размер нейтральных зон (×)",
  hubZoneSize: "размер хаб-зоны (×)",
  hubCastles: "замков в хабе",
  guardRandomization: "случайность силы стражи (0..0.5)",
  heroMin: "мин. героев на игрока",
  heroMax: "макс. героев на игрока",
  heroIncrement: "бонус-герои за доп. замок",
  heroBans: "баны героев (SID вида human_hero_3)",
  bannedSpells: "баны заклинаний (SID вида spell.fly)",
  topology: "топология",
  randomPortals: "всегда ставить порталы",
  maxPortalConns: "макс. портальных связей",
  spawnFootholds: "дальние плацдармы",
  generateRoads: "генерировать дороги",
  isolateplayers: "без прямых связей игроков (только Random)",
  resourceDensity: "плотность ресурсов %",
  structureDensity: "плотность структур %",
  neutralStackStrength: "сила нейтральных стеков %",
  borderGuardStrength: "сила стражи границ/порталов %",
  victoryCondition: "условие победы (win_condition_1/3/4/5/6)",
  factionLawsExp: "опыт законов фракций %",
  astrologyExp: "опыт астрологии %",
  lostStartCity: "поражение: потеря стартового города",
  lostStartCityDay: "день потери города",
  lostStartHero: "поражение: потеря стартового героя",
  cityHold: "победа: удержание города",
  cityHoldDays: "дней удержания города",
  heroLighting: "правило возрождения героя",
  heroLightingDay: "день возрождения героя",
  gladiatorArena: "гладиаторская арена",
  gladiatorArenaDaysDelayStart: "арена: день начала",
  gladiatorArenaCountDay: "арена: кол-во дней раунда",
  tournament: "турнир",
  tournamentFirstTournamentDay: "турнир: первый день боёв",
  tournamentInterval: "турнир: интервал дней",
  tournamentPointsToWin: "турнир: очков для победы",
  tournamentSaveArmy: "турнир: сохранять армию",
  expFeatureGameMode: "фича: режим игры",
  expFeatureStartingBonuses: "фича: стартовые бонусы",
  expFeatureZoneContent: "фича: контент зон",
  expFeatureBordersRoads: "фича: границы и дороги",
  expFeaturePerTierOverrides: "фича: переопределения по уровням",
  gameMode: "режим игры (Classic | SingleHero)",
  heroHireBan: "запрет найма героев",
  desertionDay: "день дезертирства (0 = дефолт)",
  desertionValue: "порог дезертирства (0 = дефолт)",
  terrainObstaclesFill: "препятствия (0..1)",
  terrainLakesFill: "озёра (0..1)",
  borderCornerRadius: "радиус скругления границы (null = авто)",
  borderObstaclesWidth: "ширина препятствий границы (null = авто)",
  waterBorderEnabled: "водная граница",
  waterWidth: "ширина водной границы",
  roadType: "тип дорог ('' = Dirt, Dirt | Stone)",
  zoneGuardCutoffValue: "отсечка стражи зон (null = авто)",
  zoneGuardMultiplier: "множитель стражи зон (null = авто)",
  zoneGuardRandomization: "случайность стражи зон (null = авто)",
  encounterHolesEnabled: "ямы сражений (мультистек)",
  encounterHolesAffectedEncounters: "доля сражений с ямами (0..1)",
  encounterHolesTwoHoleEncounters: "доля двухямных (0..1)",
  buildingPresetPlayer: "пресет зданий игроков (SID или '')",
  buildingPresetNeutral: "пресет зданий нейтральных (SID или '')",
  zoneGuardWeeklyIncrement: "рост стражи зон %/нед (0..1)",
  connectionGuardWeeklyIncrement: "рост стражи связей %/нед (0..1)",
  guardReactionPreset: "кривая стражи ('' | FrontLoaded | Even | BackLoaded | Custom)",
  guardReactionCustomDistribution: "своя кривая: 6 чисел CSV",
  connectionLength: "длина связей % (0..1; 0 = дефолт)",
  connectionGatePlacement: "размещение ворот ('' | Center)",
  connectionGuardEscape: "guardEscape связей (null = авто)",
  connectionSimTurnSquad: "simTurnSquad связей (null = авто)",
  connectionGuardRandomization: "случайность стражи связей (null = авто)",
  neutralCityGuardChance: "шанс стражи нейтр. городов (0..1)",
  neutralCityGuardValuePercent: "сила стражи нейтр. городов %",
  neutralCityRemoveGuardIfHasOwner: "снимать стражу после захвата",
  globalBans: "глобальные баны объектов (SID)",
  contentCountLimits: "лимиты контента [{sid, maxPerPlayer}]",
  valueOverrides: "переопределения стражи [{sid, variant, guardValue}]",
  bonusResources: "бонус-ресурсы {gold,wood,ore,mercury,crystals,gemstones: 0..100}",
  bonusHeroAttack: "бонус: атака героя (0..20)",
  bonusHeroDefense: "бонус: защита героя (0..20)",
  bonusHeroSpellpower: "бонус: сила магии (0..20)",
  bonusHeroKnowledge: "бонус: знание (0..20)",
  bonusHeroStatStartHeroOnly: "бонус-статы только стартовому герою",
  bonusItemSid: "бонус-предмет (SID)",
  bonusItemStartHeroOnly: "предмет только стартовому герою",
  bonusSpellSid: "бонус-заклинание (SID)",
  bonusSpellStartHeroOnly: "заклинание только стартовому герою",
  bonusUnitMultiplier: "множитель юнитов (0..5; 0 = выкл)",
  bonusUnitMultiplierStartHeroOnly: "множитель юнитов только стартовому",
  bonusPerPlayerOverrides: "бонусы по слотам [{playerSlot, ...бонус-поля}]",
  tierLow: "переопределения бедных зон {obstaclesFill, lakesFill, buildingPreset, guardWeeklyIncrement}",
  tierMedium: "то же для обычных зон",
  tierHigh: "то же для богатых зон",
  playerZoneContent: "контент зон игроков (сложное дерево, не меняй без запроса)",
  neutralZoneContent: "контент нейтральных зон (сложное дерево)",
  zoneRoadDecorations: "дорожные декорации (сложный массив)",
};

const RANGES: Record<string, string> = {
  playerCount: "2..8",
  mapSize: `один из ${MAP_SIZES.join("/")}${EXPERIMENTAL_MAP_SIZES.length > 0 ? ` (+экспер. ${EXPERIMENTAL_MAP_SIZES[0]}..${EXPERIMENTAL_MAP_SIZES[EXPERIMENTAL_MAP_SIZES.length - 1]})` : ""}`,
  mapSizeAll: ALL_MAP_SIZES.join("/"),
  neutralZoneCount: "0..30",
  playerCastles: "1..4",
  neutralCastles: "0..4",
  heroMin: "1..12",
  heroMax: "1..12",
  heroIncrement: "0..10",
  maxPortalConns: "1..32",
  resourceDensity: "20..400",
  structureDensity: "20..200",
  neutralStackStrength: "25..300",
  borderGuardStrength: "25..300",
  factionLawsExp: "25..200",
  astrologyExp: "25..200",
  lostStartCityDay: "1..30",
  cityHoldDays: "1..30",
  heroLightingDay: "1..30",
  minNeutralZonesBetweenPlayers: "0..8",
  hubCastles: "0..4",
  neutralLowNoCastle: "0..30",
  neutralLowCastle: "0..30",
  neutralMediumNoCastle: "0..30",
  neutralMediumCastle: "0..30",
  neutralHighNoCastle: "0..30",
  neutralHighCastle: "0..30",
};

function typeOf(v: unknown): string {
  if (typeof v === "string") return "string";
  if (typeof v === "number") return "int";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) {
    if (v.length === 0) return "array";
    return `array<${typeOf(v[0])}>`;
  }
  if (v === null) return "null";
  return "object";
}

/** Каталог полей: key → человекочитаемое описание типа/диапазона/смысла. */
export function settingsFieldCatalog(): Record<string, FieldInfo> {
  const defaults = defaultSettingsFile() as unknown as Record<string, unknown>;
  const out: Record<string, FieldInfo> = {};
  for (const [key, value] of Object.entries(defaults)) {
    const info: FieldInfo = { type: typeOf(value) };
    const range = RANGES[key];
    if (range) info.range = range;
    const ru = RU[key];
    if (ru) info.ru = ru;
    if (key === "topology") {
      info.range = "Default | HubAndSpoke | Chain | SharedWeb | Random | Balanced";
      info.ru = RU.topology;
    }
    if (key === "gameMode") info.range = "Classic | SingleHero";
    if (key === "seed") info.type = "int | null";
    if (key === "victoryCondition") info.range = "win_condition_1 | win_condition_3 | win_condition_4 | win_condition_5 | win_condition_6";
    out[key] = info;
  }
  return out;
}

/** JSON-строка каталога для вставки в систем-промпт. */
export function settingsCatalogJson(): string {
  return JSON.stringify(settingsFieldCatalog());
}
