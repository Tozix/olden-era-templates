import type { RoadDistance } from "../enums";
import type { ZoneContentItem, ZoneContentRule } from "../settings";
import type { ContentItemSchema, ContentPlacementRule, MandatoryContentGroup } from "../template";
import { inspectEmitWarnings, EmitWarningCodes } from "./warnings";
import type { EmitWarning } from "./warnings";

/**
 * Порт ZoneContentEmitter: настройки ZoneContentItem → строки схемы
 * ContentItemSchema внутри MandatoryContentGroup.
 */

// Диапазоны из docs/plans/2026-05-12-zone-content-schema-research.md, раздел «Common ranges».
const NEAR_CASTLE_TARGET_MIN = 0.05;
const NEAR_CASTLE_TARGET_MAX = 0.25;
const ROAD_TARGET_RANGES: Record<RoadDistance, [number, number]> = {
  Close: [0.1, 0.2],
  Mid: [0.3, 0.5],
  Far: [0.6, 0.85],
};

export interface EmitResult {
  warnings: EmitWarning[];
}

export function applyToMandatoryGroup(
  group: MandatoryContentGroup,
  items: readonly ZoneContentItem[],
  zoneName: string,
  referencedNames: ReadonlySet<string>,
): EmitResult {
  const warnings: EmitWarning[] = [];
  group.content ??= [];

  const occurrenceBySid = new Map<string, number>();

  for (const item of items) {
    const itemWarnings = inspectEmitWarnings(item, zoneName);
    warnings.push(...itemWarnings);

    if (itemWarnings.some((w) => w.code === EmitWarningCodes.PoolNonMandatoryDropped)) continue;

    for (let copy = 0; copy < item.maxCount; copy++) {
      const occurrence = occurrenceBySid.get(item.sid) ?? 0;
      occurrenceBySid.set(item.sid, occurrence + 1);

      const name = resolveName(item, zoneName, occurrence, referencedNames);

      // Порядок ключей = порядок свойств C#-модели ContentItem.
      const row: ContentItemSchema = {
        name,
        sid: item.isGroup ? null : item.sid,
        isGuarded: item.isGuarded ? true : null,
        includeLists: item.isGroup ? [item.sid] : null,
      };

      // T-605: добавить выбранные из каталога content-list ID. Сливаются
      // с legacy-списком из IsGroup (одиночный элемент) без дубликатов,
      // с сохранением исходного порядка.
      if (item.includeListIds.length > 0) {
        if (row.includeLists === null || row.includeLists === undefined) row.includeLists = [];
        for (const id of item.includeListIds) {
          if (id.trim().length === 0) continue;
          if (!row.includeLists.includes(id)) row.includeLists.push(id);
        }
      }

      const rules = buildPlacementRules(item);
      if (rules.length > 0) row.rules = rules;

      group.content.push(row);
    }
  }

  return { warnings };
}

function resolveName(
  item: ZoneContentItem,
  zoneName: string,
  occurrence: number,
  referencedNames: ReadonlySet<string>,
): string | null {
  // Аналог !string.IsNullOrEmpty(item.Handle).
  if (item.handle !== null && item.handle !== undefined && item.handle.length > 0) return item.handle;
  const auto = `name_user_${zoneName}_${item.sid}_${occurrence}`;
  return referencedNames.has(auto) ? auto : null;
}

function buildPlacementRules(item: ZoneContentItem): ContentPlacementRule[] {
  const rules: ContentPlacementRule[] = [];

  if (item.nearCastle) {
    rules.push({
      type: "MainObject",
      args: ["0"],
      targetMin: NEAR_CASTLE_TARGET_MIN,
      targetMax: NEAR_CASTLE_TARGET_MAX,
      weight: 1,
    });
  }

  const rd: RoadDistance | null | undefined = item.roadDistance;
  if (rd !== null && rd !== undefined) {
    const [min, max] = ROAD_TARGET_RANGES[rd];
    rules.push({ type: "Road", args: [], targetMin: min, targetMax: max, weight: 1 });
  }

  // T-202: явно заданные пользователем правила дописываются после
  // авто-правил. Строки без Type отбрасываются, чтобы «пустая» строка
  // в UI не отравила эмит.
  for (const user of item.rules) {
    if (!user.type || user.type.trim().length === 0) continue;
    rules.push(buildUserRule(user));
  }

  return rules;
}

function buildUserRule(user: ZoneContentRule): ContentPlacementRule {
  return {
    type: user.type ?? null,
    args: [...user.args],
    targetMin: user.targetMin ?? null,
    targetMax: user.targetMax ?? null,
    weight: user.weight ?? null,
  };
}
