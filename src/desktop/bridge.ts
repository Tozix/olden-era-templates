/**
 * Мост в Tauri: всё, что требует нативного окружения (диалоги, файлы,
 * steam-детект, автосохранение, updater). В браузере (vite dev без Tauri)
 * функции деградируют на localStorage/заглушки, чтобы UI оставался живым.
 */
import { isTauri } from "../platform";
import { STEAM_APP_ID, STEAM_FOLDER_NAME, TEMPLATES_SUBPATH } from "../generator/steamInfo";

export interface SteamDetectResult {
  path: string | null;
  method: string;
}

export async function detectGameTemplatesDir(): Promise<SteamDetectResult> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke("detect_game_templates_dir")) as SteamDetectResult;
  }
  // Браузер: детект невозможен.
  return { path: null, method: "not_found" };
}

export const steamFallbackHint = `${STEAM_FOLDER_NAME} → ${TEMPLATES_SUBPATH} (Steam AppId ${STEAM_APP_ID})`;

/** Папка пользовательских пресетов: appData/OldenEraTemplates/UserPresets. */
export async function userPresetsDir(): Promise<string> {
  if (isTauri()) {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    return join(await appDataDir(), "OldenEraTemplates", "UserPresets");
  }
  return "";
}

export async function ensureDirRecursive(path: string): Promise<void> {
  if (!isTauri()) return;
  const fs = await import("@tauri-apps/plugin-fs");
  await fs.mkdir(path, { recursive: true });
}

export async function readTextFile(path: string): Promise<string | null> {
  if (!isTauri()) return null;
  const fs = await import("@tauri-apps/plugin-fs");
  return fs.readTextFile(path);
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  if (!isTauri()) return;
  const fs = await import("@tauri-apps/plugin-fs");
  await fs.writeTextFile(path, contents);
}

export async function exists(path: string): Promise<boolean> {
  if (!isTauri()) return false;
  const fs = await import("@tauri-apps/plugin-fs");
  return fs.exists(path);
}

// ── Диалоги ──────────────────────────────────────────────────────────────────

export interface OpenSettingsResult {
  path: string | null;
  json: string | null;
}

export async function openSettingsFileDialog(): Promise<OpenSettingsResult> {
  if (!isTauri()) return { path: null, json: null };
  const dialog = await import("@tauri-apps/plugin-dialog");
  const picked = await dialog.open({
    title: "Открыть настройки шаблона",
    filters: [{ name: "Настройки шаблона", extensions: ["oetgs", "json"] }],
    multiple: false,
  });
  if (typeof picked !== "string") return { path: null, json: null };
  const json = await readTextFile(picked);
  return { path: picked, json };
}

export async function saveSettingsFileDialog(defaultName: string, json: string): Promise<string | null> {
  if (!isTauri()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const picked = await dialog.save({
    title: "Сохранить настройки шаблона",
    defaultPath: `${defaultName || "My Settings"}.oetgs`,
    filters: [{ name: "Настройки шаблона", extensions: ["oetgs"] }],
  });
  if (!picked) return null;
  await writeTextFile(picked, json);
  return picked;
}

export async function saveTemplateFileDialog(
  defaultName: string,
  initialDir: string | null,
): Promise<string | null> {
  if (!isTauri()) return null;
  const dialog = await import("@tauri-apps/plugin-dialog");
  const base = `${defaultName || "Custom Template"}.rmg.json`;
  const defaultPath = initialDir
    ? await (async () => {
        const { join } = await import("@tauri-apps/api/path");
        return join(initialDir, base);
      })()
    : base;
  const picked = await dialog.save({
    title: "Сохранить сгенерированный шаблон",
    defaultPath,
    filters: [{ name: "Шаблон RMG", extensions: ["json"] }],
  });
  return picked ?? null;
}

// ── Автосохранение настроек ─────────────────────────────────────────────────

const SETTINGS_AUTOSAVE_FILE = () =>
  Promise.resolve().then(async () => {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    return join(await appDataDir(), "OldenEraTemplates", "settings.json");
  });

const LS_KEY = "oldenEra.settings";

export async function loadAutosavedSettings(): Promise<string | null> {
  if (isTauri()) {
    try {
      const path = await SETTINGS_AUTOSAVE_FILE();
      if (await exists(path)) return readTextFile(path);
    } catch {
      /* деградация — ниже localStorage */
    }
  }
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export async function saveAutosavedSettings(json: string): Promise<void> {
  if (isTauri()) {
    try {
      const path = await SETTINGS_AUTOSAVE_FILE();
      await ensureDirRecursive(path.slice(0, path.lastIndexOf("/")));
      await writeTextFile(path, json);
      return;
    } catch {
      /* fallthrough */
    }
  }
  try {
    localStorage.setItem(LS_KEY, json);
  } catch {
    /* приватный режим — молча */
  }
}

// ── Обновления ───────────────────────────────────────────────────────────────

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  notes?: string;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isTauri()) return { available: false };
  try {
    const upd = await import("@tauri-apps/plugin-updater");
    const update = await upd.check();
    if (update) {
      return { available: true, version: update.version, notes: update.body };
    }
    return { available: false };
  } catch {
    // updater не сконфигурирован (нет pubkey) или нет сети
    return { available: false };
  }
}

export async function installUpdate(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const upd = await import("@tauri-apps/plugin-updater");
    const update = await upd.check();
    if (!update) return false;
    await update.downloadAndInstall();
    const proc = await import("@tauri-apps/plugin-process");
    proc.relaunch();
    return true;
  } catch {
    return false;
  }
}

/** Открыть страницу релизов в браузере. */
export async function openReleasesPage(): Promise<void> {
  const opener = await import("@tauri-apps/plugin-opener");
  await opener.openUrl("https://github.com/rannes/olden-era-templates/releases/latest");
}

// ── Конфиг AI-ассистента (appData/ai-config.json; ключ не покидает машину) ──

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const defaultAiConfig = (): AiConfig => ({
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
});

const AI_CONFIG_FILE = () =>
  Promise.resolve().then(async () => {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    return join(await appDataDir(), "OldenEraTemplates", "ai-config.json");
  });

const AI_LS_KEY = "oldenEra.aiConfig";

export async function loadAiConfig(): Promise<AiConfig> {
  const base = defaultAiConfig();
  let raw: string | null = null;
  if (isTauri()) {
    try {
      const path = await AI_CONFIG_FILE();
      if (await exists(path)) raw = await readTextFile(path);
    } catch {
      /* fallthrough to localStorage */
    }
  }
  if (raw === null) {
    try {
      raw = localStorage.getItem(AI_LS_KEY);
    } catch {
      raw = null;
    }
  }
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const json = JSON.stringify(config);
  if (isTauri()) {
    try {
      const path = await AI_CONFIG_FILE();
      await ensureDirRecursive(path.slice(0, path.lastIndexOf("/")));
      await writeTextFile(path, json);
      return;
    } catch {
      /* fallthrough */
    }
  }
  try {
    localStorage.setItem(AI_LS_KEY, json);
  } catch {
    /* приватный режим — молча */
  }
}
