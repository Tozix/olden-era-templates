import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, SliderRow } from "../ui";

const T = {
  cardTitle: "Ямы сражений",
  enabled: "Дополнительные стеки в сражениях",
  affected: "Затронуто сражений",
  twoHole: "Сражений с двумя ямами",
  hint:
    "Выключено (по умолчанию) — бои с одним стеком стражи. Включено — в сражениях появляются дополнительные стеки. В готовых шаблонах 66 % / 66 %.",
};

// TODO: verify wording against in-game Russian localization

export function EncounterHolesCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle}>
      <div className="hint">{T.hint}</div>
      <CheckboxRow
        label={T.enabled}
        checked={file.encounterHolesEnabled}
        onChange={(v) =>
          patch((f) => {
            f.encounterHolesEnabled = v;
          })
        }
      />
      <SliderRow
        label={T.affected}
        min={0}
        max={100}
        suffix="%"
        disabled={!file.encounterHolesEnabled}
        value={Math.round(file.encounterHolesAffectedEncounters * 100)}
        onChange={(v) =>
          patch((f) => {
            f.encounterHolesAffectedEncounters = v / 100;
          })
        }
      />
      <SliderRow
        label={T.twoHole}
        min={0}
        max={100}
        suffix="%"
        disabled={!file.encounterHolesEnabled}
        value={Math.round(file.encounterHolesTwoHoleEncounters * 100)}
        onChange={(v) =>
          patch((f) => {
            f.encounterHolesTwoHoleEncounters = v / 100;
          })
        }
      />
    </Card>
  );
}
