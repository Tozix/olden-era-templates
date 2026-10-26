import { useApp } from "../../state/settingsStore";
import { Card, CheckboxRow, SelectField, SliderRow, TextField } from "../../components/ui";
import { VICTORY_CONDITION_IDS, VICTORY_CONDITION_LABELS_RU } from "../../generator/knownValues";

const T = {
  modifiersCard: "Игровые модификаторы",
  factionLawsExp: "Опыт законов фракций",
  factionLawsHint: "Масштабирует получение очков законов, открывающих пассивные улучшения фракции.",
  astrologyExp: "Опыт астрологии",
  astrologyHint: "Масштабирует получение очков астрологии, открывающих и улучшающих нейтральные заклинания.",
  winCard: "Условия победы",
  victoryCondition: "Основное условие победы",
  displayWinCondition: "Отображаемое условие победы",
  displayWinConditionPlaceholder: "Пусто — использовать выбранный ID",
  displayWinConditionHint:
    "Переопределяет поле displayWinCondition в шаблоне. Пустое значение — используется выбранное основное условие победы.",
  defeatHeader: "Условия поражения",
  lostStartCity: "Проиграть при потере стартового города",
  lostStartCityDay: "День потери города",
  lostStartHero: "Проиграть при потере стартового героя",
  heroLighting: "Возрождение героя",
  heroLightingDay: "День возрождения",
  lockedByLostCity: "Заблокировано: основное условие победы — «Потеря стартового города».",
  lockedByTournament: "Заблокировано: основное условие победы — «Турнир».",
  lockedByCityHold: "Заблокировано: основное условие победы — «Удержание города».",
  // TODO: verify wording against in-game Russian localization (правило heroLighting / возрождения героя)
  alternateHeader: "Альтернативные условия победы",
  cityHold: "Победа удержанием нейтрального города",
  cityHoldDays: "Дней удержания",
  gladiatorArena: "Использовать правила гладиаторской арены",
  gladiatorArenaDelay: "Арена открывается с дня",
  gladiatorArenaCountDay: "День подсчёта побед арены",
  tournamentHeader: "Турнир",
  tournament: "Использовать правила турнира",
  tournamentPointsToWin: "Очков для победы",
  tournamentFirstDay: "Первый бой в день",
  tournamentInterval: "Интервал между боями (дней)",
  tournamentSaveArmy: "Сохранять армию после боёв",
};

export function WinConditionsPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const isTournament = file.victoryCondition === "win_condition_6";
  const isLostCityWin = file.victoryCondition === "win_condition_3";
  const isCityHoldWin = file.victoryCondition === "win_condition_5";

  const victoryOptions = VICTORY_CONDITION_IDS.map((id, i) => ({
    value: id,
    label: VICTORY_CONDITION_LABELS_RU[i] ?? id,
  }));

  // Порт ApplyVictoryPreset (MainWindow / OnVictoryChanged в razor): смена
  // условия победы сбрасывает зависимые правила, затем включает нужные.
  const applyVictoryPreset = (v: string) =>
    patch((f) => {
      f.victoryCondition = v;
      f.lostStartCity = false;
      f.lostStartHero = false;
      f.cityHold = false;
      f.lostStartCityDay = 3;
      f.cityHoldDays = 6;
      f.gladiatorArena = false;
      f.gladiatorArenaDaysDelayStart = 30;
      f.gladiatorArenaCountDay = 3;
      f.tournament = false;
      f.tournamentPointsToWin = 2;
      f.tournamentInterval = 7;
      f.tournamentFirstTournamentDay = 14;
      f.tournamentSaveArmy = true;

      switch (v) {
        case "win_condition_3":
          f.lostStartCity = true;
          break;
        case "win_condition_4":
          f.lostStartHero = true;
          f.gladiatorArena = true;
          break;
        case "win_condition_5":
          f.cityHold = true;
          break;
        case "win_condition_6":
          f.lostStartHero = true;
          f.tournament = true;
          f.gladiatorArenaDaysDelayStart = 21;
          f.gladiatorArenaCountDay = 8;
          break;
      }
    });

  const lostCityLocked = isTournament || isLostCityWin;
  const cityHoldLocked = isTournament || isCityHoldWin;

  return (
    <>
      <Card title={T.modifiersCard}>
        <SliderRow
          label={T.factionLawsExp}
          value={file.factionLawsExp}
          min={25}
          max={200}
          step={25}
          suffix="%"
          onChange={(v) => patch((f) => { f.factionLawsExp = v; })}
        />
        <div className="hint">{T.factionLawsHint}</div>
        <SliderRow
          label={T.astrologyExp}
          value={file.astrologyExp}
          min={25}
          max={200}
          step={25}
          suffix="%"
          onChange={(v) => patch((f) => { f.astrologyExp = v; })}
        />
        <div className="hint">{T.astrologyHint}</div>
      </Card>

      <Card title={T.winCard}>
        <SelectField
          label={T.victoryCondition}
          value={file.victoryCondition}
          options={victoryOptions}
          onChange={applyVictoryPreset}
        />
        <TextField
          label={T.displayWinCondition}
          value={file.displayWinConditionOverride}
          placeholder={T.displayWinConditionPlaceholder}
          onChange={(v) => patch((f) => { f.displayWinConditionOverride = v; })}
        />
        <div className="hint">{T.displayWinConditionHint}</div>

        <h4>{T.defeatHeader}</h4>

        <CheckboxRow
          label={T.lostStartCity}
          checked={file.lostStartCity}
          disabled={lostCityLocked}
          onChange={(v) => patch((f) => { f.lostStartCity = v; })}
        />
        {lostCityLocked && (
          <div className="hint">{isLostCityWin ? T.lockedByLostCity : T.lockedByTournament}</div>
        )}
        <SliderRow
          label={T.lostStartCityDay}
          value={file.lostStartCityDay}
          min={1}
          max={30}
          step={1}
          disabled={!file.lostStartCity || lostCityLocked}
          onChange={(v) => patch((f) => { f.lostStartCityDay = v; })}
        />

        <CheckboxRow
          label={T.lostStartHero}
          checked={file.lostStartHero}
          disabled={isTournament}
          onChange={(v) => patch((f) => { f.lostStartHero = v; })}
        />
        {isTournament && <div className="hint">{T.lockedByTournament}</div>}

        <CheckboxRow
          label={T.heroLighting}
          checked={file.heroLighting}
          onChange={(v) => patch((f) => { f.heroLighting = v; })}
        />
        <SliderRow
          label={T.heroLightingDay}
          value={file.heroLightingDay}
          min={1}
          max={30}
          step={1}
          disabled={!file.heroLighting}
          onChange={(v) => patch((f) => { f.heroLightingDay = v; })}
        />

        <h4>{T.alternateHeader}</h4>

        <CheckboxRow
          label={T.cityHold}
          checked={file.cityHold}
          disabled={cityHoldLocked}
          onChange={(v) => patch((f) => { f.cityHold = v; })}
        />
        {cityHoldLocked && (
          <div className="hint">{isCityHoldWin ? T.lockedByCityHold : T.lockedByTournament}</div>
        )}
        <SliderRow
          label={T.cityHoldDays}
          value={file.cityHoldDays}
          min={1}
          max={30}
          step={1}
          disabled={!file.cityHold || cityHoldLocked}
          onChange={(v) => patch((f) => { f.cityHoldDays = v; })}
        />

        <CheckboxRow
          label={T.gladiatorArena}
          checked={file.gladiatorArena}
          disabled={isTournament}
          onChange={(v) => patch((f) => { f.gladiatorArena = v; })}
        />
        {isTournament && <div className="hint">{T.lockedByTournament}</div>}
        {file.gladiatorArena && (
          <>
            <SliderRow
              label={T.gladiatorArenaDelay}
              value={file.gladiatorArenaDaysDelayStart}
              min={1}
              max={60}
              step={1}
              onChange={(v) => patch((f) => { f.gladiatorArenaDaysDelayStart = v; })}
            />
            <SliderRow
              label={T.gladiatorArenaCountDay}
              value={file.gladiatorArenaCountDay}
              min={1}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.gladiatorArenaCountDay = v; })}
            />
          </>
        )}

        {(isTournament || file.tournament) && (
          <>
            <h4>{T.tournamentHeader}</h4>
            <CheckboxRow
              label={T.tournament}
              checked={file.tournament}
              onChange={(v) => patch((f) => { f.tournament = v; })}
            />
            <SliderRow
              label={T.tournamentPointsToWin}
              value={file.tournamentPointsToWin}
              min={1}
              max={10}
              step={1}
              onChange={(v) => patch((f) => { f.tournamentPointsToWin = v; })}
            />
            <SliderRow
              label={T.tournamentFirstDay}
              value={file.tournamentFirstTournamentDay}
              min={3}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.tournamentFirstTournamentDay = v; })}
            />
            <SliderRow
              label={T.tournamentInterval}
              value={file.tournamentInterval}
              min={3}
              max={30}
              step={1}
              onChange={(v) => patch((f) => { f.tournamentInterval = v; })}
            />
            <CheckboxRow
              label={T.tournamentSaveArmy}
              checked={file.tournamentSaveArmy}
              onChange={(v) => patch((f) => { f.tournamentSaveArmy = v; })}
            />
          </>
        )}
      </Card>
    </>
  );
}
