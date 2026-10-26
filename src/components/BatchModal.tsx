import { useState } from "react";
import { useApp } from "../state/settingsStore";
import { runBatch, revealBatch } from "../state/batchActions";
import type { MapTopology } from "../generator/enums";
import { ALL_MAP_SIZES, mapSizeLabel } from "../generator/knownValues";
import { isTauri } from "../platform";
import { CheckboxRow, NumberField } from "./ui";

const T = {
  title: "Массовая генерация карт",
  intro: "Пакет создаёт N разных карт из текущих настроек: размер, топология и число игроков берутся случайно из выбранных диапазонов, имя и описание — свои для каждой карты.",
  count: "Количество карт",
  sizeMin: "Размер от",
  sizeMax: "до",
  topologies: "Топологии (можно несколько)",
  players: "Игроки",
  playersFrom: "от",
  playersTo: "до",
  includePng: "Положить PNG-превью рядом с каждым шаблоном",
  run: "Сгенерировать пакет",
  running: "Генерация…",
  save: "Сохранить как ZIP…",
  done: "Готово",
  showInFolder: "Показать в папке",
  close: "Закрыть",
  needTopology: "Выберите хотя бы одну топологию",
  saved: (n: number) => `Готово: ${n} карт(ы) в архиве`,
};

const TOPOLOGY_LABELS: Record<MapTopology, string> = {
  Default: "Кольцо",
  HubAndSpoke: "Хаб",
  Chain: "Цепочка",
  SharedWeb: "Паутина",
  Random: "Случайная",
  Balanced: "Сбалансированная",
};

const sizeOptions = ALL_MAP_SIZES.map((s) => ({ value: s, label: `${s} (${mapSizeLabel(s)})` }));

export function BatchModal(props: { onClose: () => void; push: (text: string, kind?: "info" | "error" | "success") => void }) {
  const file = useApp((s) => s.file);
  const fileTopology = file.topology;

  const [count, setCount] = useState(5);
  const [sizeMin, setSizeMin] = useState(96);
  const [sizeMax, setSizeMax] = useState(240);
  const [topologies, setTopologies] = useState<MapTopology[]>([fileTopology]);
  const [playersMin, setPlayersMin] = useState(2);
  const [playersMax, setPlayersMax] = useState(6);
  const [includePng, setIncludePng] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const toggleTopology = (t: MapTopology) => {
    setTopologies((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const run = () => {
    if (topologies.length === 0) {
      props.push(T.needTopology, "error");
      return;
    }
    setRunning(true);
    setSavedPath(null);
    void (async () => {
      const res = await runBatch(
        {
          count,
          sizeMin,
          sizeMax,
          topologies,
          playersMin,
          playersMax,
          baseSeed: null,
          nameSeed: null,
        },
        {
          includePng,
          onProgress: (done, total, label) => setProgress(`${done}/${total} — ${label}`),
        },
      );
      setRunning(false);
      if (!res.ok) {
        props.push(res.error ?? res.blockers?.join("\n") ?? "Не удалось собрать пакет", "error");
        return;
      }
      setSavedPath(res.savedPath ?? null);
      props.push(T.saved(count), "success");
    })();
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{T.title}</h3>
        <div className="modal-body">
          <div className="hint">{T.intro}</div>

          <NumberField label={T.count} value={count} min={1} max={50} onChange={(v) => setCount(Math.max(1, Math.min(50, v || 1)))} />

          <div className="field-row">
            <label>{T.sizeMin}</label>
            <span className="field-input">
              <select value={sizeMin} onChange={(e) => setSizeMin(Number(e.target.value))}>
                {sizeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="suffix">{T.sizeMax}</span>
              <select value={sizeMax} onChange={(e) => setSizeMax(Number(e.target.value))}>
                {sizeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </span>
          </div>

          <div className="check-row">
            <label>{T.topologies}</label>
            <div className="chips">
              {(Object.keys(TOPOLOGY_LABELS) as MapTopology[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip${topologies.includes(t) ? " active" : ""}`}
                  onClick={() => toggleTopology(t)}
                >
                  {TOPOLOGY_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="slider-row">
            <label>{T.players}</label>
            <span className="field-input">
              <span className="suffix">{T.playersFrom}</span>
              <input type="range" min={2} max={8} value={playersMin} onChange={(e) => setPlayersMin(Math.min(Number(e.target.value), playersMax))} />
              <span className="suffix">{T.playersTo}</span>
              <input type="range" min={2} max={8} value={playersMax} onChange={(e) => setPlayersMax(Math.max(Number(e.target.value), playersMin))} />
              <span className="slider-value">{playersMin}–{playersMax}</span>
            </span>
          </div>

          <CheckboxRow label={T.includePng} checked={includePng} onChange={setIncludePng} />

          {running && <div className="hint">{progress || T.running}</div>}
          {savedPath && (
            <button className="primary" onClick={() => revealBatch(savedPath)}>
              {T.showInFolder}
            </button>
          )}
        </div>
        <div className="preset-row">
          <button className="primary" onClick={run} disabled={running}>
            {running ? T.running : `${T.run} (${count})`}
          </button>
          {!running && !savedPath && !isTauri() && <span className="hint">В браузере архив скачается автоматически</span>}
          <span className="spacer" />
          <button onClick={props.onClose} disabled={running}>{T.close}</button>
        </div>
      </div>
    </div>
  );
}
