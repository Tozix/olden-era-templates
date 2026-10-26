import { useApp } from "../../state/settingsStore";
import { Card, SelectField, TextField } from "../ui";
import type { SelectOption } from "../ui";

const T = {
  cardTitle: "Кривая реакции стражи",
  preset: "Кривая",
  presetDefault: "По умолчанию",
  presetFrontLoaded: "Сильная в начале",
  presetEven: "Равномерная",
  presetBackLoaded: "Сильная в конце",
  presetCustom: "Своя кривая",
  custom: "Своя кривая (6 чисел через запятую)",
  customHint:
    "Шесть недель (0..5): веса появления стражи по неделям. Некорректный список — используется значение по умолчанию.",
};

// TODO: verify wording against in-game Russian localization

const PRESET_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.presetDefault },
  { value: "FrontLoaded", label: T.presetFrontLoaded },
  { value: "Even", label: T.presetEven },
  { value: "BackLoaded", label: T.presetBackLoaded },
  { value: "Custom", label: T.presetCustom },
];

export function GuardReactionCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle}>
      <SelectField
        label={T.preset}
        value={file.guardReactionPreset}
        options={PRESET_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.guardReactionPreset = v;
          })
        }
      />
      {file.guardReactionPreset === "Custom" && (
        <TextField
          label={T.custom}
          value={file.guardReactionCustomDistribution}
          hint={T.customHint}
          placeholder="0, 10, 10, 10, 10, 0"
          onChange={(v) =>
            patch((f) => {
              f.guardReactionCustomDistribution = v;
            })
          }
        />
      )}
    </Card>
  );
}
