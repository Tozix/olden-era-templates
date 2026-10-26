import type { ZoneRoadDecoration, ZoneRoadEndpoint } from "../settings";
import type { ZoneRoadEndpointKind, ZoneRoadType } from "../enums";
import type { Road, RoadEndpoint, Zone } from "../template";

/**
 * Порт ZoneRoadDecorationEmitter: пост-пасс, добавляющий пользовательские
 * дорожные декорации в Zone.roads (список инициализируется при null;
 * существующие записи сохраняются).
 */

export function applyRoadDecorationsToZone(
  zone: Zone,
  decorationsForThisZone: readonly ZoneRoadDecoration[],
): void {
  zone.roads ??= [];
  for (const d of decorationsForThisZone) {
    zone.roads.push({
      type: roadTypeToSchemaType(d.roadType),
      from: toSchemaEndpoint(d.from),
      to: toSchemaEndpoint(d.to),
    });
  }
}

/**
 * Плоское множество без дубликатов имён MandatoryContent-аргументов,
 * на которые ссылается хоть один endpoint любой декорации. Остальные
 * виды endpoint'ов игнорируются.
 */
export function referencedRoadDecorationItems(
  decorations: readonly ZoneRoadDecoration[],
): Set<string> {
  const set = new Set<string>();
  for (const d of decorations) {
    if (d.from.kind === "MandatoryContent") set.add(d.from.arg);
    if (d.to.kind === "MandatoryContent") set.add(d.to.arg);
  }
  return set;
}

function toSchemaEndpoint(e: ZoneRoadEndpoint): RoadEndpoint {
  return { type: kindToSchemaType(e.kind), args: [e.arg] };
}

function kindToSchemaType(kind: ZoneRoadEndpointKind): string {
  switch (kind) {
    case "Connection":
      return "Connection";
    case "MainObject":
      return "MainObject";
    case "MandatoryContent":
      return "MandatoryContent";
  }
}

function roadTypeToSchemaType(type: ZoneRoadType): string {
  switch (type) {
    case "Stone":
      return "Stone";
    case "Dirt":
      return "Dirt";
  }
}
