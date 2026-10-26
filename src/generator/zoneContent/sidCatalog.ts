/**
 * Порт ZoneContentSidCatalog: курируемый каталог SID'ов контента зон для
 * пикер-UI (WPF + Web). Каждая запись = SID (значение row.Sid контент-строки
 * либо name_*-якорь mandatory content) + дружественное имя + категория.
 * Данные портированы 1:1 из C#-сидa; порядок записей значим.
 */

export interface ZoneContentSidEntry {
  sid: string;
  friendlyName: string;
  category: string;
}

// Категории. Константы стабильны — они косвенно сохраняются в .oetgs
// через порядок группировки пикера.
export const SidCatalogCategories = {
  Mandatory: "Mandatory",
  Mines: "Mines",
  Dwellings: "Creature dwellings",
  Learning: "Learning structures",
  Artifacts: "Artifact spots",
  Banks: "Banks & utopias",
  Pandora: "Pandora & encounters",
  Shrines: "Shrines & conflux",
  Bonus: "Bonus structures",
  Hire: "Hire & recruitment",
  Structures: "Structures",
  Portals: "Portals",
  Footholds: "Footholds",
  Misc: "Misc",
} as const;

/** Упорядоченный список категорий для группировки в хостах. Новые — добавлять сюда. */
export const SID_CATALOG_ORDERED_CATEGORIES: string[] = [
  SidCatalogCategories.Mandatory,
  SidCatalogCategories.Mines,
  SidCatalogCategories.Dwellings,
  SidCatalogCategories.Learning,
  SidCatalogCategories.Artifacts,
  SidCatalogCategories.Banks,
  SidCatalogCategories.Pandora,
  SidCatalogCategories.Shrines,
  SidCatalogCategories.Bonus,
  SidCatalogCategories.Hire,
  SidCatalogCategories.Structures,
  SidCatalogCategories.Portals,
  SidCatalogCategories.Footholds,
  SidCatalogCategories.Misc,
];

// Пары (суффикс ресурса, дружественное имя шахты) — источник как raw
// `mine_<resource>` SID'ов, так и `name_mine_<resource>` якорей.
// Порядок значим — сохраняется при перечислении каталога.
const MINE_RESOURCES: ReadonlyArray<readonly [string, string]> = [
  ["gold", "Gold Mine"],
  ["wood", "Sawmill"],
  ["ore", "Ore Pit"],
  ["crystals", "Crystal Cavern"],
  ["gemstones", "Gem Mine"],
  ["mercury", "Mercury Lab"],
];

const entry = (sid: string, friendlyName: string, category: string): ZoneContentSidEntry => ({
  sid,
  friendlyName,
  category,
});

function buildSeed(): ZoneContentSidEntry[] {
  const seed: ZoneContentSidEntry[] = [];

  // ---- Mandatory anchors (name_* — на них ссылаются строки mandatory_content) ----
  seed.push(entry("name_mana_well", "Mana Well (anchor)", SidCatalogCategories.Mandatory));
  seed.push(entry("name_pandora_box_army", "Pandora's Box - Army (anchor)", SidCatalogCategories.Mandatory));
  seed.push(entry("name_pandora_box_resources", "Pandora's Box - Resources (anchor)", SidCatalogCategories.Mandatory));
  seed.push(entry("name_pandora_box_xp", "Pandora's Box - XP (anchor)", SidCatalogCategories.Mandatory));
  seed.push(entry("name_alchemy_lab", "Alchemy Lab (anchor)", SidCatalogCategories.Mandatory));
  seed.push(entry("name_town_gate", "Town Gate (anchor)", SidCatalogCategories.Mandatory));

  // ---- Mines (name_* якоря) ----
  // У золота базовый якорь плюс 4 нумерованных дубликата (шаблоны с
  // несколькими золотыми шахтами на фиксированных позициях).
  seed.push(entry("name_mine_gold", "Gold Mine (anchor)", SidCatalogCategories.Mines));
  for (let n = 1; n <= 4; n++) seed.push(entry(`name_mine_gold_${n}`, `Gold Mine #${n} (anchor)`, SidCatalogCategories.Mines));

  // Одиночные якоря для остальных ресурсов.
  for (const [resource, friendly] of MINE_RESOURCES.slice(1)) {
    seed.push(entry(`name_mine_${resource}`, `${friendly} (anchor)`, SidCatalogCategories.Mines));
  }

  // Биомовая шахта: базовый якорь плюс 3 нумерованных дубликата.
  seed.push(entry("name_mine_by_biome", "Biome-Themed Mine (anchor)", SidCatalogCategories.Mines));
  for (let n = 1; n <= 3; n++) seed.push(entry(`name_mine_by_biome_${n}`, `Biome Mine #${n} (anchor)`, SidCatalogCategories.Mines));

  // ---- Mines (raw object SIDs — ставятся напрямую через row.Sid) ----
  for (const [resource, friendly] of MINE_RESOURCES) {
    seed.push(entry(`mine_${resource}`, friendly, SidCatalogCategories.Mines));
  }

  // ---- Learning structures (тренеры скиллов / спеллов / статов) ----
  seed.push(entry("university", "University", SidCatalogCategories.Learning));
  seed.push(entry("college_of_wonder", "College of Wonder", SidCatalogCategories.Learning));
  seed.push(entry("pile_of_books", "Pile of Books", SidCatalogCategories.Learning));
  seed.push(entry("wise_owl", "Wise Owl", SidCatalogCategories.Learning));
  seed.push(entry("research_laboratory", "Research Laboratory", SidCatalogCategories.Learning));
  seed.push(entry("chimerologist", "Chimerologist", SidCatalogCategories.Learning));
  seed.push(entry("mystical_tower", "Mystical Tower", SidCatalogCategories.Learning));
  seed.push(entry("orb_observatory", "Orb Observatory", SidCatalogCategories.Learning));
  seed.push(entry("petrified_memorial", "Petrified Memorial", SidCatalogCategories.Learning));

  // ---- Artifact spots (случайные тиры + спец-свитки) ----
  seed.push(entry("random_item_common", "Random Artifact - Common", SidCatalogCategories.Artifacts));
  seed.push(entry("random_item_rare", "Random Artifact - Rare", SidCatalogCategories.Artifacts));
  seed.push(entry("random_item_epic", "Random Artifact - Epic", SidCatalogCategories.Artifacts));
  seed.push(entry("random_item_legendary", "Random Artifact - Legendary", SidCatalogCategories.Artifacts));
  seed.push(entry("mythic_scroll_box", "Mythic Scroll Box", SidCatalogCategories.Artifacts));

  // ---- Banks & utopias (creature banks / тайники) ----
  seed.push(entry("dragon_utopia", "Dragon Utopia", SidCatalogCategories.Banks));
  seed.push(entry("eternal_dragon", "Eternal Dragon", SidCatalogCategories.Banks));
  seed.push(entry("monty_hall", "Monty Hall", SidCatalogCategories.Banks));
  seed.push(entry("the_gorge", "The Gorge", SidCatalogCategories.Banks));
  seed.push(entry("crystal_trail", "Crystal Trail", SidCatalogCategories.Banks));
  seed.push(entry("infernal_cirque", "Infernal Cirque", SidCatalogCategories.Banks));
  seed.push(entry("twilight_bloom", "Twilight Bloom", SidCatalogCategories.Banks));
  seed.push(entry("boreal_call", "Boreal Call", SidCatalogCategories.Banks));
  seed.push(entry("insaras_eye", "Insara's Eye", SidCatalogCategories.Banks));
  seed.push(entry("quixs_path", "Quix's Path", SidCatalogCategories.Banks));
  seed.push(entry("unstable_ruins", "Unstable Ruins", SidCatalogCategories.Banks));
  seed.push(entry("troglodyte_throne", "Troglodyte Throne", SidCatalogCategories.Banks));

  // ---- Pandora & encounters ----
  seed.push(entry("pandora_box", "Pandora's Box", SidCatalogCategories.Pandora));
  seed.push(entry("prison", "Prison", SidCatalogCategories.Pandora));
  seed.push(entry("mysterious_stone", "Mysterious Stone", SidCatalogCategories.Pandora));
  seed.push(entry("unforgotten_grave", "Unforgotten Grave", SidCatalogCategories.Pandora));

  // ---- Shrines & conflux (alignment / faction / mana) ----
  seed.push(entry("sacrificial_shrine", "Sacrificial Shrine", SidCatalogCategories.Shrines));
  seed.push(entry("fickle_shrine", "Fickle Shrine", SidCatalogCategories.Shrines));
  seed.push(entry("ritual_pyre", "Ritual Pyre", SidCatalogCategories.Shrines));
  seed.push(entry("celestial_sphere", "Celestial Sphere", SidCatalogCategories.Shrines));
  seed.push(entry("point_of_balance", "Point of Balance", SidCatalogCategories.Shrines));
  seed.push(entry("tear_of_truth", "Tear of Truth", SidCatalogCategories.Shrines));
  seed.push(entry("flattering_mirror", "Flattering Mirror", SidCatalogCategories.Shrines));
  seed.push(entry("tree_of_abundance", "Tree of Abundance", SidCatalogCategories.Shrines));
  seed.push(entry("mana_well", "Mana Well", SidCatalogCategories.Shrines));

  // ---- Bonus structures (статы / мораль / удача / движение) ----
  seed.push(entry("arena", "Arena", SidCatalogCategories.Bonus));
  seed.push(entry("fountain", "Fountain of Fortune", SidCatalogCategories.Bonus));
  seed.push(entry("fountain_2", "Fountain (Variant)", SidCatalogCategories.Bonus));
  seed.push(entry("beer_fountain", "Beer Fountain", SidCatalogCategories.Bonus));
  seed.push(entry("circus", "Circus", SidCatalogCategories.Bonus));
  seed.push(entry("mirage", "Mirage", SidCatalogCategories.Bonus));
  seed.push(entry("watchtower", "Watchtower", SidCatalogCategories.Bonus));
  seed.push(entry("wind_rose", "Wind Rose", SidCatalogCategories.Bonus));
  seed.push(entry("stables", "Stables", SidCatalogCategories.Bonus));
  seed.push(entry("jousting_range", "Jousting Range", SidCatalogCategories.Bonus));
  seed.push(entry("huntsmans_camp", "Huntsman's Camp", SidCatalogCategories.Bonus));

  // ---- Hire & recruitment (пополнение армии / найм героев) ----
  seed.push(entry("tavern", "Tavern", SidCatalogCategories.Hire));
  seed.push(entry("shady_den", "Shady Den", SidCatalogCategories.Hire));
  // random_hire_1..7 — по слоту на тир существ.
  for (let tier = 1; tier <= 7; tier++) {
    seed.push(entry(`random_hire_${tier}`, `Random Hire (Tier ${tier})`, SidCatalogCategories.Hire));
  }

  // ---- Structures (утилитарные постройки на карте) ----
  seed.push(entry("alchemy_lab", "Alchemy Lab", SidCatalogCategories.Structures));
  seed.push(entry("town_gate", "Town Gate", SidCatalogCategories.Structures));
  seed.push(entry("market", "Market", SidCatalogCategories.Structures));
  seed.push(entry("forge", "Forge", SidCatalogCategories.Structures));
  seed.push(entry("fort", "Fort", SidCatalogCategories.Structures));

  // ---- Portals (коннекторы зон) ----
  seed.push(entry("name_portal_gate_center", "Portal Gate (Center)", SidCatalogCategories.Portals));
  seed.push(entry("name_portal_gate_side", "Portal Gate (Side)", SidCatalogCategories.Portals));
  seed.push(entry("name_portal_gate_spawn", "Portal Gate (Spawn)", SidCatalogCategories.Portals));

  // ---- Footholds (шаблонные якоря удалённых зон) ----
  seed.push(entry("name_remote_foothold", "Remote Foothold", SidCatalogCategories.Footholds));
  for (let n = 1; n <= 4; n++) {
    seed.push(entry(`name_remote_foothold_${n}`, `Remote Foothold #${n}`, SidCatalogCategories.Footholds));
  }
  // Двойной суффикс — стекованные/зеркальные шаблоны (Symmetry, Trinity),
  // где второй экземпляр получает суффикс.
  for (let n = 1; n <= 4; n++) {
    seed.push(entry(`name_remote_foothold_${n}${n}`, `Remote Foothold #${n} (mirror)`, SidCatalogCategories.Footholds));
  }
  seed.push(entry("remote_foothold", "Remote Foothold (raw SID)", SidCatalogCategories.Footholds));

  return seed;
}

const SEED: ZoneContentSidEntry[] = buildSeed();

/** Плоский список всех записей каталога (порядок исходника). */
export function allSidCatalogEntries(): ZoneContentSidEntry[] {
  return SEED;
}

export interface SidCatalogGroup {
  category: string;
  entries: ZoneContentSidEntry[];
}

/** Записи, сгруппированные по категории; категории в порядке OrderedCategories. */
export function groupedSidCatalogEntries(): SidCatalogGroup[] {
  const order = new Map<string, number>(SID_CATALOG_ORDERED_CATEGORIES.map((c, i): [string, number] => [c, i]));
  const byCategory = new Map<string, ZoneContentSidEntry[]>();
  for (const e of SEED) {
    const list = byCategory.get(e.category);
    if (list) list.push(e);
    else byCategory.set(e.category, [e]);
  }
  const groups = Array.from(byCategory.entries()).map(([category, entries]) => ({ category, entries }));
  groups.sort(
    (a, b) =>
      (order.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.category) ?? Number.MAX_SAFE_INTEGER),
  );
  return groups;
}
