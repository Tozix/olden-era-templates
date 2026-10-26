import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, FieldError, FixButton, SliderRow } from "../../components/ui";
import { effectiveResourceDensity, effectiveStructureDensity } from "../../generator/settingsFile";

const T = {
  card: "Конфигурация зон",
  advancedMode: "Расширенные настройки зон",
  densityHint:
    "Все проценты сравниваются с базовым значением генератора (100%). Меньше — реже/слабее, больше — плотнее/сильнее.",
  neutralZoneCount: "Дополнительные нейтральные зоны",
  advancedCountsHint: "Количество нейтральных зон задаётся по категориям ниже.",
  playerCastles: "Замков в зоне игрока",
  neutralCastles: "Замков в нейтральной зоне",
  resourceDensity: "Плотность ресурсов",
  structureDensity: "Плотность строений",
  neutralStackStrength: "Сила нейтральных стеков",
  borderGuardStrength: "Сила границ и порталов",
  matchPlayerCastleFactions: "Один фракционный набор замков у всех игроков",
  generateRoads: "Генерировать дороги",
  roadsHint:
    "Дороги генерируются только внутри зон, где есть хотя бы один замок. Нейтральные зоны без замков останутся без дорог, даже если опция включена.",
  // TODO: verify wording against in-game Russian localization (Remote Foothold / отдалённый плацдарм)
  spawnFootholds: "Ставить отдалённые плацдармы",
  footholdsHint:
    "Расставляет на карте дополнительные строения «Отдалённый плацдарм». Плацдармы позволяют гарнизонировать войска и артефакты и служат целями для заклинания «Отдалённый плацдарм»: больше плацдармов — больше мобильности и точек передового развёртывания.",
  randomPortals: "Всегда ставить порталы",
  maxPortalConns: "Макс. соединений порталов",
  isolateplayers: "Связь только через нейтральные зоны",
  isolateHint:
    "Игра попытается соединять зоны игроков только через нейтральные зоны. Если ни одна нейтральная зона не граничит с зоной игрока, соединение будет прямым.",
  advancedCard: "Расширенная настройка зон",
  experimentalBadge: "Экспериментально",
  advancedTuningHint:
    "Множители размера зон и рандомизация силы стражи. Влияют на раскладку, но не на содержимое зон.",
  playerZoneSize: "Размер зоны игрока",
  neutralZoneSize: "Размер нейтральной зоны",
  zoneSizeHint: "Множитель базовой площади зоны. 1× — значение генератора по умолчанию.",
  guardRandomization: "Рандомизация силы стражи",
  guardRandomizationHint:
    "Насколько сила каждого стража отличается от целевой силы зоны. 0% — одинаково, 50% — отклонение до половины силы в любую сторону.",
  advancedNeutralCard: "Расширенные нейтральные зоны",
  advancedNeutralHint:
    "Нейтральные зоны с замком используют значение «Замков в нейтральной зоне». Каждый слайдер ограничен 30; суммарное число зон в расширенном режиме ограничено 32.",
  neutralLowNoCastle: "Слабые без замка",
  neutralLowCastle: "Слабые с замком",
  neutralMediumNoCastle: "Средние без замка",
  neutralMediumCastle: "Средние с замком",
  neutralHighNoCastle: "Богатые без замка",
  neutralHighCastle: "Богатые с замком",
  minNeutralSeparation: "Мин. нейтральных зон между игроками",
  minSeparationHint:
    "Соблюдается только если выбранная раскладка, общее число нейтральных зон и настройка порталов это позволяют; иначе генерация использует обычную схему соединений.",
};

function formatTimes(v: number): string {
  return `${v.toFixed(2).replace(/0$/, "")}×`;
}

/** Предупреждения (не блокеры) по полю: ui-кит показывает только ошибки. */
function FieldWarnings(props: { fieldKey: string }) {
  const issues = useApp((s) => s.issues);
  const warnings = issues.filter(
    (i) => i.fieldKey === props.fieldKey && i.severity === "warning",
  );
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w, idx) => (
        <div key={idx} className="hint">
          {w.message}
        </div>
      ))}
    </>
  );
}

export function ZonesPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <>
      <Card title={T.card}>
        <CheckboxRow
          label={T.advancedMode}
          checked={file.advancedMode}
          onChange={(v) => patch((f) => { f.advancedMode = v; })}
        />
        <div className="hint">{T.densityHint}</div>

        <SliderRow
          label={T.neutralZoneCount}
          value={file.neutralZoneCount}
          min={0}
          max={30}
          step={1}
          disabled={file.advancedMode}
          onChange={(v) => patch((f) => { f.neutralZoneCount = v; })}
          fieldKey="zones.neutral.count"
        />
        <FixButton fieldKey="zones.neutral.count" />
        <FieldError fieldKey="zones.total" />
        {file.advancedMode && <div className="hint">{T.advancedCountsHint}</div>}

        <SliderRow
          label={T.playerCastles}
          value={file.playerCastles}
          min={1}
          max={4}
          step={1}
          onChange={(v) => patch((f) => { f.playerCastles = v; })}
          fieldKey="zones.player.castles"
        />
        <FieldWarnings fieldKey="zones.player.castles" />
        <SliderRow
          label={T.neutralCastles}
          value={file.neutralCastles}
          min={0}
          max={4}
          step={1}
          onChange={(v) => patch((f) => { f.neutralCastles = v; })}
        />

        <SliderRow
          label={T.resourceDensity}
          value={effectiveResourceDensity(file)}
          min={20}
          max={400}
          step={10}
          suffix="%"
          onChange={(v) => patch((f) => { f.resourceDensity = v; })}
        />
        <SliderRow
          label={T.structureDensity}
          value={effectiveStructureDensity(file)}
          min={20}
          max={200}
          step={10}
          suffix="%"
          onChange={(v) => patch((f) => { f.structureDensity = v; })}
        />
        <SliderRow
          label={T.neutralStackStrength}
          value={file.neutralStackStrength}
          min={25}
          max={300}
          step={5}
          suffix="%"
          onChange={(v) => patch((f) => { f.neutralStackStrength = v; })}
        />
        <SliderRow
          label={T.borderGuardStrength}
          value={file.borderGuardStrength}
          min={25}
          max={300}
          step={5}
          suffix="%"
          onChange={(v) => patch((f) => { f.borderGuardStrength = v; })}
        />

        <CheckboxRow
          label={T.matchPlayerCastleFactions}
          checked={file.matchPlayerCastleFactions}
          onChange={(v) => patch((f) => { f.matchPlayerCastleFactions = v; })}
        />
        <CheckboxRow
          label={T.generateRoads}
          checked={file.generateRoads}
          onChange={(v) => patch((f) => { f.generateRoads = v; })}
        />
        {file.generateRoads && file.neutralCastles === 0 && (
          <div className="hint">{T.roadsHint}</div>
        )}
        <CheckboxRow
          label={T.spawnFootholds}
          checked={file.spawnFootholds}
          onChange={(v) => patch((f) => { f.spawnFootholds = v; })}
        />
        <div className="hint">{T.footholdsHint}</div>
        <CheckboxRow
          label={T.randomPortals}
          checked={file.randomPortals}
          onChange={(v) => patch((f) => { f.randomPortals = v; })}
        />
        {file.randomPortals && (
          <SliderRow
            label={T.maxPortalConns}
            value={file.maxPortalConns}
            min={1}
            max={32}
            step={1}
            onChange={(v) => patch((f) => { f.maxPortalConns = v; })}
          />
        )}

        {file.topology === "Random" && (
          <>
            <CheckboxRow
              label={T.isolateplayers}
              checked={file.isolateplayers}
              onChange={(v) => patch((f) => { f.isolateplayers = v; })}
            />
            {file.isolateplayers && <div className="hint">{T.isolateHint}</div>}
          </>
        )}
      </Card>

      {file.advancedMode && (
        <>
          <Card title={T.advancedCard} badge={T.experimentalBadge}>
            <div className="hint">{T.advancedTuningHint}</div>
            <SliderRow
              label={T.playerZoneSize}
              value={file.playerZoneSize}
              min={0.5}
              max={2}
              step={0.05}
              format={formatTimes}
              onChange={(v) => patch((f) => { f.playerZoneSize = v; })}
              fieldKey="zones.player.size"
            />
            <SliderRow
              label={T.neutralZoneSize}
              value={file.neutralZoneSize}
              min={0.5}
              max={2}
              step={0.05}
              format={formatTimes}
              onChange={(v) => patch((f) => { f.neutralZoneSize = v; })}
              fieldKey="zones.neutral.size"
            />
            <div className="hint">{T.zoneSizeHint}</div>
            <SliderRow
              label={T.guardRandomization}
              value={Math.round(file.guardRandomization * 100)}
              min={0}
              max={50}
              step={1}
              suffix="%"
              onChange={(v) => patch((f) => { f.guardRandomization = v / 100; })}
              fieldKey="guards.randomization"
            />
            <div className="hint">{T.guardRandomizationHint}</div>
          </Card>

          <Card title={T.advancedNeutralCard}>
            <div className="hint">{T.advancedNeutralHint}</div>
            <SliderRow
              label={T.neutralLowNoCastle}
              value={file.neutralLowNoCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralLowNoCastle = v; })}
            />
            <SliderRow
              label={T.neutralLowCastle}
              value={file.neutralLowCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralLowCastle = v; })}
            />
            <SliderRow
              label={T.neutralMediumNoCastle}
              value={file.neutralMediumNoCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralMediumNoCastle = v; })}
            />
            <SliderRow
              label={T.neutralMediumCastle}
              value={file.neutralMediumCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralMediumCastle = v; })}
            />
            <SliderRow
              label={T.neutralHighNoCastle}
              value={file.neutralHighNoCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralHighNoCastle = v; })}
            />
            <SliderRow
              label={T.neutralHighCastle}
              value={file.neutralHighCastle}
              min={0}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.neutralHighCastle = v; })}
            />
            <FixButton fieldKey="zones.neutral.count" />
            <FieldError fieldKey="zones.neutral.count" />
            <FieldError fieldKey="zones.total" />
            <FieldWarnings fieldKey="zones.total" />

            <SliderRow
              label={T.minNeutralSeparation}
              value={file.minNeutralZonesBetweenPlayers}
              min={0}
              max={8}
              step={1}
              onChange={(v) => patch((f) => { f.minNeutralZonesBetweenPlayers = v; })}
              fieldKey="zones.minSeparation"
            />
            <FieldWarnings fieldKey="zones.minSeparation" />
            <div className="hint">{T.minSeparationHint}</div>
          </Card>
        </>
      )}
    </>
  );
}
