import { Rng } from "../rng";
import type { GeneratorSettings } from "../settings";
import type { RmgTemplate } from "../template";
import {
  computeContentScale,
  effectiveGuardRandomization,
  resolveGuardReactionOverride,
  ZoneLetters,
  type GenerationTuning,
} from "./shared";
import {
  buildNeutralZonePlan,
  buildTopologyAdjacency,
  pickHoldCityNeutralLetter,
} from "./neutralPlan";
import { buildGameRules, buildTemplateDescription } from "./rules";
import { buildAllContentCountLimits, buildAllMandatoryContent, buildZoneLayouts } from "./content";
import { buildVariant } from "./variants";
import { applyExperimentalSettings, applyZoneRoadDecorations } from "./experimental";
import type { NeutralZoneQuality } from "../enums";

/**
 * Точка входа генератора — порт TemplateGenerator.Generate.
 * Структура — Jebus Cross Classic. JSON-эмит выполняет вызывающий код
 * (toJsonIndented с отбрасыванием null); генератор возвращает дерево объектов,
 * порядок ключей которых повторяет порядок свойств C#-моделей.
 */
export function generate(settings: GeneratorSettings): RmgTemplate {
  const rng = new Rng(settings.seed ?? null);
  const playerLetters = ZoneLetters.slice(0, Math.max(0, settings.playerCount));
  const neutralZones = buildNeutralZonePlan(settings);

  // Когда city hold активен на Hub & Spoke, сам hub становится hold city,
  // и ни одна нейтральная зона не носит этот флаг. Для остальных топологий
  // лучшая нейтральная-кандидат выбирается сейчас, чтобы все нижние билдеры
  // могли её запросить.
  const useCityHold =
    settings.gameEndConditions.cityHold || settings.gameEndConditions.victoryCondition === "win_condition_5";
  let holdCityNeutralLetter: string | null = null;
  if (useCityHold && settings.topology !== "HubAndSpoke") {
    const adjacency = buildTopologyAdjacency(settings, playerLetters, neutralZones);
    holdCityNeutralLetter = pickHoldCityNeutralLetter(neutralZones, playerLetters, adjacency);
  }

  // Hub & Spoke решает изоляцию через hub; для остальных топологий изоляция
  // делается пропуском player–player подключений — авто-создание нейтральных
  // зон не требуется.
  const neutralCount = neutralZones.length;

  const totalZones = settings.playerCount + neutralCount;
  const tuning: GenerationTuning = {
    contentScale: computeContentScale(settings.mapSize, totalZones),
    resourceDensityMultiplier: settings.zoneCfg.resourceDensityPercent / 200.0,
    structureDensityMultiplier: settings.zoneCfg.structureDensityPercent / 100.0,
    neutralStackStrengthMultiplier: settings.zoneCfg.neutralStackStrengthPercent / 100.0,
    borderGuardStrengthMultiplier: settings.zoneCfg.borderGuardStrengthPercent / 100.0,
    guardRandomization: effectiveGuardRandomization(
      settings.zoneCfg.advanced.guardRandomization,
      settings.zoneCfg.advanced.enabled,
    ),
    guardReactionOverride: resolveGuardReactionOverride(settings.guardReaction),
  };

  const effectiveVictoryCondition = settings.gameEndConditions.victoryCondition;

  const template: RmgTemplate = {
    name: settings.templateName,
    gameMode: settings.gameMode,
    // T-504 — пользовательское описание выигрывает; пустое → авто-сборка.
    description:
      settings.description.length === 0
        ? buildTemplateDescription(settings, neutralCount)
        : settings.description,
    displayWinCondition:
      settings.displayWinCondition.length === 0
        ? effectiveVictoryCondition
        : settings.displayWinCondition,
    sizeX: settings.mapSize,
    sizeZ: settings.mapSize,
    gameRules: buildGameRules(settings, effectiveVictoryCondition),
    // null-заглушки фиксируют позиции ключей valueOverrides/globalBans —
    // экспериментальный пост-процессор дописывает их позже.
    valueOverrides: null,
    globalBans: null,
    variants: [
      buildVariant(
        settings,
        playerLetters,
        neutralZones,
        tuning,
        rng,
        holdCityNeutralLetter,
        useCityHold && settings.topology === "HubAndSpoke",
      ),
    ],
    zoneLayouts: buildZoneLayouts(),
    mandatoryContent: buildAllMandatoryContent(playerLetters, neutralZones, settings),
    contentCountLimits: buildAllContentCountLimits(),
    contentPools: [],
    contentLists: [],
  };

  applyZoneRoadDecorations(template, settings);

  const tierByLetter = new Map<string, NeutralZoneQuality>(
    neutralZones.map((p) => [p.letter, p.quality] as [string, NeutralZoneQuality]),
  );
  applyExperimentalSettings(template, settings, tierByLetter);
  return template;
}
