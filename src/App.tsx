import { useEffect, useRef, useState } from "react";
import { T } from "./i18n/ru";
import { useApp } from "./state/settingsStore";
import { isTauri } from "./platform";
import {
  checkForUpdates,
  detectGameTemplatesDir,
  loadAutosavedSettings,
  openReleasesPage,
  openSettingsFileDialog,
  saveAutosavedSettings,
  saveSettingsFileDialog,
  saveTemplateFileDialog,
  writeTextFile,
} from "./desktop/bridge";
import { ToastArea, useToasts, useUndoRedoHotkeys } from "./components/ui";
import { SectionNav, type SectionKey } from "./components/SectionNav";
import { PreviewPanel } from "./components/PreviewPanel";
import { PresetPickerModal } from "./components/PresetPickerModal";
import { encodeSettings, MAX_ENCODED_LENGTH, tryDecodeSettings } from "./generator/settingsShareCodec";
import { toJsonIndented, toJsonCompact } from "./generator/json";
import { sanitizeTemplateName } from "./generator/previewSidecar";
import { getSidecarPath } from "./generator/previewSidecar";
import { runGeneration } from "./state/generationActions";
import { useAssistant } from "./state/assistantStore";
import { AiChatPanel } from "./components/AiChatPanel";
import { MapSettingsPanel } from "./components/panels/MapSettingsPanel";
import { TopologyPanel } from "./components/panels/TopologyPanel";
import { ZonesPanel } from "./components/panels/ZonesPanel";
import { HeroesPanel } from "./components/panels/HeroesPanel";
import { WinConditionsPanel } from "./components/panels/WinConditionsPanel";
import { ExperimentalPanel } from "./components/panels/ExperimentalPanel";

export default function App() {
  const file = useApp((s) => s.file);
  const issues = useApp((s) => s.issues);
  const dirty = useApp((s) => s.dirty);
  const generating = useApp((s) => s.generating);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);
  const resetToDefaults = useApp((s) => s.resetToDefaults);
  const loadFileJson = useApp((s) => s.loadFileJson);
  const markSaved = useApp((s) => s.markSaved);
  const settings = useApp((s) => s.settings);

  const [section, setSection] = useState<SectionKey>("map");
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const steamDir = useRef<string | null>(null);
  const { toasts, push } = useToasts();
  const assistantInit = useAssistant((s) => s.init);
  useUndoRedoHotkeys(undo, redo);

  useEffect(() => {
    void assistantInit();
  }, [assistantInit]);

  const experimentalVisible = useApp((s) => s.experimentalVisible());

  // Автосохранение (debounce 500 мс) — как в веб-версии.
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveAutosavedSettings(toJsonCompact(file));
    }, 500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [file]);

  // Загрузка автосохранения + steam-детект при старте.
  useEffect(() => {
    void (async () => {
      const saved = await loadAutosavedSettings();
      if (saved) loadFileJson(saved);
    })();
    void (async () => {
      const res = await detectGameTemplatesDir();
      steamDir.current = res.path;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockers = issues.filter((i) => i.severity === "error");

  const onGenerate = async () => {
    const res = await runGeneration();
    if (res.blockers?.length) push(T.validationBlockers, "error");
    if (res.error) push(`${T.previewFailed}: ${res.error}`, "error");
  };

  const onSaveTemplate = async () => {
    const state = useApp.getState();
    let template = state.template;
    if (!template) {
      const res = await runGeneration();
      if (!res.ok || !res.template) {
        if (res.blockers?.length) push(T.validationBlockers, "error");
        return;
      }
      template = res.template;
    }
    const name = sanitizeTemplateName(file.templateName);
    const picked = await saveTemplateFileDialog(name, steamDir.current);
    if (!picked) return;
    if (steamDir.current && !picked.startsWith(steamDir.current)) {
      const ok = window.confirm(T.saveTemplateConfirmWrongDir);
      if (!ok) {
        push(T.templateSaveCancelled);
        return;
      }
    }
    await writeTextFile(picked, toJsonIndented(template));
    // PNG-сосед — рядом с шаблоном.
    try {
      const sidecar = getSidecarPath(picked);
      const bytes = useApp.getState().previewBytes;
      if (bytes && (sidecar.endsWith(".png") || sidecar.endsWith(".PNG"))) {
        await (async () => {
          if (!isTauri()) return;
          const fs = await import("@tauri-apps/plugin-fs");
          await fs.writeFile(sidecar, bytes);
        })();
      }
    } catch {
      /* sidecar необязателен */
    }
    push(T.templateSaved, "success");
  };

  const onOpen = async () => {
    const { path, json } = await openSettingsFileDialog();
    if (!path || json === null) return;
    if (loadFileJson(json)) {
      setCurrentPath(path);
      push(T.settingsOpened, "success");
    } else {
      push(T.settingsOpenFailed, "error");
    }
  };

  const onSaveSettings = async (saveAs: boolean) => {
    const json = toJsonIndented(file);
    let target = currentPath;
    if (!target || saveAs) {
      target = await saveSettingsFileDialog(sanitizeTemplateName(file.templateName), json);
      if (!target) return;
      setCurrentPath(target);
    } else {
      await writeTextFile(target, json);
    }
    markSaved();
    push(T.settingsSaved, "success");
  };

  const onShareCode = async () => {
    const encoded = encodeSettings(file);
    if (encoded.length > MAX_ENCODED_LENGTH) {
      push("Код настроек слишком длинный", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(encoded);
      push(T.copied, "success");
    } catch {
      push(T.copyFailed, "error");
    }
  };

  const onPasteCode = async () => {
    const code = window.prompt(T.shareCodePrompt, "");
    if (!code) return;
    const res = tryDecodeSettings(code.trim());
    if (res.status === "Ok" && res.file) {
      loadFileJson(toJsonCompact(res.file));
      push(T.shareCodeApplied, "success");
    } else {
      push(T.shareCodeInvalid, "error");
    }
  };

  const onCheckUpdates = async () => {
    const res = await checkForUpdates();
    if (res.available) {
      const ok = window.confirm(`${T.updateAvailable} (v${res.version}). ${T.updateInstall}?`);
      if (ok) void openReleasesPage();
    } else {
      push(T.updateNotAvailable);
    }
  };

  const panel = (() => {
    switch (section) {
      case "map":
        return <MapSettingsPanel />;
      case "heroes":
        return <HeroesPanel />;
      case "topology":
        return <TopologyPanel />;
      case "zones":
        return <ZonesPanel />;
      case "winConditions":
        return <WinConditionsPanel />;
      case "experimental":
        return <ExperimentalPanel />;
    }
  })();

  return (
    <div className="app">
      <div className="toolbar">
        <span className="title">
          <svg viewBox="0 0 1024 1024" aria-hidden="true">
            <polygon
              fill="currentColor"
              points="512,128 556,440 760,476 596,498 782,512 596,526 760,548 556,584 512,896 468,584 264,548 428,526 242,512 428,498 264,476 468,440"
            />
            <circle cx="512" cy="512" r="430" fill="none" stroke="currentColor" strokeWidth="36" opacity="0.45" />
          </svg>
          Olden Era Templates
        </span>
        <span className="hint">{T.versionLabel}</span>
        {dirty && <span className="dirty-dot" title="Есть несохранённые изменения">●</span>}
        <button onClick={() => { if (window.confirm(T.confirmReset)) resetToDefaults(); }}>{T.toolbar.new}</button>
        <button onClick={() => void onOpen()}>{T.toolbar.open}</button>
        <button onClick={() => void onSaveSettings(false)} disabled={!currentPath}>{T.toolbar.save}</button>
        <button onClick={() => void onSaveSettings(true)}>{T.toolbar.saveAs}</button>
        <button onClick={() => setPresetModalOpen(true)}>{T.toolbar.loadPreset}</button>
        <button onClick={() => void onShareCode()}>{T.toolbar.shareCode}</button>
        <button onClick={() => void onPasteCode()}>⤵</button>
        <span className="spacer" />
        <button onClick={() => setAiOpen(!aiOpen)} title="Чат с ИИ-ассистентом">🤖 AI</button>
        <button onClick={undo} title="Ctrl/Cmd+Z">↩ {T.toolbar.undo}</button>
        <button onClick={redo} title="Ctrl+Shift+Z">↪ {T.toolbar.redo}</button>
        {isTauri() && <button onClick={() => void onCheckUpdates()}>{T.toolbar.checkUpdates}</button>}
        <button onClick={() => void openReleasesPage()}>{T.toolbar.github}</button>
      </div>
      <div className="main">
        <SectionNav
          active={section}
          onSelect={setSection}
          experimentalVisible={experimentalVisible || section === "experimental"}
          blockers={blockers.length}
        />
        <div className="panel-scroll">
          <h2>{T.sections[section]}</h2>
          {panel}
        </div>
        {aiOpen && <AiChatPanel onClose={() => setAiOpen(false)} />}
        <PreviewPanel onGenerate={() => void onGenerate()} generating={generating} blockers={blockers.map((b) => b.message)} onSaveTemplate={() => void onSaveTemplate()} />
      </div>
      {presetModalOpen && <PresetPickerModal onClose={() => setPresetModalOpen(false)} push={push} />}
      <ToastArea toasts={toasts} />
    </div>
  );
}
