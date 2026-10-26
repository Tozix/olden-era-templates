import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, NumberField, SelectField, SliderRow } from "../ui";
import type { SelectOption } from "../ui";

const T = {
  cardTitle: "Границы и дороги",
  cornerRadius: "Радиус скругления границы",
  cornerRadiusHint: "0 — авто (значение генератора).",
  obstaclesWidth: "Ширина препятствий у границы",
  waterBorder: "Водная граница",
  waterWidth: "Ширина воды",
  roadType: "Тип дорог",
  roadDefault: "По умолчанию (Dirt)",
  roadDirt: "Грунт",
  roadStone: "Камень",
  hint: "Переопределяет граничные и дорожевые настройки генератора. 0 / «По умолчанию» — без изменений.",
};

const ROAD_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.roadDefault },
  { value: "Dirt", label: T.roadDirt },
  { value: "Stone", label: T.roadStone },
];

export function BordersRoadsCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle} badge="Экспериментально">
      <div className="hint">{T.hint}</div>
      {/* null = авто; слайдер 0 пишет null (см. подсказку «0 — авто»). */}
      <SliderRow
        label={T.cornerRadius}
        min={0}
        max={100}
        suffix="%"
        hint={T.cornerRadiusHint}
        value={Math.round((file.borderCornerRadius ?? 0) * 100)}
        onChange={(v) =>
          patch((f) => {
            f.borderCornerRadius = v === 0 ? null : v / 100;
          })
        }
      />
      <NumberField
        label={T.obstaclesWidth}
        value={file.borderObstaclesWidth ?? 0}
        min={0}
        max={10}
        hint={T.cornerRadiusHint}
        onChange={(v) =>
          patch((f) => {
            const width = Math.round(v);
            f.borderObstaclesWidth = width > 0 ? width : null;
          })
        }
      />
      <CheckboxRow
        label={T.waterBorder}
        checked={file.waterBorderEnabled}
        onChange={(v) =>
          patch((f) => {
            f.waterBorderEnabled = v;
          })
        }
      />
      <SliderRow
        label={T.waterWidth}
        min={1}
        max={10}
        disabled={!file.waterBorderEnabled}
        value={file.waterWidth}
        onChange={(v) =>
          patch((f) => {
            f.waterWidth = Math.round(v);
          })
        }
      />
      <SelectField
        label={T.roadType}
        value={file.roadType}
        options={ROAD_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.roadType = v;
          })
        }
      />
    </Card>
  );
}
