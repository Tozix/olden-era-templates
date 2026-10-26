import {
  defaultSettingsFile,
  type SettingsFile,
} from "./settingsFile";

/**
 * JSON-эмит в стиле System.Text.Json (WriteIndented, WhenWritingNull):
 * null/undefined-поля рекурсивно отбрасываются, вывод — 2 пробела отступа.
 * Порядок ключей = порядок вставки (как в C#-моделях, если объекты строить
 * в том же порядке) — это делает вывод детерминированным.
 */

export function stripNullsDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripNullsDeep(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      // Аналог [JsonIgnore]: позиция для рендера не сериализуется.
      if (k === "generatorPosition") continue;
      out[k] = stripNullsDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** Сериализация шаблона/настроек в indented JSON (аналог JsonSerializer.Serialize(options)). */
export function toJsonIndented(value: unknown): string {
  return JSON.stringify(stripNullsDeep(value), null, 2);
}

/** Компактная сериализация (share-кодек: non-indented). */
export function toJsonCompact(value: unknown): string {
  return JSON.stringify(stripNullsDeep(value));
}

/**
 * Линейный (case-insensitive) разбор .oetgs/пресета: JSON.parse + слияние
 * поверх дефолтов. Неизвестные ключи игнорируются, отсутствующие остаются
 * дефолтными — соответствует поведению System.Text.Json с
 * PropertyNameCaseInsensitive = true и C#-дефолтами свойств.
 */
export function parseSettingsFile(text: string): SettingsFile {
  const raw = JSON.parse(text) as Record<string, unknown>;
  return normalizeSettingsFile(raw);
}

export function normalizeSettingsFile(raw: Record<string, unknown>): SettingsFile {
  const result = defaultSettingsFile() as unknown as Record<string, unknown>;
  const lookup = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) {
    lookup.set(k.toLowerCase(), v);
  }
  for (const key of Object.keys(defaultSettingsFile())) {
    const v = lookup.get(key.toLowerCase());
    if (v === undefined) continue;
    result[key] = v;
  }
  return result as unknown as SettingsFile;
}
