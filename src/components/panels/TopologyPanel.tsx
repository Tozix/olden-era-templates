import type { ReactElement } from "react";
import { useApp } from "../../state/settingsStore";
import { Card, FixButton, SliderRow } from "../../components/ui";
import { ValidationIssueCodes } from "../../generator/settingsValidator";
import type { MapTopology } from "../../generator/enums";

const T = {
  card: "Топология",
  hint: "Как зоны игроков и нейтральные зоны расположены на карте.",
  // TODO: verify wording against in-game Russian localization (условие «Удержание города»)
  cityHoldHubHint:
    "«Удержание города» также работает при раскладке «Хаб» — центральный хаб сам служит удерживаемым нейтральным городом.",
  switchToHub: "Переключить на топологию «Хаб»",
  hubZoneSize: "Размер хаб-зоны",
  hubCastles: "Замков в хабе",
  ring: "Кольцо",
  hub: "Хаб",
  chain: "Цепочка",
  random: "Случайная",
  balanced: "Сбалансированная",
};

interface TopoTile {
  topo: MapTopology;
  label: string;
  svg: ReactElement;
}

// Схемы плиток — порт SVG-констант из OldenEra.Web/Components/TopologyPicker.razor.
const RING_SVG: ReactElement = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="12" r="4" fill="currentColor" />
    <circle cx="52" cy="32" r="4" fill="currentColor" />
    <circle cx="32" cy="52" r="4" fill="currentColor" />
    <circle cx="12" cy="32" r="4" fill="currentColor" />
    <path d="M32 16 Q52 16 52 32 Q52 52 32 52 Q12 52 12 32 Q12 12 32 12 Z" />
  </svg>
);

const HUB_SVG: ReactElement = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="6" fill="currentColor" />
    <circle cx="32" cy="10" r="4" fill="currentColor" />
    <circle cx="54" cy="32" r="4" fill="currentColor" />
    <circle cx="32" cy="54" r="4" fill="currentColor" />
    <circle cx="10" cy="32" r="4" fill="currentColor" />
    <line x1="32" y1="14" x2="32" y2="26" />
    <line x1="50" y1="32" x2="38" y2="32" />
    <line x1="32" y1="50" x2="32" y2="38" />
    <line x1="14" y1="32" x2="26" y2="32" />
  </svg>
);

const CHAIN_SVG: ReactElement = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="32" r="4" fill="currentColor" />
    <circle cx="25" cy="32" r="4" fill="currentColor" />
    <circle cx="40" cy="32" r="4" fill="currentColor" />
    <circle cx="55" cy="32" r="4" fill="currentColor" />
    <line x1="14" y1="32" x2="21" y2="32" />
    <line x1="29" y1="32" x2="36" y2="32" />
    <line x1="44" y1="32" x2="51" y2="32" />
  </svg>
);

const RANDOM_SVG: ReactElement = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="14" cy="18" r="4" fill="currentColor" />
    <circle cx="48" cy="14" r="4" fill="currentColor" />
    <circle cx="20" cy="50" r="4" fill="currentColor" />
    <circle cx="52" cy="46" r="4" fill="currentColor" />
    <line x1="17" y1="21" x2="49" y2="44" />
    <line x1="44" y1="17" x2="22" y2="47" />
    <line x1="14" y1="22" x2="20" y2="46" />
  </svg>
);

const BALANCED_SVG: ReactElement = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="4" fill="currentColor" />
    <circle cx="32" cy="32" r="12" />
    <circle cx="32" cy="32" r="22" />
    <circle cx="32" cy="10" r="3" fill="currentColor" />
    <circle cx="54" cy="32" r="3" fill="currentColor" />
    <circle cx="32" cy="54" r="3" fill="currentColor" />
    <circle cx="10" cy="32" r="3" fill="currentColor" />
    <circle cx="32" cy="20" r="3" fill="currentColor" />
    <circle cx="44" cy="32" r="3" fill="currentColor" />
    <circle cx="32" cy="44" r="3" fill="currentColor" />
    <circle cx="20" cy="32" r="3" fill="currentColor" />
  </svg>
);

// Только топологии из C#-пикера (SharedWeb плитки не имеет).
const TOPO_TILES: TopoTile[] = [
  { topo: "Default", label: T.ring, svg: RING_SVG },
  { topo: "HubAndSpoke", label: T.hub, svg: HUB_SVG },
  { topo: "Chain", label: T.chain, svg: CHAIN_SVG },
  { topo: "Random", label: T.random, svg: RANDOM_SVG },
  { topo: "Balanced", label: T.balanced, svg: BALANCED_SVG },
];

/** Предупреждения (не блокеры) по полю: ui-кит показывает только ошибки. */
function FieldWarnings(props: { fieldKey: string }) {
  const issues = useApp((s) => s.issues);
  const warnings = issues.filter(
    (i) => i.fieldKey === props.fieldKey && i.severity === "warning",
  );
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w, idx) => (
        <div key={idx} className="hint">
          {w.message}
        </div>
      ))}
    </>
  );
}

export function TopologyPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);
  const applyFix = useApp((s) => s.applyFix);
  const issues = useApp((s) => s.issues);

  // Блокер «Удержанию города нужны нейтральные зоны» якорится на счётчик
  // нейтральных зон (там живёт фикс «добавить зону»), но альтернативное
  // исправление — переключиться на «Хаб» — показываем и здесь (как в razor).
  const cityHoldBlocker = issues.find(
    (i) =>
      i.severity === "error" &&
      i.code === ValidationIssueCodes.NeutralZoneCountForCityHold,
  );

  return (
    <Card title={T.card}>
      <div className="hint">{T.hint}</div>

      {cityHoldBlocker && (
        <div role="alert">
          <span className="hint">{T.cityHoldHubHint} </span>
          <button
            type="button"
            className="fix-button"
            onClick={() => applyFix({ kind: "switchToHubTopology" })}
          >
            {T.switchToHub}
          </button>
        </div>
      )}
      <FixButton fieldKey="topology" />

      <div className="topology-grid" role="radiogroup" aria-label={T.card}>
        {TOPO_TILES.map((tile) => {
          const active = file.topology === tile.topo;
          return (
            <button
              key={tile.topo}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? "topology-tile active" : "topology-tile"}
              onClick={() => {
                if (!active) patch((f) => { f.topology = tile.topo; });
              }}
            >
              {tile.svg}
              <span className="label">{tile.label}</span>
            </button>
          );
        })}
      </div>

      <FieldWarnings fieldKey="topology" />

      {file.topology === "HubAndSpoke" && (
        <>
          <SliderRow
            label={T.hubZoneSize}
            value={file.hubZoneSize}
            min={0.25}
            max={3}
            step={0.05}
            format={(v) => `${v.toFixed(2).replace(/0$/, "")}×`}
            onChange={(v) => patch((f) => { f.hubZoneSize = v; })}
            fieldKey="topology"
          />
          <SliderRow
            label={T.hubCastles}
            value={file.hubCastles}
            min={0}
            max={4}
            step={1}
            onChange={(v) => patch((f) => { f.hubCastles = v; })}
            fieldKey="topology"
          />
        </>
      )}
    </Card>
  );
}
