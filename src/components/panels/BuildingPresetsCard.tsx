import { useApp } from "../../state/settingsStore";
import { Card, SelectField } from "../ui";
import type { SelectOption } from "../ui";
import { BUILDINGS_CONSTRUCTION_SIDS } from "../../generator/knownValues";

const T = {
  cardTitle: "Пресеты зданий",
  playerPreset: "Пресет зданий: зоны игроков",
  neutralPreset: "Пресет зданий: нейтральные зоны",
  defaultOption: "По умолчанию",
  hint: "Принудительно задаёт путь строительства. «По умолчанию» — генератор выбирает сам.",
};

// Метка опции = сам SID (человекочитаемая обработка суффикса не требуется).
const PRESET_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.defaultOption },
  ...BUILDINGS_CONSTRUCTION_SIDS.map((sid) => ({ value: sid, label: sid })),
];

export function BuildingPresetsCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle}>
      <div className="hint">{T.hint}</div>
      <SelectField
        label={T.playerPreset}
        value={file.buildingPresetPlayer}
        options={PRESET_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.buildingPresetPlayer = v;
          })
        }
      />
      <SelectField
        label={T.neutralPreset}
        value={file.buildingPresetNeutral}
        options={PRESET_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.buildingPresetNeutral = v;
          })
        }
      />
    </Card>
  );
}
