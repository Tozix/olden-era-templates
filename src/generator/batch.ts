import type { MapTopology } from "./enums";
import { ALL_MAP_SIZES } from "./knownValues";
import { Rng } from "./rng";
import { generateMapNames } from "./nameGen";
import type { GeneratorSettings } from "./settings";
import { generate } from "./templateGenerator";
import type { RmgTemplate } from "./template";

/**
 * Пакетная генерация: N разных карт из общих настроек с разбросом
 * размера / топологии / числа игроков. Каждая карта детерминирована
 * своим seed'ом; имена — осмысленные RU, описание строит сам генератор.
 */

export interface BatchParams {
  count: number;
  sizeMin: number;
  sizeMax: number;
  topologies: MapTopology[];
  playersMin: number;
  playersMax: number;
  /** Первый seed партии; null = случайные сиды. */
  baseSeed?: number | null;
  /** Seed генератора названий; null = случайные. */
  nameSeed?: number | null;
}

export interface BatchMap {
  fileName: string; // «Имя.rmg.json»
  name: string;
  template: RmgTemplate;
  settings: GeneratorSettings;
  topology: MapTopology;
  playerCount: number;
  mapSize: number;
  seed: number;
}

const SIZES_SORTED = [...ALL_MAP_SIZES].sort((a, b) => a - b);

function sizesInRange(min: number, max: number): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const inRange = SIZES_SORTED.filter((s) => s >= lo && s <= hi);
  // Если диапазон не накрыл ни одного стандартного размера — берём ближайшие.
  if (inRange.length === 0) {
    const closest = SIZES_SORTED.reduce((a, b) =>
      Math.abs(b - (lo + hi) / 2) < Math.abs(a - (lo + hi) / 2) ? b : a,
    );
    return [closest];
  }
  return inRange;
}

/** Строит план партии: разные настройки + сгенерированные шаблоны. Бросает при пустом пуле топологий. */
export function planBatch(base: GeneratorSettings, params: BatchParams): BatchMap[] {
  if (params.topologies.length === 0) throw new Error("Выберите хотя бы одну топологию");
  if (params.count < 1) throw new Error("Количество карт должно быть ≥ 1");

  const rng = new Rng(params.baseSeed ?? null);
  const nameRng = new Rng(params.nameSeed ?? null);
  const sizes = sizesInRange(params.sizeMin, params.sizeMax);
  const names = generateMapNames(params.count, nameRng);

  const playersLo = Math.max(2, Math.min(params.playersMin, params.playersMax));
  const playersHi = Math.min(8, Math.max(params.playersMin, params.playersMax));

  const maps: BatchMap[] = [];
  for (let i = 0; i < params.count; i++) {
    const seed =
      params.baseSeed !== null && params.baseSeed !== undefined
        ? (params.baseSeed + i) % 2147483647
        : rng.nextIntFull();
    const settings: GeneratorSettings = {
      ...structuredClone(base),
      templateName: names[i],
      description: "", // авто-описание по характеристикам
      displayWinCondition: "",
      seed,
      mapSize: sizes[rng.nextInt(sizes.length)],
      topology: params.topologies[rng.nextInt(params.topologies.length)],
      playerCount:
        playersLo === playersHi ? playersLo : rng.nextIntInclusive(playersLo, playersHi),
    };
    const template = generate(settings);
    maps.push({
      fileName: `${settings.templateName}.rmg.json`,
      name: settings.templateName,
      template,
      settings,
      topology: settings.topology,
      playerCount: settings.playerCount,
      mapSize: settings.mapSize,
      seed,
    });
  }
  return maps;
}
