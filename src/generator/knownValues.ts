/** Известные строковые константы из эталонных шаблонов игры — выпадающие списки и валидация. */

export const GAME_MODES = ["Classic", "SingleHero"] as const;

export const MAP_SIZES = [64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 240];

export const EXPERIMENTAL_MAP_SIZES = [
  256, 272, 288, 304, 320, 336, 352, 368, 384, 400, 416, 432, 448, 464, 480, 496, 512,
];

export const ALL_MAP_SIZES = [...MAP_SIZES, ...EXPERIMENTAL_MAP_SIZES];

export const MAX_OFFICIAL_MAP_SIZE = MAP_SIZES[MAP_SIZES.length - 1];

export function isExperimentalMapSize(size: number): boolean {
  return EXPERIMENTAL_MAP_SIZES.includes(size);
}

export function mapSizeLabel(size: number): string {
  if (size === 64) return "S";
  if (size === 80 || size === 96) return "M";
  if (size === 112 || size === 128) return "L";
  if (size === 144 || size === 160) return "XL";
  if (size === 176 || size === 192) return "H";
  if (size >= 208 && size <= 256) return "G";
  return "C";
}

/** Человекочитаемые подписи displayWinCondition; выровнено с VICTORY_CONDITION_IDS. */
// TODO: verify wording against in-game Russian localization
export const VICTORY_CONDITION_LABELS_RU = [
  "Стандартная",
  "Потеря стартового города",
  "Гладиаторская арена",
  "Удержание города",
  "Турнир",
];

export const VICTORY_CONDITION_IDS = [
  "win_condition_1",
  "win_condition_3",
  "win_condition_4",
  "win_condition_5",
  "win_condition_6",
];

export const BONUS_RECEIVER_FILTERS = ["all_heroes", "start_hero"];

export const BONUS_SIDS = [
  "add_bonus_hero_item",
  "add_bonus_hero_spell",
  "add_bonus_hero_stat",
  "add_bonus_hero_unit_multipler",
  "add_bonus_res",
];

export const CHAMPION_SELECT_RULES = ["StartHero"];

export const ORIENTATION_MODES = ["BoundingCircle", "MinimalBoundingSquare"];

export const WATER_TYPES = ["water grass"];

export const ZONE_LAYOUTS = [
  "zone_layout_ai_spawn",
  "zone_layout_back",
  "zone_layout_center",
  "zone_layout_center_zone",
  "zone_layout_leaf",
  "zone_layout_player_spawn",
  "zone_layout_second_spawn",
  "zone_layout_side_spawn_zone",
  "zone_layout_side_zone",
  "zone_layout_sides",
  "zone_layout_spawn",
  "zone_layout_spawns",
  "zone_layout_start_zone",
  "zone_layout_supertreasure_zone",
  "zone_layout_treasure",
  "zone_layout_treasure_zone",
  "zone_layout_treasures",
  "zone_layout_wincondition_zone",
];

export const MAIN_OBJECT_TYPES = ["AbandonedOutpost", "City", "GladiatorArena", "Spawn"];

export const SPAWN_PLAYERS = [
  "Player1",
  "Player2",
  "Player3",
  "Player4",
  "Player5",
  "Player6",
  "Player7",
  "Player8",
];

export const MAIN_OBJECT_PLACEMENTS = ["Center", "Connection", "NearZone", "Uniform"];

export const BUILDINGS_CONSTRUCTION_SIDS = [
  "arcade_buildings_construction",
  "army_buildings_construction",
  "chosen_one_buildings_construction",
  "chosen_one_buildings_construction_up_1",
  "chosen_one_buildings_construction_up_2",
  "chosen_one_buildings_construction_up_3",
  "default_buildings_construction",
  "extra_poor_buildings_construction",
  "extra_rich_buildings_construction",
  "full_buildings_construction",
  "massacre_buildings_construction",
  "massacre_buildings_construction_up_1",
  "massacre_buildings_construction_up_2",
  "massacre_buildings_construction_up_3",
  "medium_buildings_construction",
  "poor_buildings_construction",
  "rich_buildings_construction",
  "siege_buildings_construction",
  "ultra_rich_buildings_construction",
];

export const SELECTOR_TYPES = ["FromList", "Match", "MatchMainObject", "MatchZone"];

export const ROAD_TYPES = ["Dirt", "Stone"];

export const ROAD_ENDPOINT_TYPES = ["Connection", "MainObject", "MandatoryContent"];

export const CONNECTION_TYPES = ["Default", "Direct", "GladiatorArena", "Portal", "Proximity"];

export const GATE_PLACEMENTS = ["Center"];

/** Коды ресурсов для стартовых бонусов. */
export const RESOURCE_CODES = ["gold", "wood", "ore", "mercury", "crystals", "gemstones"];

/** Школы магии (RU): порядок Day → Night → Arcane → Primal. */
// TODO: verify wording against in-game Russian localization
export const SPELL_SCHOOLS_RU: Record<string, string> = {
  Day: "День",
  Night: "Ночь",
  Arcane: "Тайная",
  Primal: "Изначальная",
};

export const SPELL_SCHOOL_ORDER = ["Day", "Night", "Arcane", "Primal"];
