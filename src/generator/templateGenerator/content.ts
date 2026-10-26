import type { NeutralZoneQuality, NeutralZoneTier } from "../enums";
import type { GeneratorSettings, ZoneContentItem } from "../settings";
import type {
  ContentCountLimit,
  ContentItemSchema,
  ContentPlacementRule,
  ContentSidLimit,
  MandatoryContentGroup,
  ZoneLayout,
} from "../template";
import { KnownIdsContentLists } from "../knownIds";
import type { NeutralZonePlan } from "./shared";
import { referencedRoadDecorationItems } from "../zoneContent/roadDecorations";
import { applyToMandatoryGroup } from "../zoneContent/emit";
import { resolveZoneContent } from "../zoneContent/resolve";

/**
 * Порт mandatory content / zone layouts / content count limits из
 * TemplateGenerator.cs. Порядок строк контента значим и повторён 1:1.
 */

// ── Zone layouts ─────────────────────────────────────────────────────────────

export function buildZoneLayouts(): ZoneLayout[] {
  return [
    buildZoneLayout("zone_layout_spawns", 0.24, 0.48, 0.3, 16, 0.16, 160, -0.3, 0.4, [20, 2, 1]),
    buildZoneLayout("zone_layout_sides", 0.36, 0.5, 0.25, 16, 0.128, 128, -0.3, 0.3, [20, 2, 1]),
    buildZoneLayout("zone_layout_treasure_zone", 0.5, 0.5, 0.45, 12, 0.12, 96, -0.3, 0.3, [12, 3, 1]),
    buildZoneLayout("zone_layout_center", 0.56, 0.6, 0.3, 10, 0.128, 96, -0.25, 0.3, [12, 4, 1]),
  ];
}

function buildZoneLayout(
  name: string,
  obstaclesFill: number,
  obstaclesFillVoid: number,
  lakesFill: number,
  minLakeArea: number,
  elevationClusterScale: number,
  roadClusterArea: number,
  roadAttraction: number,
  ambientNoise: number,
  groupSizeWeights: number[],
): ZoneLayout {
  return {
    name,
    obstaclesFill,
    obstaclesFillVoid,
    lakesFill,
    minLakeArea,
    elevationClusterScale,
    elevationModes: [
      { weight: 2, minElevatedFraction: 0.2, maxElevatedFraction: 0.4 },
      { weight: 1, minElevatedFraction: 0.6, maxElevatedFraction: 0.8 },
    ],
    roadClusterArea,
    guardedEncounterResourceFractions: {
      countBounds: [],
      fractions: [0.66],
    },
    ambientPickupDistribution: {
      repulsion: 1.0,
      noise: ambientNoise,
      roadAttraction,
      obstacleAttraction: 0.0,
      groupSizeWeights,
    },
  };
}

// ── Mandatory content ────────────────────────────────────────────────────────

export function buildAllMandatoryContent(
  playerLetters: string[],
  neutralZones: NeutralZonePlan[],
  settings: GeneratorSettings,
): MandatoryContentGroup[] {
  const groups: MandatoryContentGroup[] = [];
  const referencedNames = referencedRoadDecorationItems(settings.zoneRoadDecorations);

  const playerGroups: MandatoryContentGroup[] = [];
  const neutralGroups: MandatoryContentGroup[] = [];

  for (const letter of playerLetters) {
    const group = buildSpawnMandatoryContent(letter, settings.zoneCfg.playerZoneCastles, settings.spawnRemoteFootholds);
    const userItems = settings.playerZoneContent.items;
    if (userItems.length > 0) {
      // Предупреждения отбрасываются здесь — UI-сурфейсинг отдельно.
      applyToMandatoryGroup(group, userItems, `side_${letter}`, referencedNames);
    }
    playerGroups.push(group);
    groups.push(group);
  }

  for (const neutralZone of neutralZones) {
    const group = buildNeutralMandatoryContent(
      neutralZone.letter,
      neutralZone.castleCount,
      settings.spawnRemoteFootholds,
      neutralZone.quality,
    );
    const resolved = resolveNeutralItems(settings, neutralZone);
    if (resolved.length > 0) {
      applyToMandatoryGroup(group, resolved, `neutral_${neutralZone.letter}`, referencedNames);
    }
    neutralGroups.push(group);
    groups.push(group);
  }

  // Гарантированный контент («тонкие настройки»): count копий SID
  // распределяются по кругу между зонами выбранной цели. Ряды вида
  // { sid } — та же форма, что у собственных строк генератора.
  for (const forced of settings.forcedContent) {
    const sid = forced.sid.trim();
    if (sid.length === 0 || forced.count <= 0) continue;
    const targets = forced.target === "player" ? playerGroups : neutralGroups;
    if (targets.length === 0) continue;
    for (let i = 0; i < forced.count; i++) {
      const group = targets[i % targets.length];
      group.content ??= [];
      group.content.push({ sid });
    }
  }

  return groups;
}

// Разрешение слоёв пользовательского контента для нейтральной зоны.
function resolveNeutralItems(settings: GeneratorSettings, zone: NeutralZonePlan): ZoneContentItem[] {
  return resolveZoneContent(
    settings.neutralZoneContent,
    mapQualityToTier(zone.quality),
    zone.letter,
  ).items;
}

export function mapQualityToTier(quality: NeutralZoneQuality): NeutralZoneTier {
  switch (quality) {
    case "Low":
      return "Poor";
    case "Medium":
      return "Normal";
    case "High":
      return "Rich";
  }
}

function buildSpawnMandatoryContent(
  letter: string,
  castleCount: number,
  spawnFootholds: boolean,
): MandatoryContentGroup {
  return {
    name: `mandatory_content_side_${letter}`,
    content: buildPlayerZoneMandatoryContent(castleCount, spawnFootholds),
  };
}

function buildNeutralMandatoryContent(
  letter: string,
  castleCount: number,
  spawnFootholds: boolean,
  quality: NeutralZoneQuality,
): MandatoryContentGroup {
  return {
    name: `mandatory_content_neutral_${letter}`,
    content:
      quality === "Low"
        ? buildLowNeutralMandatoryContent(castleCount, spawnFootholds)
        : quality === "High"
          ? buildHighNeutralMandatoryContent(castleCount, spawnFootholds)
          : buildMediumNeutralMandatoryContent(castleCount, spawnFootholds),
  };
}

// ── Компактные фабрики строк (порядок ключей = порядок свойств модели) ──────

const rule = (
  type: string,
  args: string[],
  targetMin: number,
  targetMax: number,
  weight: number,
): ContentPlacementRule => ({ type, args, targetMin, targetMax, weight });

const list = (listId: string): ContentItemSchema => ({ includeLists: [listId] });

const sidRow = (sid: string): ContentItemSchema => ({ sid });

/**
 * Player spawn zone — гарантированные стартовые шахты у замка, полный набор
 * редких шахт вдоль дорог, утилитарные/экономические постройки, tier-split
 * найм, один тренер статов, guarded resource banks и стартовый лут.
 * Основано на консенсусе Exodus, Staircase, Kerberos, Blitz, Universe и
 * Yin Yang spawn-зон из корпуса примеров.
 */
function buildPlayerZoneMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItemSchema[] {
  const footholdRules = footholdRulesFor(castleCount);
  const content: ContentItemSchema[] = [];

  if (spawnFootholds) {
    content.push({
      name: "name_remote_foothold_1",
      sid: "remote_foothold",
      isGuarded: false,
      rules: footholdRules,
    });
  }

  content.push(
    // ── Базовые шахты — guarded, привязаны к замку игрока (везде). ──
    {
      name: "name_mine_wood",
      sid: "mine_wood",
      isGuarded: true,
      isMine: true,
      rules: [
        rule("MainObject", ["0"], 0.15, 0.35, 1),
        rule("Crossroads", [], 0.15, 0.3, 1),
      ],
    },
    {
      name: "name_mine_ore",
      sid: "mine_ore",
      isGuarded: true,
      isMine: true,
      rules: [
        rule("MainObject", ["0"], 0.15, 0.35, 1),
        rule("Crossroads", [], 0.15, 0.3, 1),
      ],
    },

    // ── Золотая шахта у перекрёстка (паттерн Exodus/Staircase/Yin Yang). ──
    { sid: "mine_gold", isMine: true, rules: [rule("Crossroads", [], 0.1, 0.3, 1)] },

    // ── Редкие шахты вдоль дорог (паттерн Exodus/Staircase/Yin Yang). ──
    { name: "name_mine_crystals", sid: "mine_crystals", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { name: "name_mine_mercury", sid: "mine_mercury", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { name: "name_mine_gemstones", sid: "mine_gemstones", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { name: "name_alchemy_lab", sid: "alchemy_lab", isMine: true, rules: [rule("Road", [], 0.2, 0.3, 1)] },

    // ── Утилитарные постройки (паттерн Blitz/Kerberos/Exodus). ──
    sidRow("watchtower"),
    { sid: "market", isGuarded: true, rules: [rule("Road", [], 0.15, 0.3, 1)] },
    { sid: "mana_well", rules: [rule("Road", [], 0.15, 0.3, 1)] },

    // ── Тренировка героя — tier-2 статовая постройка + uncommon hero bank
    //    (паттерн Blitz/Exodus). ──
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier2),
    list(KnownIdsContentLists.BuildingUncommonHeroBanks),

    // ── Найм — low-tier × 2 + high-tier × 1 + полный пул × 1 (Kerberos + Universe). ──
    list(KnownIdsContentLists.BuildingRandomHiresLowTier),
    list(KnownIdsContentLists.BuildingRandomHiresLowTier),
    list(KnownIdsContentLists.BuildingRandomHiresHighTier),
    list(KnownIdsContentLists.BuildingRandomHires),

    // ── Guarded resource banks — tier 1 × 2 + tier 2 × 1 (паттерн Exodus). ──
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier1),
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier1),
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier2),

    // ── Лут — epic items + армейская пандора (паттерн Exodus/Blitz). ──
    { sid: "random_item_epic", soloEncounter: true },
    { sid: "pandora_box", soloEncounter: true },
    list(KnownIdsContentLists.PickupPandoraBoxArmyLowTier),
  );

  return content;
}

/**
 * Нейтральная зона low-качества — пулы t2, нарочно скупой mandatory контент:
 * несколько редких шахт, базовые утилитарные постройки, немного random hires.
 * По образцу Universe side zones, Kerberos connector zones и Madness side
 * zones. Без high-end встреч (нет dragon utopias, research labs, unstable ruins).
 */
function buildLowNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItemSchema[] {
  const footholdRules = footholdRulesFor(castleCount);
  const content: ContentItemSchema[] = [];

  if (spawnFootholds) {
    content.push({
      name: "name_remote_foothold_1",
      sid: "remote_foothold",
      isGuarded: false,
      rules: footholdRules,
    });
  }

  content.push(
    // Шахты — биомовая редкая + одна фиксированная (паттерн Blitz Side-1).
    { name: "name_mine_by_biome_1", isMine: true, includeLists: [KnownIdsContentLists.RareMinesByBiome] },
    { isMine: true, includeLists: [KnownIdsContentLists.RareMines] },
    // Утилити — один guarded market у перекрёстка, одна vision-постройка.
    { sid: "market", isGuarded: true, rules: [rule("Crossroads", [], 0.15, 0.2, 1)] },
    list(KnownIdsContentLists.VisionBuildingsTier1),
    // Бафф-постройки из реального hero-buff пула (mana_well, fountain, stables и т.д.).
    list(KnownIdsContentLists.BuildingHeroBuffTier1),
    list(KnownIdsContentLists.BuildingHeroBuffTier1),
    // Обычная статовая постройка героя (stinging_sword, armory_automaton,
    // magic_wheel, knowledge_garden).
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier1),
    // Найм — low-tier random hires (hires 1–4).
    list(KnownIdsContentLists.BuildingRandomHiresLowTier),
    list(KnownIdsContentLists.BuildingRandomHiresLowTier),
    // Лут — соло пандора + low-tier армейская пандора (варианты 8–11).
    { sid: "pandora_box", soloEncounter: true },
    list(KnownIdsContentLists.PickupPandoraBoxArmyLowTier),
    // Пикапы — случайный предмет + обычный магический пикап.
    list(KnownIdsContentLists.PickupRandomItems),
    list(KnownIdsContentLists.BuildingMagicTier1),
  );

  return content;
}

/**
 * Нейтральная зона medium-качества — пулы t3, tier-3 resource banks,
 * средний найм, статовые постройки, epic+legendary лут, пандоры, золотые
 * и редкие шахты. Без high-end встреч.
 */
function buildMediumNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItemSchema[] {
  const footholdRules = footholdRulesFor(castleCount);
  const content: ContentItemSchema[] = [];

  if (spawnFootholds) {
    content.push({
      name: "name_remote_foothold_1",
      sid: "remote_foothold",
      isGuarded: false,
      rules: footholdRules,
    });
  }

  content.push(
    // Шахты — полный редкий набор + золото + alchemy lab (паттерн Yin Yang/Staircase t3).
    { name: "name_mine_crystals", sid: "mine_crystals", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { name: "name_mine_mercury", sid: "mine_mercury", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { name: "name_mine_gemstones", sid: "mine_gemstones", isMine: true, rules: [rule("Road", [], 0.05, 0.1, 1)] },
    { sid: "mine_gold", isMine: true, rules: [rule("Road", [], 0.15, 0.2, 1)] },
    { sid: "alchemy_lab", isMine: true, rules: [rule("Road", [], 0.2, 0.3, 1)] },
    // Утилити — watchtower (guarded) + vision-постройка (только tier 1).
    // wind_rose (полное открытие карты) живёт в tier_2 и belongs в high-зонах.
    { sid: "watchtower", isGuarded: true },
    list(KnownIdsContentLists.VisionBuildingsTier1),
    // Бафф-постройки.
    list(KnownIdsContentLists.BuildingHeroBuffTier1),
    // Статы героя — tier 1 common + tier 2 uncommon.
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier1),
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier2),
    // Магические постройки — tier 1 + tier 2.
    list(KnownIdsContentLists.BuildingMagicTier1),
    list(KnownIdsContentLists.BuildingMagicTier2),
    // Найм — low-tier + high-tier.
    list(KnownIdsContentLists.BuildingRandomHiresLowTier),
    list(KnownIdsContentLists.BuildingRandomHiresHighTier),
    // Unit banks — биом-ограниченные (паттерн Blitz Treasure-2).
    list(KnownIdsContentLists.BuildingGuardedUnitsBanksOnlyBiome),
    // Guarded resource banks — tier 2 (без black tower / tier-1 банков).
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier2),
    // Лут — epic items + пандоры с армейскими вариантами.
    { sid: "random_item_epic", soloEncounter: true },
    sidRow("random_item_epic"),
    { sid: "pandora_box", soloEncounter: true },
    sidRow("pandora_box"),
    list(KnownIdsContentLists.PickupPandoraBoxArmyLowTier),
  );

  return content;
}

/**
 * Нейтральная зона high-качества — пулы t4/t5, самые сложные встречи:
 * dragon utopias, unstable ruins, research labs, mythic scroll boxes,
 * tier-3 статы, много unit banks (в т.ч. биом-ограниченных), legendary лут,
 * много пандор, золото-тяжёлые шахты. Только этот тир спавнит dragon utopias,
 * unstable ruins и research laboratories.
 */
function buildHighNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItemSchema[] {
  const footholdRules = footholdRulesFor(castleCount);
  const content: ContentItemSchema[] = [];

  if (spawnFootholds) {
    content.push({
      name: "name_remote_foothold_1",
      sid: "remote_foothold",
      isGuarded: false,
      rules: footholdRules,
    });
  }

  content.push(
    // Эпические встречи — эксклюзив high-зон.
    list(KnownIdsContentLists.BuildingUtopia),
    list(KnownIdsContentLists.BuildingUtopia),
    list(KnownIdsContentLists.BuildingEpicGuardedResourceBanks),
    list(KnownIdsContentLists.BuildingEpicGuardedResourceBanks),
    // Утилити — vision + бафф-постройки.
    list(KnownIdsContentLists.VisionBuildingsTier1),
    list(KnownIdsContentLists.BuildingHeroBuffTier1),
    // Статы героя — tier 2 + tier 3 (fort/university/maze/college_of_wonder).
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier2),
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier3),
    list(KnownIdsContentLists.BuildingHeroStatsAndSkillsTier3),
    // Магические постройки — tier 2 (magic amplifiers).
    list(KnownIdsContentLists.BuildingMagicTier2),
    list(KnownIdsContentLists.BuildingMagicTier2),
    // Найм — high-tier (hires 5–7) + полный пул.
    list(KnownIdsContentLists.BuildingRandomHiresHighTier),
    list(KnownIdsContentLists.BuildingRandomHiresHighTier),
    list(KnownIdsContentLists.BuildingRandomHires),
    // Unit banks — биом-ограниченные + без ограничения.
    list(KnownIdsContentLists.BuildingGuardedUnitsBanksOnlyBiome),
    list(KnownIdsContentLists.BuildingGuardedUnitsBanksNoBiome),
    list(KnownIdsContentLists.BuildingGuardedUnitsBanksNoBiome),
    // Guarded resource banks — tier 2 + tier 3.
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier2),
    list(KnownIdsContentLists.BuildingGuardedResourceBanksTier3),
    // Лут — mythic свитки, legendary предметы, пандоры с high-tier армиями.
    list(KnownIdsContentLists.PickupMythicScrollBox),
    list(KnownIdsContentLists.PickupMythicScrollBox),
    { sid: "random_item_legendary", soloEncounter: true },
    sidRow("random_item_legendary"),
    sidRow("random_item_epic"),
    { sid: "pandora_box", soloEncounter: true },
    sidRow("pandora_box"),
    sidRow("pandora_box"),
    list(KnownIdsContentLists.PickupPandoraBoxArmyHighTier),
    list(KnownIdsContentLists.PickupPandoraBoxArmyHighTier),
    // Шахты — золото-тяжёлые с полным редким набором.
    { sid: "mine_gold", isMine: true, rules: [rule("Crossroads", [], 0.1, 0.3, 1)] },
    { sid: "mine_gold", isMine: true },
    { sid: "mine_gold", isMine: true },
    { sid: "mine_crystals", isMine: true },
    { sid: "mine_mercury", isMine: true },
    { sid: "mine_gemstones", isMine: true },
    { sid: "alchemy_lab", isMine: true },
    { sid: "alchemy_lab", isMine: true },
  );

  return content;
}

function footholdRulesFor(castleCount: number): ContentPlacementRule[] {
  const rules: ContentPlacementRule[] = [
    rule("Crossroads", [], 0.2, 0.3, 0),
  ];
  if (castleCount > 0) rules.push(rule("MainObject", ["0"], 0.2, 0.4, 0));
  if (castleCount > 1) rules.push(rule("MainObject", ["1"], 0.5, 0.5, 2));
  return rules;
}

// ── Content count limits ─────────────────────────────────────────────────────

/**
 * Полный набор contentCountLimits, выведенный из всех примеров шаблонов.
 * Значения отражают типичные максимумы из шаблонов.
 */
export function buildAllContentCountLimits(): ContentCountLimit[] {
  const sidLimits: ContentSidLimit[] = [
    // ── Запрещено в генерируемых зонах ──
    // tier-1 resource bank; слишком слабый/неуместный в нейтральных зонах
    { sid: "black_tower", maxCount: 0 },
    // ── Утилити / бафф-постройки ──
    { sid: "fountain", maxCount: 2 },
    { sid: "fountain_2", maxCount: 2 },
    { sid: "mana_well", maxCount: 2 },
    { sid: "beer_fountain", maxCount: 2 },
    { sid: "market", maxCount: 1 },
    { sid: "forge", maxCount: 2 },
    { sid: "stables", maxCount: 1 },
    { sid: "watchtower", maxCount: 2 },
    { sid: "wind_rose", maxCount: 1 },
    { sid: "quixs_path", maxCount: 2 },
    { sid: "crystal_trail", maxCount: 3 },
    { sid: "mysterious_stone", maxCount: 2 },

    // ── Обучение / XP-постройки ──
    { sid: "university", maxCount: 2 },
    { sid: "wise_owl", maxCount: 4 },
    { sid: "celestial_sphere", maxCount: 2 },
    { sid: "pile_of_books", maxCount: 2 },
    { sid: "insaras_eye", maxCount: 2 },
    { sid: "tear_of_truth", maxCount: 3 },
    { sid: "tree_of_abundance", maxCount: 2 },

    // ── Найм ──
    { sid: "huntsmans_camp", maxCount: 2 },
    { sid: "shady_den", maxCount: 2 },
    { sid: "random_hire_1", maxCount: 6 },
    { sid: "random_hire_2", maxCount: 6 },
    { sid: "random_hire_3", maxCount: 6 },
    { sid: "random_hire_4", maxCount: 6 },
    { sid: "random_hire_5", maxCount: 6 },
    { sid: "random_hire_6", maxCount: 6 },
    { sid: "random_hire_7", maxCount: 6 },

    // ── Боевые / encounter-постройки ──
    { sid: "arena", maxCount: 2 },
    { sid: "sacrificial_shrine", maxCount: 2 },
    { sid: "chimerologist", maxCount: 2 },
    { sid: "circus", maxCount: 2 },
    { sid: "infernal_cirque", maxCount: 2 },
    { sid: "flattering_mirror", maxCount: 2 },
    { sid: "fickle_shrine", maxCount: 1 },
    { sid: "point_of_balance", maxCount: 3 },

    // ── Специальное / лут ──
    { sid: "pandora_box", maxCount: 4 },

    // ── Map-feature объекты (0 = выключено, 99 = безлимит; ограничиваем
    //    разумным значением, чтобы могли иногда появляться) ──
    { sid: "ritual_pyre", maxCount: 3 },
    { sid: "boreal_call", maxCount: 3 },
    { sid: "jousting_range", maxCount: 1 },
    { sid: "unforgotten_grave", maxCount: 1 },
    { sid: "petrified_memorial", maxCount: 1 },
    { sid: "the_gorge", maxCount: 1 },
  ];

  const limits: ContentCountLimit[] = [];

  limits.push({ name: "content_limits_side", limits: sidLimits });
  limits.push({ name: "content_limits_side_0_0", playerMin: 0, playerMax: 0, limits: sidLimits });

  for (let a = 1; a <= 5; a++) {
    for (let b = a + 1; b <= 6; b++) {
      limits.push({ name: `content_limits_side_${a}_${b}`, playerMin: a, playerMax: b, limits: sidLimits });
    }
  }

  return limits;
}
