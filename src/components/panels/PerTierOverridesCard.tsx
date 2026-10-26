import { useState } from "react";
import { useApp } from "../../state/settingsStore";
import { Card, Chip, SelectField, SliderRow } from "../ui";
import type { SelectOption } from "../ui";
import { BUILDINGS_CONSTRUCTION_SIDS } from "../../generator/knownValues";

const T = {
  cardTitle: "Переопределения по уровням",
  tabLow: "Слабые",
  tabMedium: "Средние",
  tabHigh: "Богатые",
  buildingPreset: "Пресет зданий",
  defaultOption: "По умолчанию",
  guardWeekly: "Рост стражи",
  obstacles: "Препятствия",
  lakes: "Озёра",
  hint:
    "Переопределение для нейтральных зон каждого уровня. 0 / «По умолчанию» — наследуются общие настройки.",
};

type TierKey = "tierLow" | "tierMedium" | "tierHigh";

const TIERS: { key: TierKey; label: string }[] = [
  { key: "tierLow", label: T.tabLow },
  { key: "tierMedium", label: T.tabMedium },
  { key: "tierHigh", label: T.tabHigh },
];

const PRESET_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.defaultOption },
  ...BUILDINGS_CONSTRUCTION_SIDS.map((sid) => ({ value: sid, label: sid })),
];

export function PerTierOverridesCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);
  const [active, setActive] = useState<TierKey>("tierLow");

  const tier = file[active];

  return (
    <Card title={T.cardTitle}>
      <div className="hint">{T.hint}</div>
      <div className="chip-tabs">
        {TIERS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            active={active === t.key}
            onClick={() => setActive(t.key)}
          />
        ))}
      </div>

      <SelectField
        label={T.buildingPreset}
        value={tier.buildingPreset}
        options={PRESET_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f[active] = { ...f[active], buildingPreset: v };
          })
        }
      />
      <SliderRow
        label={T.guardWeekly}
        min={0}
        max={25}
        suffix="%/нед"
        value={Math.round(tier.guardWeeklyIncrement * 100)}
        onChange={(v) =>
          patch((f) => {
            f[active] = { ...f[active], guardWeeklyIncrement: v / 100 };
          })
        }
      />
      <SliderRow
        label={T.obstacles}
        min={0}
        max={100}
        suffix="%"
        value={Math.round(tier.obstaclesFill * 100)}
        onChange={(v) =>
          patch((f) => {
            f[active] = { ...f[active], obstaclesFill: v / 100 };
          })
        }
      />
      <SliderRow
        label={T.lakes}
        min={0}
        max={100}
        suffix="%"
        value={Math.round(tier.lakesFill * 100)}
        onChange={(v) =>
          patch((f) => {
            f[active] = { ...f[active], lakesFill: v / 100 };
          })
        }
      />
    </Card>
  );
}
