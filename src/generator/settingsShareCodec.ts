import { gzipSync, gunzipSync } from "fflate";
import { MAP_TOPOLOGIES } from "./enums";
import { defaultSettingsFile, type SettingsFile } from "./settingsFile";
import { normalizeSettingsFile, toJsonCompact } from "./json";

/**
 * Кодирует SettingsFile в компактную URL-безопасную строку и декодирует
 * обратно «снисходительно»: неизвестные поля отбрасываются, отсутствующие
 * остаются дефолтными, сбой разбора одного поля не портит весь payload.
 */

/** Жёсткий лимит длины закодированной строки (URL-safety). */
export const MAX_ENCODED_LENGTH = 8 * 1024;
/** Жёсткий лимит размера распакованного JSON (защита от zip-бомбы). */
export const MAX_DECOMPRESSED_BYTES = 64 * 1024;

export type DecodeStatus =
  | "Ok"
  | "Empty"
  | "TooLarge"
  | "MalformedBase64"
  | "MalformedGzip"
  | "MalformedJson"
  | "NotAnObject";

export interface DecodeResult {
  status: DecodeStatus;
  file?: SettingsFile;
}

export function encodeSettings(file: SettingsFile): string {
  // Аналог JsonSerializer.SerializeToUtf8Bytes с WhenWritingNull + camelCase +
  // строковыми enum'ами: toJsonCompact даёт ровно такой JSON.
  const json = toJsonCompact(file);
  const compressed = gzipSync(new TextEncoder().encode(json));
  return base64UrlEncode(compressed);
}

/**
 * Снисходящее декодирование: возвращает SettingsFile со всеми полями, которые
 * удалось разобрать, и дефолтами для остальных. status !== "Ok" для outright
 * failure (пустой ввод, слишком большой payload, битый конверт, не-объект JSON).
 */
export function tryDecodeSettings(encoded: string | null | undefined): DecodeResult {
  if (!encoded || encoded.trim().length === 0) return { status: "Empty" };
  if (encoded.length > MAX_ENCODED_LENGTH) return { status: "TooLarge" };

  let compressed: Uint8Array;
  try {
    compressed = base64UrlDecode(encoded);
  } catch {
    return { status: "MalformedBase64" };
  }

  let jsonBytes: Uint8Array;
  try {
    jsonBytes = gzipDecompressBounded(compressed);
  } catch {
    return { status: "MalformedGzip" };
  }
  if (jsonBytes.length > MAX_DECOMPRESSED_BYTES) return { status: "MalformedGzip" };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    return { status: "MalformedJson" };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: "NotAnObject" };
  }

  return { status: "Ok", file: applyLenient(raw as unknown as Record<string, unknown>) };
}

// ── Снисходящее применение полей ────────────────────────────────────────────

type FieldKind =
  | "boolean"
  | "number"
  | "string"
  | "topology"
  | "booleanOrNull"
  | "numberOrNull"
  | "stringArray"
  | "objectArray"
  | "recordNumber"
  | "objectField";

const NULLABLE_BOOLEAN_KEYS: ReadonlySet<string> = new Set([
  "connectionGuardEscape",
  "connectionSimTurnSquad",
]);

const NULLABLE_NUMBER_KEYS: ReadonlySet<string> = new Set([
  "seed",
  "resourceDensity",
  "structureDensity",
  "contentDensity",
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
  "connectionGuardRandomization",
]);

const STRING_ARRAY_KEYS: ReadonlySet<string> = new Set([
  "heroBans",
  "bannedSpells",
  "globalBans",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fieldKind(key: string, defaultValue: unknown): FieldKind {
  if (key === "topology") return "topology";
  if (NULLABLE_BOOLEAN_KEYS.has(key)) return "booleanOrNull";
  if (NULLABLE_NUMBER_KEYS.has(key)) return "numberOrNull";
  if (typeof defaultValue === "boolean") return "boolean";
  if (typeof defaultValue === "number") return "number";
  if (typeof defaultValue === "string") return "string";
  if (Array.isArray(defaultValue)) {
    return STRING_ARRAY_KEYS.has(key) ? "stringArray" : "objectArray";
  }
  if (key === "bonusResources") return "recordNumber";
  // tierLow/tierMedium/tierHigh/playerZoneContent/neutralZoneContent.
  return "objectField";
}

// Таблица «ключ → ожидаемый тип» выводится из дефолтов SettingsFile (те же
// значения типов, что ждёт System.Text.Json в C#).
const FIELD_KINDS: ReadonlyMap<string, FieldKind> = (() => {
  const defaults = defaultSettingsFile() as unknown as Record<string, unknown>;
  const map = new Map<string, FieldKind>();
  for (const [key, value] of Object.entries(defaults)) {
    map.set(key, fieldKind(key, value));
  }
  return map;
})();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fieldValueOk(kind: FieldKind, value: unknown): boolean {
  switch (kind) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return isFiniteNumber(value);
    case "string":
      return typeof value === "string";
    case "topology": {
      // JsonStringEnumConverter в C# читает имена enum'ов без учёта регистра.
      if (typeof value !== "string") return false;
      const canonical = MAP_TOPOLOGIES.find(
        (t) => t.toLowerCase() === value.toLowerCase(),
      );
      return canonical !== undefined;
    }
    case "booleanOrNull":
      return value === null || typeof value === "boolean";
    case "numberOrNull":
      return value === null || isFiniteNumber(value);
    case "stringArray":
      return Array.isArray(value) && value.every((v) => typeof v === "string");
    case "objectArray":
      return Array.isArray(value) && value.every(isPlainObject);
    case "recordNumber":
      return (
        isPlainObject(value) &&
        Object.values(value).every((v) => isFiniteNumber(v))
      );
    case "objectField":
      return isPlainObject(value);
  }
}

/**
 * Слепок C# ApplyLenient: сначала «целый» разбор — если все присутствующие
 * известные поля типографски валидны, мержим как есть (неизвестные ключи
 * normalizeSettingsFile отбрасывает). Иначе — восстановления по одному полю:
 * битое поле пропускается, остальные применяются поверх дефолтов.
 */
function applyLenient(obj: Record<string, unknown>): SettingsFile {
  let wholeOk = true;
  for (const [key, value] of Object.entries(obj)) {
    const kind = FIELD_KINDS.get(key);
    if (kind === undefined || !fieldValueOk(kind, value)) {
      wholeOk = false;
      break;
    }
  }
  if (wholeOk) {
    const merged = normalizeSettingsFile(obj);
    // JsonStringEnumConverter в C# разбирает имя enum'а без учёта регистра и
    // при обратной записи выдаёт каноническое написание — нормализуем.
    const rawTopology = obj["topology"];
    if (typeof rawTopology === "string") {
      merged.topology =
        MAP_TOPOLOGIES.find((t) => t.toLowerCase() === rawTopology.toLowerCase()) ??
        merged.topology;
    }
    return merged;
  }

  const result = defaultSettingsFile() as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const kind = FIELD_KINDS.get(key);
    if (kind === undefined) continue; // неизвестное поле — отбросить
    if (!fieldValueOk(kind, value)) continue; // битое поле — пропустить и идти дальше
    if (kind === "topology") {
      const canonical = MAP_TOPOLOGIES.find(
        (t) => t.toLowerCase() === (value as string).toLowerCase(),
      );
      result[key] = canonical as string;
    } else {
      result[key] = value;
    }
  }
  return result as unknown as SettingsFile;
}

// ── Байт-конверты ───────────────────────────────────────────────────────────

function gzipDecompressBounded(compressed: Uint8Array): Uint8Array {
  // fflate обрезает вывод под размер переданного `out`-буфера, поэтому буфер
  // MAX+1 детектирует превышение лимита, не выделяя память под весь payload.
  const out = new Uint8Array(MAX_DECOMPRESSED_BYTES + 1);
  return gunzipSync(compressed, { out });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  let padded = s.replace(/-/g, "+").replace(/_/g, "/");
  switch (padded.length % 4) {
    case 2: padded += "=="; break;
    case 3: padded += "="; break;
    case 1: throw new Error("Некорректная длина base64url.");
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
