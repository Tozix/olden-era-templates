import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, NumberField, SelectField } from "../ui";
import type { SelectOption } from "../ui";
import { GAME_MODES } from "../../generator/knownValues";

const T = {
  cardTitle: "Режим игры",
  badge: "Экспериментально",
  gameMode: "Режим игры",
  classic: "Классический",
  singleHero: "Одиночный герой",
  singleHeroHint:
    "Все игроки играют ровно с одним героем; слайдеры количества героев игнорируются.",
  heroHireBan: "Запретить найм героев в тавернах",
  heroHireBanHint:
    "Отключает найм героев в тавернах. Более мягкая альтернатива режиму «Одиночный герой».",
  desertionDay: "День дезертирства",
  desertionValue: "Порог дезертирства",
  zeroIsDefault: "0 — значение по умолчанию",
};
// TODO: verify wording against in-game Russian localization

const GAME_MODE_OPTIONS: SelectOption<string>[] = GAME_MODES.map((mode) => ({
  value: mode,
  label: mode === "Classic" ? T.classic : T.singleHero,
}));

export function GameModeCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const singleHero = file.gameMode === "SingleHero";

  return (
    <Card title={T.cardTitle} badge={T.badge}>
      <SelectField
        label={T.gameMode}
        value={file.gameMode}
        options={GAME_MODE_OPTIONS}
        hint={T.singleHeroHint}
        onChange={(mode) =>
          patch((f) => {
            f.gameMode = mode;
            // Порт из Web/WPF: включение «Одиночный герой» сбрасывает запрет найма.
            if (mode === "SingleHero") f.heroHireBan = false;
          })
        }
      />
      <CheckboxRow
        label={T.heroHireBan}
        checked={file.heroHireBan}
        hint={T.heroHireBanHint}
        disabled={singleHero}
        onChange={(v) =>
          patch((f) => {
            f.heroHireBan = v;
          })
        }
      />
      <NumberField
        label={T.desertionDay}
        value={file.desertionDay}
        min={0}
        hint={T.zeroIsDefault}
        onChange={(v) =>
          patch((f) => {
            f.desertionDay = Math.max(0, Math.round(v));
          })
        }
      />
      <NumberField
        label={T.desertionValue}
        value={file.desertionValue}
        min={0}
        hint={T.zeroIsDefault}
        onChange={(v) =>
          patch((f) => {
            f.desertionValue = Math.max(0, Math.round(v));
          })
        }
      />
    </Card>
  );
}
