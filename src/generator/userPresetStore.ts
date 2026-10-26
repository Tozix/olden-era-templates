import { parseSettingsFile, toJsonCompact } from "./json";
import type { SettingsFile } from "./settingsFile";

/**
 * Хранение именованных пользовательских пресетов (T-807). Не зависит от
 * PresetCatalog: встроенные пресеты живут в бандле, пользовательские — в
 * локальном хранилище хоста (localStorage в браузере, файлы в Tauri).
 */

/** Один именованный пользовательский пресет. */
export interface UserPresetEntry {
  name: string;
}

/**
 * Подключаемое хранилище для UserPresetStore: браузер/хост поставляет свою
 * реализацию. Реализации только перемещают строки — форму JSON ведёт store.
 */
export interface UserPresetStorage {
  listNames(): Promise<string[]>;
  read(name: string): Promise<string | null>;
  write(name: string, json: string): Promise<void>;
  delete(name: string): Promise<void>;
}

/** Максимальная длина имени пресета (против патологически длинных ключей). */
export const MAX_PRESET_NAME_LENGTH = 64;

/** Приводит свободный ввод к сохраняемому имени: trim + clamp до 64 символов. */
export function normalizePresetName(raw?: string | null): string {
  if (!raw || raw.trim().length === 0) return "";
  const trimmed = raw.trim();
  return trimmed.length > MAX_PRESET_NAME_LENGTH
    ? trimmed.slice(0, MAX_PRESET_NAME_LENGTH)
    : trimmed;
}

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error("Имя пресета не может быть пустым.");
  }
  if (name.length > MAX_PRESET_NAME_LENGTH) {
    throw new Error(`Имя пресета не может превышать ${MAX_PRESET_NAME_LENGTH} символов.`);
  }
}

// ── Имя ↔ имя файла ─────────────────────────────────────────────────────────
// Hex-экранирование всего, что не входит в [A-Za-z0-9 _-]. Стабильно,
// обратимо, без коллизий: раскладка на диске не зависит от правил ОС.

const SAFE_BYTE = (b: number): boolean =>
  (b >= 0x41 && b <= 0x5a) || // A-Z
  (b >= 0x61 && b <= 0x7a) || // a-z
  (b >= 0x30 && b <= 0x39) || // 0-9
  b === 0x20 || // ' '
  b === 0x5f || // '_'
  b === 0x2d; // '-'

/** Закодировать имя в безопасное для файловой системы имя файла (без расширения). */
export function escapePresetName(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let out = "";
  for (const b of bytes) {
    if (SAFE_BYTE(b)) out += String.fromCharCode(b);
    else out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

/** Развернуть закодированное имя файла обратно в отображаемое имя. */
export function unescapePresetName(encoded: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i];
    const hex = i + 2 < encoded.length ? encoded.slice(i + 1, i + 3) : "";
    if (c === "%" && /^[0-9a-fA-F]{2}$/.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(c));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ── Хранилища ───────────────────────────────────────────────────────────────

/** In-memory хранилище — для тестов и офлайн-сценариев. */
export class MemoryUserPresetStorage implements UserPresetStorage {
  private readonly files = new Map<string, string>();

  async listNames(): Promise<string[]> {
    return [...this.files.keys()];
  }

  async read(name: string): Promise<string | null> {
    return this.files.get(name) ?? null;
  }

  async write(name: string, json: string): Promise<void> {
    this.files.set(name, json);
  }

  async delete(name: string): Promise<void> {
    this.files.delete(name);
  }
}

const LOCAL_STORAGE_KEY = "oe-user-presets";

/** localStorage-хранилище браузерного хоста: ключ "oe-user-presets" = {name: json}. */
export class LocalStorageUserPresetStorage implements UserPresetStorage {
  private localStorage(): Storage {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) throw new Error("localStorage недоступен в этом окружении.");
    return ls;
  }

  private readAll(): Record<string, string> {
    let raw: string | null = null;
    try {
      raw = this.localStorage().getItem(LOCAL_STORAGE_KEY);
    } catch {
      return {};
    }
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private writeAll(map: Record<string, string>): void {
    this.localStorage().setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  }

  async listNames(): Promise<string[]> {
    return Object.keys(this.readAll());
  }

  async read(name: string): Promise<string | null> {
    return this.readAll()[name] ?? null;
  }

  async write(name: string, json: string): Promise<void> {
    const map = this.readAll();
    map[name] = json;
    this.writeAll(map);
  }

  async delete(name: string): Promise<void> {
    const map = this.readAll();
    if (name in map) {
      delete map[name];
      this.writeAll(map);
    }
  }
}

/**
 * Персистенция именованных пользовательских пресетов. Форму JSON ведёт store,
 * хранилище только перемещает строки.
 */
export class UserPresetStore {
  static readonly MAX_NAME_LENGTH = MAX_PRESET_NAME_LENGTH;

  private readonly storage: UserPresetStorage;

  constructor(storage: UserPresetStorage) {
    this.storage = storage;
  }

  /** Имена пресетов, отсортированные без учёта регистра. */
  async listAsync(): Promise<UserPresetEntry[]> {
    const names = await this.storage.listNames();
    return names
      .filter((n) => n.trim().length > 0)
      .sort((a, b) => {
        const al = a.toLowerCase();
        const bl = b.toLowerCase();
        return al < bl ? -1 : al > bl ? 1 : 0;
      })
      .map((n) => ({ name: n }));
  }

  /** Загрузить пресет по имени; null — если имя пустое или JSON пуст. */
  async loadAsync(name: string): Promise<SettingsFile | null> {
    validateName(name);
    const json = await this.storage.read(name);
    if (!json || json.trim().length === 0) return null;
    return parseSettingsFile(json);
  }

  async saveAsync(name: string, settings: SettingsFile): Promise<void> {
    validateName(name);
    const json = toJsonCompact(settings);
    await this.storage.write(name, json);
  }

  async deleteAsync(name: string): Promise<void> {
    validateName(name);
    await this.storage.delete(name);
  }

  /** Синоним normalizePresetName для паритета с C# UserPresetStore.NormalizeName. */
  static normalizeName(raw?: string | null): string {
    return normalizePresetName(raw);
  }
}
