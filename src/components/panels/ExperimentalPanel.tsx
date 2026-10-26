import { useEffect } from "react";
import { useApp } from "../../state/settingsStore";
import { GameModeCard } from "./GameModeCard";
import { StartingBonusesCard } from "./StartingBonusesCard";
import { TerrainCard } from "./TerrainCard";
import { BuildingPresetsCard } from "./BuildingPresetsCard";
import { GuardProgressionCard } from "./GuardProgressionCard";
import { GuardReactionCard } from "./GuardReactionCard";
import { ConnectionDefaultsCard } from "./ConnectionDefaultsCard";
import { NeutralCitiesCard } from "./NeutralCitiesCard";
import { ForcedObjectsCard } from "./ForcedObjectsCard";
import { BordersRoadsCard } from "./BordersRoadsCard";
import { PerTierOverridesCard } from "./PerTierOverridesCard";
import { EncounterHolesCard } from "./EncounterHolesCard";
import { ContentControlCard } from "./ContentControlCard";
import { ZoneOverridesCard } from "./ZoneOverridesCard";
import { ZoneContentEditor } from "./ZoneContentEditor";

const T = {
  warning:
    "⚠ Поля с пометкой «экспериментально» могут создавать шаблоны, которые текущая сборка игры не сможет загрузить. Пользуйтесь осознанно.",
};

/**
 * Все экспериментальные панели доступны сразу (помечены бейджем).
 * Флаги expFeature* в файле держим в true — для совместимости со старыми
 * читателями .oetgs, которые по ним прятали секции.
 */
export function ExperimentalPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  useEffect(() => {
    const allOn =
      file.experimentalEnabled &&
      file.expFeatureGameMode &&
      file.expFeatureStartingBonuses &&
      file.expFeatureZoneContent &&
      file.expFeatureBordersRoads &&
      file.expFeaturePerTierOverrides;
    if (!allOn) {
      patch((f) => {
        f.experimentalEnabled = true;
        f.expFeatureGameMode = true;
        f.expFeatureStartingBonuses = true;
        f.expFeatureZoneContent = true;
        f.expFeatureBordersRoads = true;
        f.expFeaturePerTierOverrides = true;
      });
    }
    // Однократная нормализация при входе в секцию.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="experimental-panel">
      <div className="wip-note">{T.warning}</div>

      <GameModeCard />
      <StartingBonusesCard />
      <ForcedObjectsCard />
      <ContentControlCard />
      <ZoneOverridesCard />
      <EncounterHolesCard />
      <ZoneContentEditor />
      <TerrainCard />
      <BuildingPresetsCard />
      <GuardProgressionCard />
      <GuardReactionCard />
      <ConnectionDefaultsCard />
      <NeutralCitiesCard />
      <BordersRoadsCard />
      <PerTierOverridesCard />
    </div>
  );
}
