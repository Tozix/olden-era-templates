import { useApp } from "./settingsStore";
import { generate } from "../generator/templateGenerator";
import { renderPreview } from "../generator/renderer";
import { fromFile } from "../generator/settingsMapper";
import type { RmgTemplate } from "../generator/template";

export interface GenerationOutcome {
  ok: boolean;
  blockers?: string[];
  summary?: string;
  error?: string;
  template?: RmgTemplate;
}

/**
 * Единая точка генерации (кнопка «Сгенерировать», сохранение, AI-инструмент
 * generate_map): валидация блокеров → generate → renderPreview → стор.
 */
export async function runGeneration(): Promise<GenerationOutcome> {
  const state = useApp.getState();
  const settings = fromFile(state.file);
  const blockers = state.issues
    .filter((i) => i.severity === "error")
    .map((i) => i.message);
  if (blockers.length > 0) {
    return { ok: false, blockers };
  }
  state.setGenerating(true);
  try {
    const template = generate(settings);
    const rendered = await renderPreview(template, settings.topology);
    useApp.getState().setGenerationResult(template, rendered.dataUrl, rendered.bytes);
    const variant = template.variants?.[0];
    const zoneCount = variant?.zones?.length ?? 0;
    const connectionCount = variant?.connections?.length ?? 0;
    return {
      ok: true,
      template,
      summary: `Шаблон «${template.name}»: игроков ${settings.playerCount}, размер ${settings.mapSize}, зон ${zoneCount}, связей ${connectionCount}, seed ${settings.seed ?? "случайный"}.`,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    useApp.getState().setGenerating(false);
  }
}
