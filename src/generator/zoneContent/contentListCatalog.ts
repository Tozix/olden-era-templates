/**
 * Порт ContentListCatalog: каталог includeLists-ID (значение
 * ContentItem.includeLists) для пикер-UI обоих хостов. ID переносятся
 * дословно из shipped-шаблонов; переименование ID ломает round-trip.
 */

export interface ContentListEntry {
  id: string;
  display: string;
  category: string;
}

export const ContentListCategories = {
  ResourceBanks: "Resource banks",
  UnitsBanks: "Units banks",
  RandomHires: "Random hires",
  HeroLearning: "Hero stats / magic",
  Pickups: "Pickups & pandoras",
  Mines: "Mines",
  Other: "Other",
} as const;

/** Порядок секций категорий в пикере. Новые категории — добавлять сюда. */
export const CONTENT_LIST_ORDERED_CATEGORIES: string[] = [
  ContentListCategories.ResourceBanks,
  ContentListCategories.UnitsBanks,
  ContentListCategories.RandomHires,
  ContentListCategories.HeroLearning,
  ContentListCategories.Pickups,
  ContentListCategories.Mines,
  ContentListCategories.Other,
];

const entry = (id: string, display: string, category: string): ContentListEntry => ({
  id,
  display,
  category,
});

function buildSeed(): ContentListEntry[] {
  const seed: ContentListEntry[] = [];

  // ---- Resource banks ----
  seed.push(entry("basic_content_list_building_guarded_resource_banks_tier_1", "Resource banks · tier 1 (basic)", ContentListCategories.ResourceBanks));
  seed.push(entry("basic_content_list_building_guarded_resource_banks_tier_2", "Resource banks · tier 2 (basic)", ContentListCategories.ResourceBanks));
  seed.push(entry("basic_content_list_building_guarded_resource_banks_tier_3", "Resource banks · tier 3 (basic)", ContentListCategories.ResourceBanks));
  seed.push(entry("content_list_building_epic_guarded_resource_banks", "Resource banks · epic", ContentListCategories.ResourceBanks));
  // template_pool_* — шаблонные переопределения банков ресурсов tier-3.
  seed.push(entry("template_pool_blitz_guarded_resource_banks_tier_3_base", "Resource banks · Blitz tier-3 (base)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_blitz_guarded_resource_banks_tier_3_pro", "Resource banks · Blitz tier-3 (pro)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_chosen_one_guarded_resource_banks_tier_3_base", "Resource banks · Chosen One tier-3 (base)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_jebus_cross_guarded_resource_banks_tier_3_base", "Resource banks · Jebus Cross tier-3 (base)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_jebus_cross_guarded_resource_banks_tier_3_pro", "Resource banks · Jebus Cross tier-3 (pro)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_massacre_guarded_resource_banks_tier_3_base", "Resource banks · Massacre tier-3 (base)", ContentListCategories.ResourceBanks));
  seed.push(entry("template_pool_shamrock_guarded_resource_banks_tier_3_base", "Resource banks · Shamrock tier-3 (base)", ContentListCategories.ResourceBanks));

  // ---- Units banks (creature banks с биом-ограничениями) ----
  seed.push(entry("basic_content_list_building_guarded_units_banks", "Units banks (basic)", ContentListCategories.UnitsBanks));
  seed.push(entry("basic_content_list_building_guarded_units_banks_no_biome_restriction", "Units banks · no biome restriction", ContentListCategories.UnitsBanks));
  seed.push(entry("basic_content_list_building_guarded_units_banks_only_biome_restriction", "Units banks · biome-restricted only", ContentListCategories.UnitsBanks));
  seed.push(entry("content_list_building_uncommon_guarded_units_banks", "Units banks · uncommon", ContentListCategories.UnitsBanks));
  seed.push(entry("content_list_building_template_sprint_uncommon_guarded_units_banks", "Units banks · Sprint uncommon", ContentListCategories.UnitsBanks));

  // ---- Random hires (пулы найма, все тиры) ----
  seed.push(entry("basic_content_list_building_random_hires", "Random hires (basic, all tiers)", ContentListCategories.RandomHires));
  for (let tier = 1; tier <= 7; tier++) {
    seed.push(entry(`basic_content_list_building_random_hires_tier_${tier}`, `Random hires · tier ${tier} (basic)`, ContentListCategories.RandomHires));
  }
  seed.push(entry("content_list_building_random_hires", "Random hires", ContentListCategories.RandomHires));
  seed.push(entry("content_list_building_random_hires_high_tier", "Random hires · high tier", ContentListCategories.RandomHires));
  seed.push(entry("content_list_building_random_hires_low_tier", "Random hires · low tier", ContentListCategories.RandomHires));
  // Пер-зонные пулы найма Harmony (Center / Side / Spawn).
  seed.push(entry("template_pool_harmony_building_random_hires_center", "Random hires · Harmony center", ContentListCategories.RandomHires));
  seed.push(entry("template_pool_harmony_building_random_hires_side", "Random hires · Harmony side", ContentListCategories.RandomHires));
  seed.push(entry("template_pool_harmony_building_random_hires_spawn", "Random hires · Harmony spawn", ContentListCategories.RandomHires));

  // ---- Hero stats / magic (обучающие постройки) ----
  seed.push(entry("basic_content_list_building_hero_buff_tier_1", "Hero buff · tier 1", ContentListCategories.HeroLearning));
  seed.push(entry("basic_content_list_building_hero_stats_and_skills_tier_2", "Hero stats & skills · tier 2", ContentListCategories.HeroLearning));
  seed.push(entry("basic_content_list_building_hero_stats_and_skills_tier_3", "Hero stats & skills · tier 3", ContentListCategories.HeroLearning));
  seed.push(entry("basic_content_list_building_magic_tier_2", "Magic structures · tier 2", ContentListCategories.HeroLearning));
  seed.push(entry("content_list_building_uncommon_hero_stats", "Hero stats · uncommon", ContentListCategories.HeroLearning));

  // ---- Pickups & pandoras ----
  seed.push(entry("basic_content_list_pickup_mythic_scroll_box", "Mythic scroll box", ContentListCategories.Pickups));
  seed.push(entry("basic_content_list_pickup_pandora_box_units", "Pandora box · units", ContentListCategories.Pickups));
  seed.push(entry("basic_content_list_pickup_random_items", "Random items pickup", ContentListCategories.Pickups));
  for (let tier = 1; tier <= 5; tier++) {
    seed.push(entry(`content_list_pickup_scroll_box_tier_${tier}`, `Scroll box · tier ${tier}`, ContentListCategories.Pickups));
  }

  // ---- Mines ----
  seed.push(entry("basic_content_list_rare_mines_by_biome", "Rare mines · by biome", ContentListCategories.Mines));

  return seed;
}

const SEED: ContentListEntry[] = buildSeed();

/** Плоский список записей каталога (порядок исходника). */
export function allContentListEntries(): ContentListEntry[] {
  return SEED;
}

export interface ContentListGroup {
  category: string;
  entries: ContentListEntry[];
}

/** Записи по категориям; категории в порядке OrderedCategories, внутри — исходный порядок. */
export function groupedContentListEntries(): ContentListGroup[] {
  const order = new Map<string, number>(CONTENT_LIST_ORDERED_CATEGORIES.map((c, i): [string, number] => [c, i]));
  const byCategory = new Map<string, ContentListEntry[]>();
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

/** True, если id — известная запись каталога. */
export function contentListCatalogContains(id: string): boolean {
  return SEED.some((e) => e.id === id);
}
