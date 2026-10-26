import { useEffect, useState } from "react";
import { T } from "../i18n/ru";
import { presetCatalog } from "../generator/presetCatalog";
import { useApp } from "../state/settingsStore";
import { userPresetStore } from "./userPresetStoreInstance";

export function PresetPickerModal(props: {
  onClose: () => void;
  push: (text: string, kind?: "info" | "error" | "success") => void;
}) {
  const loadFile = useApp((s) => s.loadFile);
  const file = useApp((s) => s.file);
  const [mine, setMine] = useState<string[]>([]);
  const [name, setName] = useState("");

  const refreshMine = () => {
    void userPresetStore.listAsync().then((entries) => setMine(entries.map((e) => e.name)));
  };

  useEffect(refreshMine, []);

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{T.presets.title}</h3>
        <div className="modal-body">
          <div className="hint">{T.presets.builtin}</div>
          {presetCatalog.entries.map((e) => (
            <div className="preset-row" key={e.id}>
              <span className="name" title={e.description}>
                {e.name}
              </span>
              <button
                onClick={() => {
                  loadFile(presetCatalog.load(e.id));
                  props.push(T.presets.loaded, "success");
                  props.onClose();
                }}
              >
                {T.presets.load}
              </button>
            </div>
          ))}

          <div className="hint">{T.presets.mine}</div>
          {mine.length === 0 && <div className="hint">{T.presets.empty}</div>}
          {mine.map((n) => (
            <div className="preset-row" key={n}>
              <span className="name">{n}</span>
              <button
                onClick={() => {
                  void (async () => {
                    const loaded = await userPresetStore.loadAsync(n);
                    if (loaded) {
                      loadFile(loaded);
                      props.push(T.presets.loaded, "success");
                      props.onClose();
                    }
                  })();
                }}
              >
                {T.presets.load}
              </button>
              <button
                className="icon"
                onClick={() => {
                  if (!window.confirm(`${T.presets.confirmDelete} «${n}»?`)) return;
                  void (async () => {
                    await userPresetStore.deleteAsync(n);
                    refreshMine();
                    props.push(T.presets.deleted);
                  })();
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        <div className="preset-row">
          <input
            type="text"
            placeholder={T.presets.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="primary"
            onClick={() => {
              if (!name.trim()) return;
              void (async () => {
                const existing = await userPresetStore.listAsync();
                if (existing.some((n) => n.name.toLowerCase() === name.trim().toLowerCase())) {
                  if (!window.confirm(T.presets.confirmOverwrite)) return;
                }
                await userPresetStore.saveAsync(name.trim(), file);
                props.push(T.presets.saved, "success");
                setName("");
                refreshMine();
              })();
            }}
          >
            {T.presets.save}
          </button>
          <button onClick={props.onClose}>{T.presets.cancel}</button>
        </div>
      </div>
    </div>
  );
}
