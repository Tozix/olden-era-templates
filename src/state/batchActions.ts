import { zipSync, strToU8 } from "fflate";
import { useApp } from "./settingsStore";
import { fromFile } from "../generator/settingsMapper";
import { validate } from "../generator/settingsValidator";
import { planBatch, type BatchParams, type BatchMap } from "../generator/batch";
import { generate } from "../generator/templateGenerator";
import { renderPreview } from "../generator/renderer";
import { toJsonIndented } from "../generator/json";
import { sanitizeTemplateName } from "../generator/previewSidecar";
import {
  saveZipFileDialog,
  writeFileBytes,
  revealInFolder,
} from "../desktop/bridge";
import { isTauri } from "../platform";

export interface BatchRunOptions {
  /** Сохранить без диалога по этому пути (режим AI). */
  silentPath?: string;
  includePng: boolean;
  onProgress?: (done: number, total: number, label: string) => void;
}

export interface BatchRunResult {
  ok: boolean;
  error?: string;
  blockers?: string[];
  savedPath?: string;
  /** Короткие сводки по картам (для AI и тостов). */
  maps?: Array<{ name: string; topology: string; players: number; size: number }>;
  zipBytes?: number;
}

/**
 * Пакетная генерация: план (разброс параметров + имена) → генерация и PNG
 * каждой карты → ZIP → диалог сохранения (или тихая запись для AI).
 */
export async function runBatch(params: BatchParams, opts: BatchRunOptions): Promise<BatchRunResult> {
  const app = useApp.getState();
  const base = fromFile(app.file);

  const issues = validate(base);
  const blockers = issues.filter((i) => i.severity === "error").map((i) => i.message);
  if (blockers.length > 0) return { ok: false, blockers };

  let maps: BatchMap[];
  try {
    maps = planBatch(base, params);
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  const files: Record<string, Uint8Array> = {};
  const summaries: BatchRunResult["maps"] = [];

  try {
    for (let i = 0; i < maps.length; i++) {
      const map = maps[i];
      const safeBase = sanitizeTemplateName(map.name);
      opts.onProgress?.(i, maps.length, `${safeBase}: генерация…`);
      const template = generate(map.settings);
      files[`${safeBase}.rmg.json`] = strToU8(toJsonIndented(template));

      if (opts.includePng) {
        opts.onProgress?.(i, maps.length, `${safeBase}: рендер превью…`);
        const rendered = await renderPreview(template, map.settings.topology);
        files[`${safeBase}.png`] = rendered.bytes;
      }

      summaries.push({
        name: map.name,
        topology: map.topology,
        players: map.playerCount,
        size: map.mapSize,
      });
    }
  } catch (e) {
    return { ok: false, error: `Ошибка генерации: ${String(e)}` };
  }

  opts.onProgress?.(maps.length, maps.length, "Упаковка ZIP…");
  const zip = zipSync(files);

  let savedPath: string | null;
  if (opts.silentPath) {
    savedPath = opts.silentPath;
  } else if (isTauri()) {
    savedPath = await saveZipFileDialog("olden-era-maps");
  } else {
    // Браузерный dev-режим: скачивание через <a download>.
    const blob = new Blob([zip as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "olden-era-maps.zip";
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, maps: summaries, zipBytes: zip.length };
  }

  if (!savedPath) return { ok: false, error: "Сохранение отменено" };

  try {
    await writeFileBytes(savedPath, zip);
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  return { ok: true, savedPath, maps: summaries, zipBytes: zip.length };
}

/** Кнопка «Показать в папке» по сохранённому архиву. */
export function revealBatch(path: string): void {
  void revealInFolder(path);
}
