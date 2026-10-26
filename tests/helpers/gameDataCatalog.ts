import fs from "node:fs";
import path from "node:path";
import { contentListsAll, generalResourcePoolsAll } from "../../src/generator/knownIds";

/**
 * Ин-memory индекс всех IDable-записей из GameData/GeneratorData/: по одной
 * записи на поле `name` в JSON-файлах каталогов content_pools, content_lists,
 * zone_layouts и encounter_templates. Только для чтения после построения;
 * используется тестами (и хостами) чтобы проверять, что ID, эмитируемые
 * генератором или выбранные пользователем, вообще существуют в данных игры.
 *
 * Тест-only модуль: импортирует node:fs и потому не должен попадать в бандл
 * приложения (требуется @types/node для тайпчека).
 */

export type GameDataCategory =
  | "ContentPool"
  | "ContentList"
  | "ZoneLayout"
  | "EncounterTemplate";

export const GAME_DATA_CATEGORIES: readonly GameDataCategory[] = [
  "ContentPool",
  "ContentList",
  "ZoneLayout",
  "EncounterTemplate",
];

const FOLDER_TO_CATEGORY: Readonly<Record<string, GameDataCategory>> = {
  content_pools: "ContentPool",
  content_lists: "ContentList",
  zone_layouts: "ZoneLayout",
  encounter_templates: "EncounterTemplate",
};

export interface GameDataCatalog {
  readonly pools: ReadonlySet<string>;
  readonly contentLists: ReadonlySet<string>;
  readonly zoneLayouts: ReadonlySet<string>;
  readonly encounterTemplates: ReadonlySet<string>;
  contains(category: GameDataCategory, id: string): boolean;
}

function newByCategory(): Map<GameDataCategory, Set<string>> {
  return new Map(GAME_DATA_CATEGORIES.map((c) => [c, new Set<string>()]));
}

/** Собирает значения поля `name` (строки) из корневого JSON-массива. */
function harvestNamesFromArray(json: string, sink: Set<string>): void {
  const doc: unknown = JSON.parse(json); // битый JSON бросает — как JsonDocument.Parse в C#
  if (!Array.isArray(doc)) return;

  for (const element of doc) {
    if (!element || typeof element !== "object" || Array.isArray(element)) continue;
    const name = (element as Record<string, unknown>)["name"];
    if (typeof name === "string" && name.length > 0) sink.add(name);
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Рекурсивный обход каталога с сбором *.json (аналог EnumerateFiles(AllDirectories)). */
function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) out.push(full);
    }
  }
  return out;
}

function catalogFrom(byCategory: Map<GameDataCategory, Set<string>>): GameDataCatalog {
  return {
    get pools() {
      return byCategory.get("ContentPool") as ReadonlySet<string>;
    },
    get contentLists() {
      return byCategory.get("ContentList") as ReadonlySet<string>;
    },
    get zoneLayouts() {
      return byCategory.get("ZoneLayout") as ReadonlySet<string>;
    },
    get encounterTemplates() {
      return byCategory.get("EncounterTemplate") as ReadonlySet<string>;
    },
    contains(category: GameDataCategory, id: string): boolean {
      return (byCategory.get(category) as Set<string>).has(id);
    },
  };
}

/**
 * Загружает каталог из дерева каталогов с подпапками content_pools/,
 * content_lists/, zone_layouts/ и encounter_templates/. Отсутствующие
 * подпапки tolerated.
 */
export function loadFromDirectory(generatorDataRoot: string): GameDataCatalog {
  if (!isDirectory(generatorDataRoot)) {
    throw new Error(`Корневой каталог GameData не найден: ${generatorDataRoot}`);
  }

  const byCategory = newByCategory();
  for (const [folder, category] of Object.entries(FOLDER_TO_CATEGORY)) {
    const dir = path.join(generatorDataRoot, folder);
    if (!isDirectory(dir)) continue;
    const sink = byCategory.get(category) as Set<string>;
    for (const file of walkJsonFiles(dir)) {
      harvestNamesFromArray(fs.readFileSync(file, "utf8"), sink);
    }
  }
  return catalogFrom(byCategory);
}

/**
 * Загружает каталог из последовательности готовых JSON-строк с тегом категории
 * (аналог LoadFromStreams для хостов, читающих файлы не с диска).
 */
export function loadFromSources(
  sources: Array<{ category: GameDataCategory; json: string }>,
): GameDataCatalog {
  const byCategory = newByCategory();
  for (const source of sources) {
    harvestNamesFromArray(source.json, byCategory.get(source.category) as Set<string>);
  }
  return catalogFrom(byCategory);
}

/**
 * Аналог KnownIds.ValidateAgainst: id, на которые генератор ссылается
 * строковыми литералами, обязаны существовать в отгружаемых данных игры.
 * Inline-раскладки зон (Spawn/Sides/TreasureZone/Center) сознательно не
 * проверяются: они template-local, в GameData их нет.
 */
export function knownIdsValidateAgainst(catalog: GameDataCatalog): string[] {
  const missing: string[] = [];
  for (const id of generalResourcePoolsAll()) {
    if (!catalog.contains("ContentPool", id)) missing.push(`ContentPool:${id}`);
  }
  for (const id of contentListsAll()) {
    if (!catalog.contains("ContentList", id)) missing.push(`ContentList:${id}`);
  }
  return missing;
}
