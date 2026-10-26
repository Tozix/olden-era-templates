/** Строковые enum'ы — значения совпадают с сериализацией .oetgs (JsonStringEnumConverter). */

export type MapTopology =
  | "Default" // зоны по кругу, каждая связана с соседями
  | "HubAndSpoke" // все зоны к центральному hub
  | "Chain" // линия без замыкания
  | "SharedWeb" // игроки через общие нейтральные зоны
  | "Random" // случайные позиции + proximity-связи
  | "Balanced"; // концентрические кольца по tier'у

export const MAP_TOPOLOGIES: MapTopology[] = [
  "Default",
  "HubAndSpoke",
  "Chain",
  "SharedWeb",
  "Random",
  "Balanced",
];

export type GuardReactionPreset =
  | "Default"
  | "FrontLoaded"
  | "Even"
  | "BackLoaded"
  | "Custom";

export type ZoneContentPool = "Mandatory" | "Guarded" | "Unguarded" | "Resources";

export type NeutralZoneTier = "Poor" | "Normal" | "Rich";

export const NEUTRAL_ZONE_TIERS: NeutralZoneTier[] = ["Poor", "Normal", "Rich"];

export type ZoneRoadType = "Stone" | "Dirt";

export type ZoneRoadEndpointKind = "Connection" | "MainObject" | "MandatoryContent";

export type RoadDistance = "Close" | "Mid" | "Far";

export type NeutralZoneQuality = "Low" | "Medium" | "High";

export type ExperimentalStatus = "Experimental" | "Graduated";
