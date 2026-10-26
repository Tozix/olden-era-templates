import { useApp } from "../../state/settingsStore";
import { Card, NumberField, SelectField, SliderRow, TriStateSelect } from "../ui";
import type { SelectOption } from "../ui";
import { GATE_PLACEMENTS } from "../../generator/knownValues";

const T = {
  cardTitle: "Настройки соединений",
  length: "Длина соединений",
  lengthHint: "Относительный множитель длины пути (0 % — значения генератора).",
  gatePlacement: "Размещение ворот",
  defaultOption: "По умолчанию",
  guardEscape: "Побег стражи",
  simTurnSquad: "Отряд при симуляции хода",
  triStateHint: "«Авто» — выбор остаётся за генератором.",
  guardRandomization: "Рандомизация стражи",
  guardRandomizationAuto: "Авто — используется значение генератора (в готовых шаблонах 0.10–0.15).",
  guardRandomizationHint: "Диапазон 0–0.5. В готовых шаблонах 0.10–0.15.",
  set: "Задать",
  resetAuto: "Сбросить (авто)",
};

const GATE_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.defaultOption },
  ...GATE_PLACEMENTS.map((gp) => ({ value: gp, label: gp })),
];

export function ConnectionDefaultsCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const guardRandomization = file.connectionGuardRandomization ?? null;

  return (
    <Card title={T.cardTitle} badge="Экспериментально">
      <SliderRow
        label={T.length}
        min={0}
        max={100}
        suffix="%"
        hint={T.lengthHint}
        value={Math.round(file.connectionLength * 100)}
        onChange={(v) =>
          patch((f) => {
            f.connectionLength = v / 100;
          })
        }
      />
      <SelectField
        label={T.gatePlacement}
        value={file.connectionGatePlacement}
        options={GATE_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.connectionGatePlacement = v;
          })
        }
      />
      <TriStateSelect
        label={T.guardEscape}
        value={file.connectionGuardEscape ?? null}
        hint={T.triStateHint}
        onChange={(v) =>
          patch((f) => {
            f.connectionGuardEscape = v;
          })
        }
      />
      <TriStateSelect
        label={T.simTurnSquad}
        value={file.connectionSimTurnSquad ?? null}
        hint={T.triStateHint}
        onChange={(v) =>
          patch((f) => {
            f.connectionSimTurnSquad = v;
          })
        }
      />
      {guardRandomization === null ? (
        <>
          <div className="hint">{T.guardRandomizationAuto}</div>
          <button
            type="button"
            onClick={() =>
              patch((f) => {
                f.connectionGuardRandomization = 0.1;
              })
            }
          >
            {T.set}
          </button>
        </>
      ) : (
        <>
          <NumberField
            label={T.guardRandomization}
            value={guardRandomization}
            min={0}
            max={0.5}
            step={0.01}
            hint={T.guardRandomizationHint}
            onChange={(v) =>
              patch((f) => {
                f.connectionGuardRandomization = Math.min(0.5, Math.max(0, v));
              })
            }
          />
          <button
            type="button"
            onClick={() =>
              patch((f) => {
                f.connectionGuardRandomization = null;
              })
            }
          >
            {T.resetAuto}
          </button>
        </>
      )}
    </Card>
  );
}
