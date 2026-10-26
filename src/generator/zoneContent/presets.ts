import type { ZoneContentItem } from "../settings";

/**
 * Порт ZoneContentPresets: курируемые встроенные пресеты ZoneContentItem
 * для аффорданса «Add preset…» в хостах. Каждый пресет проходит валидацию
 * ZoneContentItemValidator. Данные портированы 1:1.
 */

export interface ZoneContentPreset {
  name: string;
  category: string;
  item: ZoneContentItem;
}

export const ZoneContentPresetCategories = {
  Mandatory: "Mandatory",
  Mines: "Mines",
  Structures: "Structures",
  Portals: "Portals",
  Footholds: "Footholds",
} as const;

// Заполняет значения по умолчанию, как инициализатор C#-объекта
// (MinCount/MaxCount = 1, Pool = Mandatory, остальное пусто).
const presetItem = (p: Pick<ZoneContentItem, "sid"> & Partial<ZoneContentItem>): ZoneContentItem => ({
  sid: p.sid,
  handle: p.handle ?? null,
  isGroup: p.isGroup ?? false,
  minCount: p.minCount ?? 1,
  maxCount: p.maxCount ?? 1,
  pool: p.pool ?? "Mandatory",
  isGuarded: p.isGuarded ?? false,
  nearCastle: p.nearCastle ?? false,
  roadDistance: p.roadDistance ?? null,
  factionAffinity: p.factionAffinity ?? [],
  biomeFilter: p.biomeFilter ?? [],
  includeListIds: p.includeListIds ?? [],
  rules: p.rules ?? [],
});

// Кэшированный синглтон. ZoneContentItem мутабелен — вызывающие ДОЛЖНЫ
// клонировать preset.item перед добавлением в скоуп (cloneItem).
const ALL: ZoneContentPreset[] = [
  // ---------- Mandatory ----------
  {
    name: "Mana Well x1 (guarded)",
    category: ZoneContentPresetCategories.Mandatory,
    item: presetItem({ sid: "name_mana_well", minCount: 1, maxCount: 1, pool: "Mandatory", isGuarded: true }),
  },
  {
    name: "Pandora Army x1 (guarded, near castle)",
    category: ZoneContentPresetCategories.Mandatory,
    item: presetItem({ sid: "name_pandora_box_army", minCount: 1, maxCount: 1, pool: "Mandatory", isGuarded: true, nearCastle: true }),
  },
  // Демо-пресет правил (T-202) — проверяет round-trip правил, закрепляя
  // Pandora Resources у перекрёстка (паттерн "MainObject ↔ Crossroads"
  // из shipped-шаблонов, см. Showdown.rmg.json).
  {
    name: "Pandora Resources x1 (near crossroads)",
    category: ZoneContentPresetCategories.Mandatory,
    item: presetItem({
      sid: "name_pandora_box_resources",
      minCount: 1,
      maxCount: 1,
      pool: "Mandatory",
      rules: [{ type: "Crossroads", args: [], targetMin: 0.15, targetMax: 0.3, weight: 1 }],
    }),
  },
  {
    name: "Pandora XP x1",
    category: ZoneContentPresetCategories.Mandatory,
    item: presetItem({ sid: "name_pandora_box_xp", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Mana Well x2 (guarded)",
    category: ZoneContentPresetCategories.Mandatory,
    item: presetItem({ sid: "name_mana_well", minCount: 2, maxCount: 2, pool: "Mandatory", isGuarded: true }),
  },

  // ---------- Mines ----------
  {
    name: "Gold Mine x1 (guarded)",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_gold", minCount: 1, maxCount: 1, pool: "Resources", isGuarded: true }),
  },
  {
    name: "Gold Mine x1-2 (near castle)",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_gold", minCount: 1, maxCount: 2, pool: "Resources", nearCastle: true }),
  },
  {
    name: "Sawmill x1-2",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_wood", minCount: 1, maxCount: 2, pool: "Resources" }),
  },
  {
    name: "Ore Pit x1-2",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_ore", minCount: 1, maxCount: 2, pool: "Resources" }),
  },
  {
    name: "Crystal Cavern x1 (guarded)",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_crystals", minCount: 1, maxCount: 1, pool: "Resources", isGuarded: true }),
  },
  {
    name: "Gem Mine x1 (guarded)",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_gemstones", minCount: 1, maxCount: 1, pool: "Resources", isGuarded: true }),
  },
  {
    name: "Mercury Lab x1 (guarded)",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_mercury", minCount: 1, maxCount: 1, pool: "Resources", isGuarded: true }),
  },
  {
    name: "Biome Mine x1-2",
    category: ZoneContentPresetCategories.Mines,
    item: presetItem({ sid: "name_mine_by_biome", minCount: 1, maxCount: 2, pool: "Resources", isGuarded: true }),
  },

  // ---------- Structures ----------
  {
    name: "Alchemy Lab x1 (guarded)",
    category: ZoneContentPresetCategories.Structures,
    item: presetItem({ sid: "name_alchemy_lab", minCount: 1, maxCount: 1, pool: "Guarded", isGuarded: true }),
  },
  {
    name: "Town Gate x1 (mandatory, near castle)",
    category: ZoneContentPresetCategories.Structures,
    item: presetItem({ sid: "name_town_gate", minCount: 1, maxCount: 1, pool: "Mandatory", nearCastle: true }),
  },

  // ---------- Portals ----------
  {
    name: "Portal Gate (Center) x1",
    category: ZoneContentPresetCategories.Portals,
    item: presetItem({ sid: "name_portal_gate_center", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Portal Gate (Side) x1-2",
    category: ZoneContentPresetCategories.Portals,
    item: presetItem({ sid: "name_portal_gate_side", minCount: 1, maxCount: 2, pool: "Mandatory" }),
  },
  {
    name: "Portal Gate (Spawn) x1 (near castle)",
    category: ZoneContentPresetCategories.Portals,
    item: presetItem({ sid: "name_portal_gate_spawn", minCount: 1, maxCount: 1, pool: "Mandatory", nearCastle: true }),
  },

  // ---------- Footholds ----------
  {
    name: "Remote Foothold x1",
    category: ZoneContentPresetCategories.Footholds,
    item: presetItem({ sid: "name_remote_foothold", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Remote Foothold #1",
    category: ZoneContentPresetCategories.Footholds,
    item: presetItem({ sid: "name_remote_foothold_1", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Remote Foothold #2",
    category: ZoneContentPresetCategories.Footholds,
    item: presetItem({ sid: "name_remote_foothold_2", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Remote Foothold #3",
    category: ZoneContentPresetCategories.Footholds,
    item: presetItem({ sid: "name_remote_foothold_3", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
  {
    name: "Remote Foothold #4",
    category: ZoneContentPresetCategories.Footholds,
    item: presetItem({ sid: "name_remote_foothold_4", minCount: 1, maxCount: 1, pool: "Mandatory" }),
  },
];

export function allZoneContentPresets(): ZoneContentPreset[] {
  return ALL;
}
