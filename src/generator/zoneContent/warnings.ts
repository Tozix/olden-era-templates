import type { GeneratorSettings, ZoneContentItem, ZoneContentList } from "../settings";
import type { NeutralZoneTier } from "../enums";
import { ZoneContentScopeKind, zoneContentScopeKeyFromTier } from "./scope";
import type { ZoneContentScopeKey } from "./scope";

/**
 * Порт EmitWarning + ZoneContentEmitWarnings + ZoneContentWarningProjection.
 * Сообщения локализованы на русский (C#-оригинал хранит английские строки,
 * форма и коды предупреждений идентичны).
 */

export interface EmitWarning {
  code: string;
  message: string;
  zoneName: string | null;
  sid: string | null;
}

export const EmitWarningCodes = {
  BiomeFilterIgnored: "BiomeFilter.Ignored",
  FactionAffinityIgnored: "FactionAffinity.Ignored",
  PoolNonMandatoryDropped: "Pool.NonMandatoryDropped",
  MinCountRangeNarrowedToMax: "MinCount.RangeNarrowedToMax",
} as const;

/** Проверка одного элемента контента перед эмитом (ZoneContentEmitWarnings.Inspect). */
export function inspectEmitWarnings(item: ZoneContentItem, zoneName: string | null): EmitWarning[] {
  const warnings: EmitWarning[] = [];

  if (item.biomeFilter.length > 0) {
    warnings.push({
      code: EmitWarningCodes.BiomeFilterIgnored,
      message: "BiomeFilter не имеет слота в схеме и будет проигнорирован.",
      zoneName,
      sid: item.sid,
    });
  }

  if (item.factionAffinity.length > 0) {
    warnings.push({
      code: EmitWarningCodes.FactionAffinityIgnored,
      message: "FactionAffinity не имеет слота в схеме и будет проигнорирован.",
      zoneName,
      sid: item.sid,
    });
  }

  if (item.pool !== "Mandatory") {
    warnings.push({
      code: EmitWarningCodes.PoolNonMandatoryDropped,
      message: `Пул '${item.pool}' не эмитится в v1; элемент будет пропущен.`,
      zoneName,
      sid: item.sid,
    });
  }

  if (item.minCount !== item.maxCount) {
    warnings.push({
      code: EmitWarningCodes.MinCountRangeNarrowedToMax,
      message: `Диапазон количества ${item.minCount}-${item.maxCount} сужен до ${item.maxCount}.`,
      zoneName,
      sid: item.sid,
    });
  }

  return warnings;
}

export interface ZoneContentWarning {
  scope: ZoneContentScopeKey;
  handle: string | null;
  itemIndex: number;
  warning: EmitWarning;
}

function inspectList(
  list: ZoneContentList,
  scope: ZoneContentScopeKey,
  zoneName: string | null,
  result: ZoneContentWarning[],
): void {
  for (let i = 0; i < list.items.length; i++) {
    const item = list.items[i];
    for (const w of inspectEmitWarnings(item, zoneName)) {
      result.push({ scope, handle: item.handle ?? null, itemIndex: i, warning: w });
    }
  }
}

/** Проекция предупреждений эмита по всем скоупам настроек (ZoneContentWarningProjection.Project). */
export function projectZoneContentWarnings(settings: GeneratorSettings): ZoneContentWarning[] {
  const result: ZoneContentWarning[] = [];

  inspectList(
    settings.playerZoneContent,
    { kind: ZoneContentScopeKind.Player },
    "Player",
    result,
  );

  inspectList(
    settings.neutralZoneContent.global,
    { kind: ZoneContentScopeKind.NeutralGlobal },
    "Neutral",
    result,
  );

  for (const [tier, list] of Object.entries(settings.neutralZoneContent.byTier)) {
    if (!list) continue;
    inspectList(list, zoneContentScopeKeyFromTier(tier as NeutralZoneTier), `Neutral.${tier}`, result);
  }

  for (const [letter, list] of Object.entries(settings.neutralZoneContent.byZoneLetter)) {
    inspectList(list, { kind: ZoneContentScopeKind.NeutralPerZone, zoneLetter: letter }, letter, result);
  }

  return result;
}
