import type { NeutralZoneTier } from "../enums";
import type { NeutralZoneContent, ZoneContentItem, ZoneContentList } from "../settings";

/**
 * Порт ZoneContentResolver: слияние слоёной NeutralZoneContent-конфигурации
 * в одинResolved ZoneContentList для эмита.
 *
 * Элементы добавляются при первой встрече их Sid с сохранением порядка
 * вставки. Записи с тем же Sid из поздних слоёв ЗАМЕНЯЮТ ранние значения
 * на месте: не дублируются и не двигаются. Все слои пусты → пустой список.
 */

export function resolveZoneContent(
  cfg: NeutralZoneContent,
  tier: NeutralZoneTier,
  zoneLetter: string,
): ZoneContentList {
  const byKey = new Map<string, ZoneContentItem>();
  const order: string[] = [];

  const apply = (items?: ZoneContentItem[]): void => {
    if (!items) return;
    for (const item of items) {
      if (!byKey.has(item.sid)) {
        order.push(item.sid);
      }
      byKey.set(item.sid, item);
    }
  };

  apply(cfg.global.items);
  const tierList = cfg.byTier[tier];
  if (tierList) apply(tierList.items);
  const letterList = cfg.byZoneLetter[zoneLetter];
  if (letterList) apply(letterList.items);

  const result: ZoneContentList = { items: [] };
  for (const sid of order) {
    const item = byKey.get(sid);
    if (item) result.items.push(item);
  }
  return result;
}
