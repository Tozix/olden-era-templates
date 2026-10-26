import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, SliderRow } from "../ui";

const T = {
  cardTitle: "Нейтральные города",
  guardChance: "Шанс стражи",
  guardValue: "Значение стражи",
  removeGuardIfHasOwner: "Снимать стражу после захвата",
  removeGuardHint:
    "Когда включено, нейтральные города теряют стражу, как только игрок их захватывает.",
};

export function NeutralCitiesCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle}>
      <SliderRow
        label={T.guardChance}
        min={0}
        max={100}
        suffix="%"
        value={Math.round(file.neutralCityGuardChance * 100)}
        onChange={(v) =>
          patch((f) => {
            f.neutralCityGuardChance = v / 100;
          })
        }
      />
      {/* neutralCityGuardValuePercent хранится целым процентом — без /100. */}
      <SliderRow
        label={T.guardValue}
        min={0}
        max={400}
        suffix="%"
        value={file.neutralCityGuardValuePercent}
        onChange={(v) =>
          patch((f) => {
            f.neutralCityGuardValuePercent = Math.round(v);
          })
        }
      />
      <CheckboxRow
        label={T.removeGuardIfHasOwner}
        checked={file.neutralCityRemoveGuardIfHasOwner}
        hint={T.removeGuardHint}
        onChange={(v) =>
          patch((f) => {
            f.neutralCityRemoveGuardIfHasOwner = v;
          })
        }
      />
    </Card>
  );
}
