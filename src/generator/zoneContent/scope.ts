import type { NeutralZoneTier } from "../enums";

/** Аналог C#-enum ZoneContentScopeKind (порядок значений сохранён). */
export const ZoneContentScopeKind = {
  Player: 0,
  NeutralGlobal: 1,
  NeutralPoor: 2,
  NeutralNormal: 3,
  NeutralRich: 4,
  NeutralPerZone: 5,
  RoadDecorations: 6,
} as const;

export type ZoneContentScopeKind = (typeof ZoneContentScopeKind)[keyof typeof ZoneContentScopeKind];

export interface ZoneContentScopeKey {
  kind: ZoneContentScopeKind;
  zoneLetter?: string | null;
}

export function zoneContentScopeKeyFromTier(tier: NeutralZoneTier): ZoneContentScopeKey {
  switch (tier) {
    case "Poor":
      return { kind: ZoneContentScopeKind.NeutralPoor };
    case "Normal":
      return { kind: ZoneContentScopeKind.NeutralNormal };
    case "Rich":
      return { kind: ZoneContentScopeKind.NeutralRich };
  }
}
