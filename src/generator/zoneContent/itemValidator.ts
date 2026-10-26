import type { ZoneContentItem } from "../settings";
import { inspectEmitWarnings } from "./warnings";
import type { EmitWarning } from "./warnings";

/**
 * Порт ZoneContentItemValidator: проверка одного ZoneContentItem на
 * самосогласованность; возвращает человекочитаемые замечания для хостов.
 *
 * Правила:
 * - Sid должен быть непустым;
 * - MinCount >= 0;
 * - MaxCount >= MinCount;
 * - NearCastle несовместим с RoadDistance=Far.
 */

export function validateZoneContentItem(item: ZoneContentItem): string[] {
  const issues: string[] = [];

  if (item.sid.trim().length === 0) issues.push("Sid must be non-empty.");

  if (item.minCount < 0) issues.push("MinCount must be >= 0.");

  if (item.maxCount < item.minCount) {
    issues.push(`MaxCount (${item.maxCount}) must be >= MinCount (${item.minCount}).`);
  }

  if (item.nearCastle && item.roadDistance === "Far") {
    issues.push("NearCastle is incompatible with RoadDistance=Far.");
  }

  return issues;
}

/** Предупреждения времени эмита для элемента (делегирует inspectEmitWarnings). */
export function inspectItemEmit(item: ZoneContentItem, zoneName: string | null): EmitWarning[] {
  return inspectEmitWarnings(item, zoneName);
}
