import { useApp } from "../../state/settingsStore";
import type { SettingsFile } from "../../generator/settingsFile";
import { EXPERIMENTAL_FEATURES } from "../../generator/experimentalFeatures";
import { CheckboxRow } from "../ui";
import { GameModeCard } from "./GameModeCard";
import { StartingBonusesCard } from "./StartingBonusesCard";
import { BordersRoadsCard } from "./BordersRoadsCard";
import { PerTierOverridesCard } from "./PerTierOverridesCard";
import { EncounterHolesCard } from "./EncounterHolesCard";
// Карточки зонного контента — отдельные файлы (создаются параллельно).
import { ContentControlCard } from "./ContentControlCard";
import { ZoneOverridesCard } from "./ZoneOverridesCard";
import { ZoneContentEditor } from "./ZoneContentEditor";

const T = {
  warning:
    "⚠ Экспериментальные функции могут создавать шаблоны, которые текущая сборка игры не сможет загрузить. Используйте на свой страх.",
};

/** Значение per-feature флага в SettingsFile по ключу фичи. */
function isFeatureOn(f: SettingsFile, key: string): boolean {
  switch (key) {
    case "game-mode":
      return f.expFeatureGameMode;
    case "starting-bonuses":
      return f.expFeatureStartingBonuses;
    case "zone-content":
      return f.expFeatureZoneContent;
    case "borders-roads":
      return f.expFeatureBordersRoads;
    case "per-tier-overrides":
      return f.expFeaturePerTierOverrides;
    default:
      return false;
  }
}

export function ExperimentalPanel() {
  const file = useApp((s) => s.file);
  const setExpFeature = useApp((s) => s.setExpFeature);

  return (
    <div className="experimental-panel">
      <div className="hint">{T.warning}</div>

      {EXPERIMENTAL_FEATURES.map((feature) => (
        <CheckboxRow
          key={feature.key}
          label={feature.titleRu}
          hint={feature.descriptionRu}
          checked={isFeatureOn(file, feature.key)}
          onChange={(on) => setExpFeature(feature.key, on)}
        />
      ))}

      {file.expFeatureGameMode && <GameModeCard />}
      {file.expFeatureStartingBonuses && <StartingBonusesCard />}
      {file.expFeatureZoneContent && (
        <>
          <ContentControlCard />
          <ZoneOverridesCard />
          <EncounterHolesCard />
          <ZoneContentEditor />
        </>
      )}
      {file.expFeatureBordersRoads && <BordersRoadsCard />}
      {file.expFeaturePerTierOverrides && <PerTierOverridesCard />}
    </div>
  );
}
