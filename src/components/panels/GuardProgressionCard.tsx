import { useApp } from "../../state/settingsStore";
import { Card, SliderRow } from "../ui";

const T = {
  cardTitle: "Рост стражи",
  zoneGuard: "Рост стражи в зоне",
  connectionGuard: "Рост стражи на соединении",
  hint:
    "Еженедельный прирост стражи. 0 % — значения генератора по умолчанию (15 % зона, 15–20 % соединения).",
};

export function GuardProgressionCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle} badge="Экспериментально">
      <div className="hint">{T.hint}</div>
      <SliderRow
        label={T.zoneGuard}
        min={0}
        max={25}
        suffix="%/нед"
        value={Math.round(file.zoneGuardWeeklyIncrement * 100)}
        onChange={(v) =>
          patch((f) => {
            f.zoneGuardWeeklyIncrement = v / 100;
          })
        }
      />
      <SliderRow
        label={T.connectionGuard}
        min={0}
        max={25}
        suffix="%/нед"
        value={Math.round(file.connectionGuardWeeklyIncrement * 100)}
        onChange={(v) =>
          patch((f) => {
            f.connectionGuardWeeklyIncrement = v / 100;
          })
        }
      />
    </Card>
  );
}
