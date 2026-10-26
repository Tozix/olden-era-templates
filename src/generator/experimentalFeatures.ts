import type { ExperimentalStatus } from "./enums";

/** Реестр per-feature экспериментальных флагов (T-302). Не персистится. */

export interface ExperimentalFeature {
  key: string;
  titleRu: string;
  descriptionRu: string;
  status: ExperimentalStatus;
}

export const EXP_GAME_MODE = "game-mode";
export const EXP_STARTING_BONUSES = "starting-bonuses";
export const EXP_ZONE_CONTENT = "zone-content";
export const EXP_BORDERS_ROADS = "borders-roads";
export const EXP_PER_TIER_OVERRIDES = "per-tier-overrides";

export const EXPERIMENTAL_FEATURES: ExperimentalFeature[] = [
  {
    key: EXP_GAME_MODE,
    titleRu: "Режим игры",
    descriptionRu: "Одиночный герой / запрет найма / правки дезертирства.",
    status: "Experimental",
  },
  {
    key: EXP_STARTING_BONUSES,
    titleRu: "Стартовые бонусы",
    descriptionRu: "Ресурсы, характеристики героя, предметы, заклинания и множители юнитов.",
    status: "Experimental",
  },
  {
    key: EXP_ZONE_CONTENT,
    titleRu: "Контент зон",
    descriptionRu: "Переопределения биома / пула / отсечки стражи / ям сражений по зонам.",
    status: "Experimental",
  },
  {
    key: EXP_BORDERS_ROADS,
    titleRu: "Границы и дороги карты",
    descriptionRu: "Радиус скругления границы, водная граница, тип дорог.",
    status: "Experimental",
  },
  {
    key: EXP_PER_TIER_OVERRIDES,
    titleRu: "Переопределения по уровням",
    descriptionRu: "Пресеты зданий и рост стражи для каждого уровня нейтральных зон.",
    status: "Experimental",
  },
];

export function getExperimentalFeature(key: string): ExperimentalFeature {
  const found = EXPERIMENTAL_FEATURES.find((f) => f.key === key);
  if (!found) throw new Error(`Неизвестный ключ экспериментальной фичи: ${key}`);
  return found;
}
