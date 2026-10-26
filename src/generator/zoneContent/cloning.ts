import {
  emptyZoneContentList,
  emptyNeutralZoneContent,
  type GeneratorSettings,
  type NeutralZoneContent,
  type ZoneContentItem,
  type ZoneContentList,
  type ZoneRoadDecoration,
  type ZoneRoadEndpoint,
} from "../settings";

/**
 * Порт ZoneContentCloning: централизованное глубокое клонирование деревьев
 * zone-content на GeneratorSettings. SettingsMapper алиасит эти деревья,
 * поэтому UI, меняющий форму списков, обязан клонировать заранее.
 */

export function cloneItem(source: ZoneContentItem): ZoneContentItem {
  return {
    sid: source.sid,
    handle: source.handle,
    isGroup: source.isGroup,
    minCount: source.minCount,
    maxCount: source.maxCount,
    pool: source.pool,
    isGuarded: source.isGuarded,
    nearCastle: source.nearCastle,
    roadDistance: source.roadDistance,
    factionAffinity: [...source.factionAffinity],
    biomeFilter: [...source.biomeFilter],
    includeListIds: [...source.includeListIds],
    rules: source.rules.map((r) => ({
      type: r.type,
      args: [...r.args],
      targetMin: r.targetMin,
      targetMax: r.targetMax,
      weight: r.weight,
    })),
  };
}

export function cloneList(source: ZoneContentList): ZoneContentList {
  return { items: source.items.map(cloneItem) };
}

export function cloneNeutral(source: NeutralZoneContent): NeutralZoneContent {
  const clone: NeutralZoneContent = {
    global: cloneList(source.global),
    byTier: {},
    byZoneLetter: {},
  };
  for (const [tier, list] of Object.entries(source.byTier)) {
    if (!list) continue;
    clone.byTier[tier as keyof NeutralZoneContent["byTier"]] = cloneList(list);
  }
  for (const [letter, list] of Object.entries(source.byZoneLetter)) {
    clone.byZoneLetter[letter] = cloneList(list);
  }
  return clone;
}

export function cloneRoadEndpoint(source: ZoneRoadEndpoint): ZoneRoadEndpoint {
  return { kind: source.kind, arg: source.arg };
}

export function cloneRoadDecoration(source: ZoneRoadDecoration): ZoneRoadDecoration {
  return {
    zone: source.zone,
    roadType: source.roadType,
    from: cloneRoadEndpoint(source.from),
    to: cloneRoadEndpoint(source.to),
  };
}

export function cloneRoadDecorations(source: readonly ZoneRoadDecoration[]): ZoneRoadDecoration[] {
  return source.map(cloneRoadDecoration);
}

/**
 * Поверхностный клон source с четырьмя zone-content-слотами, заменёнными
 * свежими пустыми инстансами. Используется UX «inspect-defaults», где нужно
 * увидеть, что сгенерировал бы генератор без пер-зонных переопределений.
 * Вложенные не-zone-content настройки остаются разделяемыми с source —
 * это read-only вью для сравнения с дефолтами, они их не мутирует.
 */
export function cloneWithDefaultsBlanked(source: GeneratorSettings): GeneratorSettings {
  return {
    ...source,
    playerZoneContent: emptyZoneContentList(),
    neutralZoneContent: emptyNeutralZoneContent(),
    zoneRoadDecorations: [],
  };
}
