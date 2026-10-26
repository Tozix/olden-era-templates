import { UserPresetStore, MemoryUserPresetStorage, LocalStorageUserPresetStorage } from "../generator/userPresetStore";
import { isTauri } from "../platform";
import {
  userPresetsDir,
  ensureDirRecursive,
  readTextFile,
  writeTextFile,
  exists,
} from "../desktop/bridge";

/**
 * Файловое хранилище пользовательских пресетов поверх Tauri fs
 * (порт %LocalAppData%-хранилища WPF на appData всех ОС).
 */
class TauriUserPresetStorage {
  async dir(): Promise<string> {
    const dir = await userPresetsDir();
    await ensureDirRecursive(dir);
    return dir;
  }

  async #file(name: string): Promise<{ dir: string; path: string }> {
    const { escapePresetName } = await import("../generator/userPresetStore");
    const dir = await this.dir();
    const { join } = await import("@tauri-apps/api/path");
    return { dir, path: await join(dir, `${escapePresetName(name)}.oetgs`) };
  }

  async listNames(): Promise<string[]> {
    if (!isTauri()) return [];
    try {
      const { dir, path } = await this.#file("");
      void path;
      const fs = await import("@tauri-apps/plugin-fs");
      const { unescapePresetName } = await import("../generator/userPresetStore");
      const entries = await fs.readDir(dir);
      return entries
        .filter((e) => e.name?.toLowerCase().endsWith(".oetgs"))
        .map((e) => unescapePresetName(e.name!.replace(/\.oetgs$/i, "")))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  async read(name: string): Promise<string | null> {
    if (!isTauri()) return null;
    const { path } = await this.#file(name);
    if (!(await exists(path))) return null;
    return readTextFile(path);
  }

  async write(name: string, json: string): Promise<void> {
    const { path } = await this.#file(name);
    await writeTextFile(path, json);
  }

  async delete(name: string): Promise<void> {
    if (!isTauri()) return;
    const { path } = await this.#file(name);
    if (!(await exists(path))) return;
    const fs = await import("@tauri-apps/plugin-fs");
    await fs.remove(path);
  }
}

function makeStorage() {
  if (isTauri()) return new TauriUserPresetStorage();
  if (typeof localStorage !== "undefined") return new LocalStorageUserPresetStorage();
  return new MemoryUserPresetStorage();
}

export const userPresetStore = new UserPresetStore(makeStorage());
