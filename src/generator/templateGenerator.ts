/**
 * Бочка модульного порта TemplateGenerator.cs.
 *
 * Публичная точка входа — generate(settings): RmgTemplate. Внутренности
 * экспортируются для тестов (планирование нейтральных зон, tuning,
 * топологические билдеры и т.д.).
 */

export { generate } from "./templateGenerator/generate";

// Общие константы и tuning
export {
  ZoneLetters,
  CONNECTIONS_PER_ZONE,
  DEFAULT_GUARD_RANDOMIZATION,
  GENERATOR_VERSION_LABEL,
  NEUTRAL_QUALITY_ORDER,
  computeContentScale,
  effectiveGuardRandomization,
  normalizeZoneSize,
  percentToModifier,
  resolveGuardReactionOverride,
  neutralZoneProfile,
  scaleBorderGuardValue,
  scaleGuardMultiplier,
  scaleNeutralGuardValue,
  scaleResourceValue,
  scaleStructureValue,
  roundAwayFromZero,
  roundHalfEven,
  formatUnitMultiplier,
} from "./templateGenerator/shared";
export type {
  GenerationTuning,
  NeutralZonePlan,
  NeutralZoneProfile,
} from "./templateGenerator/shared";

// Планирование нейтральных зон / hold city / смежность
export {
  buildNeutralZonePlan,
  buildTopologyAdjacency,
  buildOrderedLetters,
  buildBalancedRingLetters,
  buildBalancedChainLetters,
  buildBalancedNeutralRing,
  canHonorNeutralSeparation,
  pickHoldCityNeutralLetter,
  neutralZoneBalanceScore,
} from "./templateGenerator/neutralPlan";

// Правила игры / описание
export {
  buildGameRules,
  buildAdvancedWinConditions,
  buildTemplateDescription,
} from "./templateGenerator/rules";

// Zone layouts / mandatory content / count limits
export {
  buildZoneLayouts,
  buildAllMandatoryContent,
  buildAllContentCountLimits,
  mapQualityToTier,
} from "./templateGenerator/content";

// Билдеры зон
export {
  buildSpawnZone,
  buildNeutralZone,
  buildHubZone,
  buildOuterZoneRoads,
  buildConnectorZoneRoads,
  buildSideContentLimits,
  buildCenterContentLimits,
} from "./templateGenerator/zones";

// Топологии
export {
  buildVariant,
  buildVariantDefault,
  buildVariantRandom,
  buildVariantBalanced,
  buildVariantHubAndSpoke,
  buildVariantChain,
  buildVariantSharedWeb,
  buildVariantTournament,
} from "./templateGenerator/variants";

// Геометрия и связность
export {
  delaunayEdges,
  inCircumcircle,
  buildNonAdjacentDerangement,
  buildRandomPortalConnections,
  buildRingConnections,
  ensurePlayerZonesConnected,
  ensureFullConnectivity,
  makeVariant,
  buildBalancedRandomPositions,
  zoneQualityGroup,
  orderByRandomKey,
} from "./templateGenerator/topology";
export type { Pos, ProximityEdge } from "./templateGenerator/topology";

// Пост-процессоры
export {
  applyExperimentalSettings,
  applyZoneRoadDecorations,
  buildExperimentalBonuses,
  extractZoneLetter,
  getTierOverrides,
} from "./templateGenerator/experimental";
