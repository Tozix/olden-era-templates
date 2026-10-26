import type { GuardReactionPreset, NeutralZoneQuality } from "../enums";
import type { GuardReactionSettings } from "../settings";
import { KnownIdsZoneLayouts, KnownIdsGeneralResourcePools } from "../knownIds";

/**
 * Порт общих констант/хелперов TemplateGenerator.cs: буквы зон, профили
 * нейтральных зон, пулы контента, масштабирование значений, tuning.
 */

// У каждой player-зоны 5 guard-подключений к центру (как в JCC).
export const CONNECTIONS_PER_ZONE = 1;
export const DEFAULT_GUARD_RANDOMIZATION = 0.05;
export const SPAWN_LAYOUT_NAME = KnownIdsZoneLayouts.Spawn;
export const SIDE_LAYOUT_NAME = KnownIdsZoneLayouts.Sides;
export const TREASURE_LAYOUT_NAME = KnownIdsZoneLayouts.TreasureZone;
export const CENTER_LAYOUT_NAME = KnownIdsZoneLayouts.Center;

// Метки для именования зон — до продвинутого максимума в 32 зоны.
export const ZoneLetters: string[] = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "I", "J", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X",
  "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF",
];

// Метка версии в auto-description; аналог версии сборки в C#
// (Assembly.GetName().Version → "v{Major}.{Minor}", текущая 0.7.0).
export const GENERATOR_VERSION_LABEL = "v0.7";

/** Порядок C#-enum NeutralZoneQuality: Low=0, Medium=1, High=2. */
export const NEUTRAL_QUALITY_ORDER: Record<NeutralZoneQuality, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export interface NeutralZonePlan {
  letter: string;
  quality: NeutralZoneQuality;
  castleCount: number;
}

/** null = оставить вбитые в зоны per-type массивы; не-null = перекрыть все зоны этой кривой из 6 корзин. */
export interface GenerationTuning {
  contentScale: number;
  resourceDensityMultiplier: number;
  structureDensityMultiplier: number;
  neutralStackStrengthMultiplier: number;
  borderGuardStrengthMultiplier: number;
  guardRandomization: number;
  guardReactionOverride: number[] | null;
}

export interface NeutralZoneProfile {
  layout: string;
  guardMultiplier: number;
  guardedContentPool: string[];
  unguardedContentPool: string[];
  resourcesContentPool: string[];
  guardedContentValue: number;
  guardedContentValuePerArea: number;
  unguardedContentValue: number;
  unguardedContentValuePerArea: number;
  resourcesValue: number;
  resourcesValuePerArea: number;
  primaryCityGuardValue: number;
  extraCityGuardValue: number;
  primaryBuildingsConstructionSid: string;
  extraBuildingsConstructionSid: string;
}

// ── Обобщённые tier-наборы пулов ─────────────────────────────────────────────
// t2 = низко тировые sides/spawns, t3 = medium sides/treasures,
// t4/t5 = высоко тировые treasures/center.

export const T2_GUARDED_POOLS = [
  "classic_template_pool_random_t2_item",
  "classic_template_pool_random_t2_pandora",
  "classic_template_pool_random_t2_hire",
  "classic_template_pool_random_t2_unit_bank",
  "classic_template_pool_random_t2_res_bank",
  "classic_template_pool_random_t2_stat",
  "classic_template_pool_random_t2_magic",
];
export const T2_UNGUARDED_POOLS = [
  "classic_template_pool_random_unguarded_t2_item",
  "classic_template_pool_random_unguarded_t2_pandora",
  "classic_template_pool_random_unguarded_t2_hire",
  "classic_template_pool_random_unguarded_t2_unit_bank",
  "classic_template_pool_random_unguarded_t2_res_bank",
  "classic_template_pool_random_unguarded_t2_stat",
  "classic_template_pool_random_unguarded_t2_magic",
];
export const T3_GUARDED_POOLS = [
  "classic_template_pool_random_t3_item",
  "classic_template_pool_random_t3_pandora",
  "classic_template_pool_random_t3_hire",
  "classic_template_pool_random_t3_unit_bank",
  "classic_template_pool_random_t3_res_bank",
  "classic_template_pool_random_t3_stat",
  "classic_template_pool_random_t3_magic",
];
export const T3_UNGUARDED_POOLS = [
  "classic_template_pool_random_unguarded_t3_item",
  "classic_template_pool_random_unguarded_t3_pandora",
  "classic_template_pool_random_unguarded_t3_hire",
  "classic_template_pool_random_unguarded_t3_unit_bank",
  "classic_template_pool_random_unguarded_t3_res_bank",
  "classic_template_pool_random_unguarded_t3_stat",
  "classic_template_pool_random_unguarded_t3_magic",
];
export const T4_GUARDED_POOLS = [
  "classic_template_pool_random_t4_item",
  "classic_template_pool_random_t4_pandora",
  "classic_template_pool_random_t4_hire",
  "classic_template_pool_random_t4_unit_bank",
  "classic_template_pool_random_t4_res_bank",
  "classic_template_pool_random_t4_stat",
  "classic_template_pool_random_t4_magic",
];
export const T4_UNGUARDED_POOLS = [
  "classic_template_pool_random_unguarded_t4_item",
  "classic_template_pool_random_unguarded_t4_pandora",
  "classic_template_pool_random_unguarded_t4_hire",
  "classic_template_pool_random_unguarded_t4_unit_bank",
  "classic_template_pool_random_unguarded_t4_res_bank",
  "classic_template_pool_random_unguarded_t4_stat",
  "classic_template_pool_random_unguarded_t4_magic",
];
export const T5_GUARDED_POOLS = [
  "classic_template_pool_random_t5_item",
  "classic_template_pool_random_t5_pandora",
  "classic_template_pool_random_t5_hire",
  "classic_template_pool_random_t5_unit_bank",
  "classic_template_pool_random_t5_res_bank",
  "classic_template_pool_random_t5_stat",
  "classic_template_pool_random_t5_magic",
];
export const T5_UNGUARDED_POOLS = [
  "classic_template_pool_random_unguarded_t5_item",
  "classic_template_pool_random_unguarded_t5_pandora",
  "classic_template_pool_random_unguarded_t5_hire",
  "classic_template_pool_random_unguarded_t5_unit_bank",
  "classic_template_pool_random_unguarded_t5_res_bank",
  "classic_template_pool_random_unguarded_t5_stat",
  "classic_template_pool_random_unguarded_t5_magic",
];

export const GENERAL_RESOURCES_POOR = [KnownIdsGeneralResourcePools.StartZonePoor];
export const GENERAL_RESOURCES_MEDIUM = [KnownIdsGeneralResourcePools.StartZoneMedium];
export const GENERAL_RESOURCES_RICH = [KnownIdsGeneralResourcePools.StartZoneRich];

export function neutralZoneProfile(quality: NeutralZoneQuality): NeutralZoneProfile {
  switch (quality) {
    // Low — пулы t2, zone_layout_sides, guard mult ~1.1, бедные ресурсы
    case "Low":
      return {
        layout: SIDE_LAYOUT_NAME,
        guardMultiplier: 1.1,
        guardedContentPool: T2_GUARDED_POOLS,
        unguardedContentPool: T2_UNGUARDED_POOLS,
        resourcesContentPool: GENERAL_RESOURCES_POOR,
        guardedContentValue: 120000,
        guardedContentValuePerArea: 1000,
        unguardedContentValue: 25000,
        unguardedContentValuePerArea: 200,
        resourcesValue: 30000,
        resourcesValuePerArea: 240,
        primaryCityGuardValue: 4000,
        extraCityGuardValue: 2000,
        primaryBuildingsConstructionSid: "poor_buildings_construction",
        extraBuildingsConstructionSid: "poor_buildings_construction",
      };
    // High — пулы t4+t5 вперемешку, zone_layout_treasures, guard mult ~1.8, богатые ресурсы
    case "High":
      return {
        layout: TREASURE_LAYOUT_NAME,
        guardMultiplier: 1.8,
        guardedContentPool: [...T4_GUARDED_POOLS, ...T5_GUARDED_POOLS],
        unguardedContentPool: [...T4_UNGUARDED_POOLS, ...T5_UNGUARDED_POOLS],
        resourcesContentPool: GENERAL_RESOURCES_RICH,
        guardedContentValue: 480000,
        guardedContentValuePerArea: 3000,
        unguardedContentValue: 80000,
        unguardedContentValuePerArea: 620,
        resourcesValue: 90000,
        resourcesValuePerArea: 580,
        primaryCityGuardValue: 16000,
        extraCityGuardValue: 8000,
        primaryBuildingsConstructionSid: "rich_buildings_construction",
        extraBuildingsConstructionSid: "rich_buildings_construction",
      };
    // Medium — пулы t3, zone_layout_sides/treasures, guard mult ~1.4, средние ресурсы
    default:
      return {
        layout: TREASURE_LAYOUT_NAME,
        guardMultiplier: 1.4,
        guardedContentPool: T3_GUARDED_POOLS,
        unguardedContentPool: T3_UNGUARDED_POOLS,
        resourcesContentPool: GENERAL_RESOURCES_MEDIUM,
        guardedContentValue: 240000,
        guardedContentValuePerArea: 2000,
        unguardedContentValue: 38000,
        unguardedContentValuePerArea: 300,
        resourcesValue: 55000,
        resourcesValuePerArea: 420,
        primaryCityGuardValue: 8000,
        extraCityGuardValue: 4000,
        primaryBuildingsConstructionSid: "rich_buildings_construction",
        extraBuildingsConstructionSid: "poor_buildings_construction",
      };
  }
}

// ── Округление ───────────────────────────────────────────────────────────────

/** System.Math.Round по умолчанию: MidpointRounding.ToEven (banker's rounding). */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** System.Math.Round(value, digits, MidpointRounding.AwayFromZero). */
export function roundAwayFromZero(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  const x = value * f;
  // Положительные значения здесь всегда неотрицательны; для них
  // Math.round (half-up) совпадает с away-from-zero.
  const r = Math.round(Math.abs(x));
  return (Math.sign(x) || 0) * r / f;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ── Масштабирование ──────────────────────────────────────────────────────────

export function scaleValue(value: number, multiplier: number): number {
  return Math.max(0, Math.trunc(value * multiplier)); // (int) в C# — усечение к нулю
}

export function scaleStructureValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.structureDensityMultiplier);
}

export function scaleResourceValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.resourceDensityMultiplier);
}

export function scaleNeutralGuardValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.neutralStackStrengthMultiplier);
}

export function scaleBorderGuardValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.borderGuardStrengthMultiplier);
}

export function scaleGuardMultiplier(value: number, tuning: GenerationTuning): number {
  return roundAwayFromZero(value * tuning.neutralStackStrengthMultiplier, 3);
}

export function percentToModifier(percent: number): number {
  return roundAwayFromZero(clamp(percent, 25, 200) / 100.0, 2);
}

export function effectiveGuardRandomization(guardRandomization: number, advancedEnabled: boolean): number {
  if (!advancedEnabled) return DEFAULT_GUARD_RANDOMIZATION;
  if (Number.isNaN(guardRandomization) || !Number.isFinite(guardRandomization)) {
    return DEFAULT_GUARD_RANDOMIZATION;
  }
  return roundAwayFromZero(clamp(guardRandomization, 0.0, 0.5), 3);
}

/**
 * Множитель для значений контента в зависимости от размера зоны.
 * Референсная база: карта 160×160 с 4 зонами (6400 тайлов/зона → scale 1.0).
 * sqrt смягчает кривую; кламп [0.5, 2.5].
 */
export function computeContentScale(mapSize: number, totalZones: number): number {
  const referenceArea = 160.0 * 160.0 / 4.0; // 6400
  const zoneArea = (mapSize * mapSize) / Math.max(1, totalZones);
  return clamp(Math.sqrt(zoneArea / referenceArea), 0.5, 2.5);
}

export function normalizeZoneSize(zoneSize: number): number {
  if (Number.isNaN(zoneSize) || !Number.isFinite(zoneSize)) return 1.0;
  return roundAwayFromZero(clamp(zoneSize, 0.1, 2.0), 2);
}

/**
 * Разрешение выбранного GuardReactionPreset в 6-корзинный недельный массив
 * либо null — оставить генераторные дефолты по типам зон.
 */
export function resolveGuardReactionOverride(gr: GuardReactionSettings | null | undefined): number[] | null {
  if (!gr) return null;
  const preset: GuardReactionPreset = gr.preset;
  switch (preset) {
    case "Default":
      return null;
    case "FrontLoaded":
      return [60, 20, 10, 10, 2, 0];
    case "Even":
      return [10, 10, 10, 10, 10, 10];
    case "BackLoaded":
      return [0, 2, 10, 20, 30, 40];
    case "Custom":
      return gr.customDistribution.length === 6 && gr.customDistribution.every((v) => v >= 0)
        ? [...gr.customDistribution]
        : null;
    default:
      return null;
  }
}

/** Формат C# ToString("0.###", InvariantCulture): до трёх знаков, без хвостовых нулей. */
export function formatUnitMultiplier(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
