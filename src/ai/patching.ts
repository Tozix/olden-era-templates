import { defaultSettingsFile, type SettingsFile } from "../generator/settingsFile";

export interface PatchResult {
  applied: string[];
  ignored: string[];
}

const KNOWN_KEYS = new Set(Object.keys(defaultSettingsFile()));

function coerce(key: string, value: unknown): boolean {
  const expected = (defaultSettingsFile() as unknown as Record<string, unknown>)[key];
  if (typeof value === "number" && typeof expected === "number") return Number.isFinite(value);
  if (typeof value === "boolean" && typeof expected === "boolean") return true;
  if (typeof value === "string" && typeof expected === "string") return true;
  if ((value === null || value === undefined) && (expected === null || expected === undefined)) return true;
  // null в nullable-полях (seed, borderCornerRadius и т.п.)
  if (value === null) {
    const d = defaultSettingsFile() as unknown as Record<string, unknown>;
    const hasNullable = Object.prototype.hasOwnProperty.call(d, key) && d[key] === null;
    const nullableByUse = [
      "seed",
      "resourceDensity",
      "structureDensity",
      "borderCornerRadius",
      "borderObstaclesWidth",
      "zoneDiplomacyModifier",
      "zoneCrossroadsPosition",
      "zoneGuardCutoffValue",
      "zoneGuardMultiplier",
      "zoneGuardRandomization",
      "zoneResourcesValue",
      "zoneResourcesValuePerArea",
      "zoneGuardedContentValue",
      "zoneGuardedContentValuePerArea",
      "zoneUnguardedContentValue",
      "zoneUnguardedContentValuePerArea",
      "connectionGuardEscape",
      "connectionSimTurnSquad",
      "connectionGuardRandomization",
      "roadDistance",
      "contentDensity",
    ];
    return hasNullable || nullableByUse.includes(key);
  }
  if (Array.isArray(value) && Array.isArray(expected)) {
    // массивы известного типа: строки / числа / bool / объекты
    if (value.every((x) => typeof x === "string")) return true;
    if (value.every((x) => typeof x === "number")) return true;
    if (value.every((x) => typeof x === "boolean")) return true;
    if (value.every((x) => x && typeof x === "object" && !Array.isArray(x))) return true;
    return false;
  }
  if (value && typeof value === "object" && expected && typeof expected === "object" && !Array.isArray(expected)) {
    return true;
  }
  return false;
}

/**
 * Безопасное применение патча ассистента: только известные ключи, только
 * типы, совпадающие с моделью SettingsFile. Ничего не бросает — отчёт в ответе.
 * Возвращает НОВЫЙ объект; исходный file не мутируется.
 */
export function applySettingsPatch(file: SettingsFile, patch: unknown): { file: SettingsFile; result: PatchResult } {
  const result: PatchResult = { applied: [], ignored: [] };
  const next = { ...file } as SettingsFile;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { file: next, result };
  }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (!KNOWN_KEYS.has(key) || !coerce(key, value)) {
      result.ignored.push(key);
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = value;
    result.applied.push(key);
  }
  return { file: next, result };
}
