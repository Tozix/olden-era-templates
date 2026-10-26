import { create } from "zustand";
import { defaultSettingsFile, type SettingsFile } from "../generator/settingsFile";
import { fromFile } from "../generator/settingsMapper";
import { validate, type ValidationIssue, type ValidationFix, applyValidationFix } from "../generator/settingsValidator";
import { toJsonCompact, parseSettingsFile } from "../generator/json";
import { EditHistory } from "../generator/editHistory";
import type { GeneratorSettings } from "../generator/settings";
import type { RmgTemplate } from "../generator/template";

/**
 * Каноническое состояние UI — SettingsFile (формат .oetgs 1:1):
 * undo/redo, автосохранение, пресеты и share-код работают с ним без потерь.
 * GeneratorSettings выводится через fromFile при генерации/валидации.
 */

export interface AppStore {
  file: SettingsFile;
  issues: ValidationIssue[];
  history: EditHistory;
  dirty: boolean;
  // результат последней генерации
  template: RmgTemplate | null;
  previewDataUrl: string | null;
  previewBytes: Uint8Array | null;
  generating: boolean;

  settings: () => GeneratorSettings;
  issuesForField: (fieldKey: string) => ValidationIssue[];
  hasBlocker: (fieldKey: string) => boolean;

  /** Мутирует одно/несколько полей file; пушит undo-снапшот. */
  patch: (mutator: (f: SettingsFile) => void) => void;
  loadFileJson: (json: string) => boolean;
  loadFile: (f: SettingsFile) => void;
  resetToDefaults: () => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  applyFix: (fix: ValidationFix) => void;
  setGenerating: (on: boolean) => void;
  setGenerationResult: (template: RmgTemplate, dataUrl: string, bytes: Uint8Array) => void;
}

function computeIssues(file: SettingsFile): ValidationIssue[] {
  return validate(fromFile(file));
}


export const useApp = create<AppStore>((set, get) => ({
  file: defaultSettingsFile(),
  issues: computeIssues(defaultSettingsFile()),
  history: new EditHistory(),
  dirty: false,
  template: null,
  previewDataUrl: null,
  previewBytes: null,
  generating: false,

  settings: () => fromFile(get().file),
  issuesForField: (fieldKey) => get().issues.filter((i) => i.fieldKey === fieldKey),
  hasBlocker: (fieldKey) => get().issues.some((i) => i.fieldKey === fieldKey && i.severity === "error"),

  patch: (mutator) => {
    const prev = get().file;
    get().history.push(toJsonCompact(prev));
    const next = defaultSettingsFile();
    Object.assign(next, prev);
    mutator(next);
    set({ file: next, issues: computeIssues(next), dirty: true });
  },

  loadFileJson: (json) => {
    try {
      const parsed = parseSettingsFile(json);
      get().loadFile(parsed);
      return true;
    } catch {
      return false;
    }
  },

  loadFile: (f) => {
    get().history.push(toJsonCompact(get().file));
    set({ file: f, issues: computeIssues(f), dirty: true, template: null, previewDataUrl: null, previewBytes: null });
  },

  resetToDefaults: () => {
    get().history.push(toJsonCompact(get().file));
    const f = defaultSettingsFile();
    set({ file: f, issues: computeIssues(f), dirty: true, template: null, previewDataUrl: null, previewBytes: null });
  },

  markSaved: () => set({ dirty: false }),

  undo: () => {
    const current = toJsonCompact(get().file);
    const previous = get().history.tryUndo(current);
    if (previous === null) return;
    const parsed = parseSettingsFile(previous);
    set({ file: parsed, issues: computeIssues(parsed), dirty: true });
  },

  redo: () => {
    const current = toJsonCompact(get().file);
    const next = get().history.tryRedo(current);
    if (next === null) return;
    const parsed = parseSettingsFile(next);
    set({ file: parsed, issues: computeIssues(parsed), dirty: true });
  },

  applyFix: (fix) => {
    const current = fromFile(get().file);
    const fixed = applyValidationFix(current, fix);
    // Конвертируем обратно через toFile-совместимое поле за полем невозможно;
    // применяем фикс прямо к SettingsFile по его kind.
    const prev = get().file;
    get().history.push(toJsonCompact(prev));
    const next = defaultSettingsFile();
    Object.assign(next, prev);
    if (fix.kind === "addNeutralZone") next.neutralZoneCount += 1;
    else if (fix.kind === "switchToHubTopology") {
      next.topology = "HubAndSpoke";
      next.neutralZoneCount = Math.max(0, next.neutralZoneCount);
    } else if (fix.kind === "setDefaultTemplateName") next.templateName = "Custom Template";
    void fixed;
    set({ file: next, issues: computeIssues(next), dirty: true });
  },

  setGenerating: (on) => set({ generating: on }),

  setGenerationResult: (template, dataUrl, bytes) =>
    set({ template, previewDataUrl: dataUrl, previewBytes: bytes }),
}));
