import type { MapTopology } from "../enums";
import type { GeneratorSettings } from "../settings";
import type { GameRules, WinConditions } from "../template";
import { GENERATOR_VERSION_LABEL, percentToModifier } from "./shared";

/**
 * Порт правил игры TemplateGenerator.cs: BuildGameRules,
 * BuildAdvancedWinConditions, BuildTemplateDescription.
 */

export function buildGameRules(settings: GeneratorSettings, effectiveVictoryCondition: string): GameRules {
  // T-505: shipped hold-city шаблоны несут top-level `gameRules.holdCityWinCon: true`
  // в дополнение к per-MainObject флагу из BuildHubZone / BuildNeutralZone.
  // Тот же гейт, что заполняет winConditions.cityHold — чтобы значения не расходились.
  const useCityHold =
    settings.gameEndConditions.cityHold || effectiveVictoryCondition === "win_condition_5";

  return {
    heroCountMin: settings.heroSettings.heroCountMin - settings.heroSettings.heroCountIncrement,
    heroCountMax: settings.heroSettings.heroCountMax,
    heroCountIncrement: settings.heroSettings.heroCountIncrement,
    heroHireBan: false,
    encounterHoles: settings.encounterHoles.enabled,
    factionLawsExpModifier: percentToModifier(settings.factionLawsExpPercent),
    astrologyExpModifier: percentToModifier(settings.astrologyExpPercent),
    bonuses: [
      {
        sid: "add_bonus_hero_stat",
        receiverSide: -1,
        receiverFilter: "all_heroes",
        parameters: ["movementBonus", "0"],
      },
    ],
    winConditions: buildAdvancedWinConditions(settings, effectiveVictoryCondition),
    holdCityWinCon: useCityHold ? true : null,
  };
}

export function buildAdvancedWinConditions(
  settings: GeneratorSettings,
  effectiveVictoryCondition: string,
): WinConditions {
  const useLostStartCity =
    settings.gameEndConditions.lostStartCity || effectiveVictoryCondition === "win_condition_3";
  const useCityHold =
    settings.gameEndConditions.cityHold || effectiveVictoryCondition === "win_condition_5";
  const useGladiator =
    settings.gladiatorArenaRules.enabled || effectiveVictoryCondition === "win_condition_4";
  const useTournament =
    settings.tournamentRules.enabled || effectiveVictoryCondition === "win_condition_6";

  // T-506 — heroLighting/heroLightingDay управляются пользователем.
  // Дефолт (HeroLighting=true, HeroLightingDay=1) воспроизводит shipped-preset
  // эмит байт-в-байт; HeroLighting=false полностью убирает оба поля.
  const heroLightingOn = settings.gameEndConditions.heroLighting;
  const heroLightingDay = clampInt(settings.gameEndConditions.heroLightingDay, 1, 30);

  // Порядок ключей = порядок свойств C#-модели WinConditions.
  const winConditions: WinConditions = {
    classic: true,
    desertion: true,
    desertionDay: 3,
    desertionValue: 3000,
    heroLighting: heroLightingOn ? true : null,
    heroLightingDay: heroLightingOn ? heroLightingDay : null,
    lostStartCity: useLostStartCity,
    lostStartCityDay: clampInt(settings.gameEndConditions.lostStartCityDay, 1, 30),
    lostStartHero: settings.gameEndConditions.lostStartHero || useGladiator,
    cityHold: useCityHold,
    cityHoldDays: clampInt(settings.gameEndConditions.cityHoldDays, 1, 30),
  };

  if (useGladiator) {
    winConditions.gladiatorArena = true;
    winConditions.gladiatorArenaRegistrationStartWork = false;
    winConditions.gladiatorArenaRegistrationStartFight = true;
    winConditions.gladiatorArenaDaysDelayStart = clampInt(settings.gladiatorArenaRules.daysDelayStart, 1, 60);
    winConditions.gladiatorArenaCountDay = clampInt(settings.gladiatorArenaRules.countDay, 1, 30);
    winConditions.championSelectRule = "StartHero";
  }

  if (useTournament) {
    const firstTournamentDay = clampInt(settings.tournamentRules.firstTournamentDay, 3, 60);
    const tournamentInterval = clampInt(settings.tournamentRules.interval, 3, 30);
    const pointsToWin = clampInt(settings.tournamentRules.pointsToWin, 1, 10);
    // Число раундов выводится из points to win: при N очков максимум раундов 2N-1.
    const roundCount = pointsToWin * 2 - 1;

    // Каждый раунд анонсируется как можно раньше:
    // - Раунд 0: анонс на ходу 1 (минимум, который поддерживает игра), бой на firstTournamentDay.
    // - Раунд i>0: анонс за 1 день до предыдущего боя, бой через tournamentInterval дней.
    // tournamentAnnounceDays[i] = абсолютный ход анонса;
    // tournamentDays[i]         = относительное смещение от анонса до боя.
    const announceDays: number[] = new Array(roundCount);
    const battleOffsets: number[] = new Array(roundCount);
    let previousBattleTurn = 0;
    for (let i = 0; i < roundCount; i++) {
      const announceTurn = i === 0 ? 1 : previousBattleTurn + 1;
      const offset = i === 0 ? firstTournamentDay - 1 : tournamentInterval - 1;
      announceDays[i] = announceTurn;
      battleOffsets[i] = offset;
      previousBattleTurn = announceTurn + offset;
    }

    // Присвоение в порядке объявления свойств модели (tournamentDays раньше
    // tournamentAnnounceDays), чтобы порядок ключей JSON совпадал с C#.
    winConditions.championSelectRule = "StartHero";
    winConditions.tournament = true;
    winConditions.tournamentDays = battleOffsets;
    winConditions.tournamentAnnounceDays = announceDays;
    winConditions.tournamentPointsToWin = pointsToWin;
    winConditions.tournamentSaveArmy = true;
  }

  return winConditions;
}

export function buildTemplateDescription(settings: GeneratorSettings, neutralZoneCount: number): string {
  const parts = [
    `${topologyLabel(settings.topology)} layout`,
    countPhrase(neutralZoneCount, "neutral zone", "neutral zones"),
    `${countPhrase(settings.zoneCfg.playerZoneCastles, "castle", "castles")} per player zone`,
  ];

  if (neutralZoneCount > 0) {
    const neutralCastlePhrase = settings.zoneCfg.advanced.enabled
      ? "mixed neutral zone tiers"
      : `${countPhrase(settings.zoneCfg.neutralZoneCastles, "castle", "castles")} per neutral zone`;
    parts.push(neutralCastlePhrase);
  }

  const options: string[] = [];
  if (settings.noDirectPlayerConnections) options.push("isolated player starts");
  if (settings.randomPortals) options.push("random portals");
  if (!settings.spawnRemoteFootholds) options.push("no remote footholds");
  if (!settings.generateRoads) options.push("roads disabled");

  if (options.length > 0) parts.push(`options: ${options.join(", ")}`);

  return `Generated with Olden Era Template Generator ${GENERATOR_VERSION_LABEL}: ${parts.join(", ")}.`;
}

export function countPhrase(count: number, singular: string, plural: string): string {
  return count === 0 ? `no ${plural}` : `${count} ${count === 1 ? singular : plural}`;
}

export function topologyLabel(topology: MapTopology): string {
  switch (topology) {
    case "Default":
      return "Ring";
    case "HubAndSpoke":
      return "Hub";
    case "Chain":
      return "Chain";
    case "SharedWeb":
      return "Shared Web";
    case "Random":
      return "Random";
    case "Balanced":
      return "Balanced";
    default:
      return topology;
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
