import manifestJson from "../data/presets/presets.json";
import { parseSettingsFile } from "./json";
import type { SettingsFile } from "./settingsFile";

/**
 * Каталог встроенных пресетов шаблонов (аналог C# PresetCatalog): манифест
 * presets.json + файлы .oetgs/.json в src/data/presets/. Файлы инлайнятся в
 * бандл через Vite glob raw-импорты; сетевой загрузки нет.
 */

export interface PresetEntry {
  id: string;
  name: string;
  description: string;
  file: string;
}

const oetgsFiles = import.meta.glob("../data/presets/*.oetgs", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// *.json в каталоге пресетов — это либо сам манифест, либо пресет в json-форме;
// манифест импортируется напрямую и из glob-результата исключается.
const jsonFiles = import.meta.glob("../data/presets/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

const presetFileText = new Map<string, string>();
for (const [path, text] of Object.entries(oetgsFiles)) {
  presetFileText.set(basename(path), text);
}
for (const [path, text] of Object.entries(jsonFiles)) {
  const name = basename(path);
  if (name !== "presets.json") presetFileText.set(name, text);
}

const manifest = manifestJson as PresetEntry[];
const entries: PresetEntry[] = manifest.map((e) => ({
  id: e.id,
  name: e.name,
  description: e.description,
  file: e.file,
}));

export const presetCatalog = {
  /** Все пресеты в порядке манифеста. */
  entries,

  /**
   * Загрузить пресет по id. Разбор — «снисходительный» (case-insensitive
   * слияние поверх дефолтов), как System.Text.Json с
   * PropertyNameCaseInsensitive в C#.
   */
  load(id: string): SettingsFile {
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Нет пресета с id «${id}».`);
    const text = presetFileText.get(entry.file);
    if (text === undefined) {
      throw new Error(`Встроенный пресет «${entry.file}» не найден.`);
    }
    return parseSettingsFile(text);
  },
};
