import type { MapTopology } from "./enums";
import { communityCatalog } from "./communityCatalog";
import { MAX_OFFICIAL_MAP_SIZE } from "./knownValues";
import type { GeneratorSettings, ZoneContentItem } from "./settings";

/**
 * Предгенерационная валидация, общая для всех хостов. Аналог MainWindow.Validate().
 * «error» (блокер) запрещает генерацию; «warning» только предупреждает. Каждое
 * замечание несёт fieldKey — стабильный идентификатор поля, к которому оно
 * привязано, чтобы UI мог подсветить конкретный контрол и предложить
 * однострочный fix.
 */

export const DEFAULT_MAX_ZONES = 32;

/** Стабильные идентификаторы полей для инлайн-подсветки в UI. */
export const ValidationFieldKeys = {
  TemplateName: "template.name",
  MapSize: "map.size",
  PlayerCount: "map.players",
  Topology: "topology",
  NeutralZoneCount: "zones.neutral.count",
  ZonesTotal: "zones.total",
  PlayerZoneCastles: "zones.player.castles",
  MinNeutralSeparation: "zones.minSeparation",
  HeroMinMax: "hero.minMax",
  HeroBans: "hero.bans",
  BonusPerPlayerOverrides: "bonuses.perPlayerOverrides",
  /** Якорь предупреждений о покрытии контент-пулов (T-703). */
  ZoneContentPool: "zoneContent.pool",
} as const;

/**
 * Стабильные коды-дискриминаторы для правил с одним fieldKey, но разными
 * UI-действиями. UI не должен матчиться на текст message.
 */
export const ValidationIssueCodes = {
  /** Вариант блокера «число нейтральных зон» для Удержания города. */
  NeutralZoneCountForCityHold: "neutral.count.cityHold",
  // T-703 — коды предупреждений о покрытии контент-пулов.
  ContentPoolNoTier7Dwellings: "content.pool.noTier7",
  ContentPoolNoShrines: "content.pool.noShrines",
  ContentPoolNoCreatureBanks: "content.pool.noCreatureBanks",
  ContentPoolNoResourceBanks: "content.pool.noResourceBanks",
  ContentPoolNoMines: "content.pool.noMines",
} as const;

export type ValidationSeverity = "error" | "warning";

/** Механические однострочные исправления, которые UI может предложить для блокера. */
export type ValidationFix =
  | { kind: "addNeutralZone" }
  | { kind: "switchToHubTopology" }
  | { kind: "setDefaultTemplateName" };

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Один из идентификаторов ValidationFieldKeys. */
  fieldKey: string;
  /** Дискриминатор из ValidationIssueCodes; только там, где нужно различать правила. */
  code?: string;
  /** Готовый к показу текст (RU). */
  message: string;
  /** Однострочное исправление, если для правила оно существует. */
  fix?: ValidationFix;
}

/** Плоские списки сообщений — для вызовов, которым нужны только строки. */
export interface ValidationResult {
  blockers: string[];
  warnings: string[];
  issues: ValidationIssue[];
  readonly isValid: boolean;
}

export function issuesForField(issues: readonly ValidationIssue[], fieldKey: string): ValidationIssue[] {
  return issues.filter((i) => i.fieldKey === fieldKey);
}

export function hasBlockerOn(issues: readonly ValidationIssue[], fieldKey: string): boolean {
  return issues.some((i) => i.severity === "error" && i.fieldKey === fieldKey);
}

export function hasWarningOn(issues: readonly ValidationIssue[], fieldKey: string): boolean {
  return issues.some((i) => i.severity === "warning" && i.fieldKey === fieldKey);
}

export function validationResult(issues: readonly ValidationIssue[]): ValidationResult {
  return {
    blockers: issues.filter((i) => i.severity === "error").map((i) => i.message),
    warnings: issues.filter((i) => i.severity === "warning").map((i) => i.message),
    issues: [...issues],
    isValid: issues.every((i) => i.severity !== "error"),
  };
}

/** Общее число нейтральных зон: простой счётчик или сумма по tier'ам advanced-режима. */
export function totalNeutralZones(settings: GeneratorSettings): number {
  if (!settings.zoneCfg.advanced.enabled) return settings.zoneCfg.neutralZoneCount;
  const a = settings.zoneCfg.advanced;
  return (
    a.neutralLowNoCastleCount +
    a.neutralLowCastleCount +
    a.neutralMediumNoCastleCount +
    a.neutralMediumCastleCount +
    a.neutralHighNoCastleCount +
    a.neutralHighCastleCount
  );
}

/**
 * Может ли раскладка соблюсти MinNeutralZonesBetweenPlayers. Зеркало
 * TemplateGenerator.CanHonorNeutralSeparation (см. TemplatesGenerator порт).
 */
export function canHonorNeutralSeparation(
  settings: GeneratorSettings,
  neutralZoneCount: number,
): boolean {
  const min = settings.minNeutralZonesBetweenPlayers;
  if (min <= 0) return true;
  if (settings.randomPortals) return false;

  const topology: MapTopology = settings.topology;
  switch (topology) {
    case "Default":
      return neutralZoneCount >= settings.playerCount * min;
    case "Chain":
      return neutralZoneCount >= (settings.playerCount - 1) * min;
    case "HubAndSpoke":
      return min <= 1;
    case "SharedWeb":
      return min <= 1 && neutralZoneCount >= 1;
    default:
      return false;
  }
}

/**
 * Основная валидация. Возвращает замечания с привязкой к полям; блокеры —
 * замечания с severity "error".
 */
export function validate(
  settings: GeneratorSettings,
  maxZonesOverride?: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const players = settings.playerCount;
  const neutral = totalNeutralZones(settings);
  const maxZones = maxZonesOverride ?? DEFAULT_MAX_ZONES;

  const block = (fieldKey: string, message: string, fix?: ValidationFix, code?: string): void => {
    issues.push({ severity: "error", fieldKey, message, fix, code });
  };
  const warn = (fieldKey: string, message: string, code?: string): void => {
    issues.push({ severity: "warning", fieldKey, message, code });
  };

  if (settings.heroSettings.heroCountMin > settings.heroSettings.heroCountMax) {
    block(ValidationFieldKeys.HeroMinMax, "Минимальное число героев не может превышать максимальное.");
  }

  if (players + neutral > maxZones) {
    block(
      ValidationFieldKeys.ZonesTotal,
      `Суммарное число зон (игроки + нейтральные) не может превышать ${maxZones}.`,
    );
  }

  if (settings.templateName.trim().length === 0) {
    block(
      ValidationFieldKeys.TemplateName,
      "Имя шаблона не может быть пустым.",
      { kind: "setDefaultTemplateName" },
    );
  }

  const cityHoldActive =
    settings.gameEndConditions.cityHold ||
    settings.gameEndConditions.victoryCondition === "win_condition_5";
  if (cityHoldActive && settings.topology !== ("HubAndSpoke" satisfies MapTopology) && neutral === 0) {
    block(
      ValidationFieldKeys.NeutralZoneCount,
      "Для «Удержания города» нужна хотя бы одна нейтральная зона, чтобы разместить удерживаемый город. Добавьте нейтральную зону или переключитесь на раскладку «Хаб» (Hub-and-Spoke).",
      { kind: "addNeutralZone" },
      ValidationIssueCodes.NeutralZoneCountForCityHold,
    );
  }

  if (settings.noDirectPlayerConnections && neutral === 0) {
    block(
      ValidationFieldKeys.NeutralZoneCount,
      "Режим «только через нейтральные зоны» требует хотя бы одной нейтральной зоны. Добавьте нейтральную зону или отключите эту опцию.",
      { kind: "addNeutralZone" },
    );
  }

  if (settings.gameEndConditions.victoryCondition === "win_condition_6" && players !== 2) {
    block(
      ValidationFieldKeys.PlayerCount,
      "Режим турнира поддерживает ровно 2 игроков.",
    );
  }

  if (settings.templateName.trim().toLowerCase() === "custom template") {
    warn(
      ValidationFieldKeys.TemplateName,
      "⚠️ Шаблон всё ещё носит имя по умолчанию «Custom Template». Переименуйте его перед сохранением.",
    );
  }

  const totalZones = players + neutral;
  const totalZonesIncludingHub = settings.topology === "HubAndSpoke" ? totalZones + 1 : totalZones;
  const mapSize = settings.mapSize;
  if (totalZonesIncludingHub > 0 && (mapSize * mapSize) / totalZonesIncludingHub < 1024) {
    warn(
      ValidationFieldKeys.MapSize,
      "⚠️ Оценочный размер зоны слишком мал. Игра может зависнуть при загрузке карты. Увеличьте размер карты или уменьшите число зон.",
    );
  }

  if (mapSize > MAX_OFFICIAL_MAP_SIZE) {
    warn(
      ValidationFieldKeys.MapSize,
      "Экспериментальные размеры карты больше 240×240 не подтверждены официальными шаблонами: сгенерированные карты могут не создаться, зависнуть или повести себя непредсказуемо в игре.",
    );
  }

  if (totalZones > 10) {
    const playerCastles = settings.zoneCfg.playerZoneCastles;
    const neutralCastles = settings.zoneCfg.advanced.enabled ? 0 : settings.zoneCfg.neutralZoneCastles;
    if (playerCastles > 1 || neutralCastles > 1) {
      warn(
        ValidationFieldKeys.PlayerZoneCastles,
        "⚠️ Больше 1 замка на зону при суммарном числе зон больше 10 может привести к зависанию игры при генерации карты. Стоит уменьшить число замков.",
      );
    }
  }

  if (
    settings.zoneCfg.advanced.enabled &&
    settings.minNeutralZonesBetweenPlayers > 0 &&
    !canHonorNeutralSeparation(settings, neutral)
  ) {
    warn(
      ValidationFieldKeys.MinNeutralSeparation,
      "Минимальное число нейтральных зон между игроками не гарантировано при текущей раскладке, общем числе нейтральных зон или настройке порталов: генерация проигнорирует эту опцию.",
    );
  }

  if (settings.topology === "Balanced" && totalZones >= 24) {
    warn(
      ValidationFieldKeys.Topology,
      "Раскладка «Balanced» может дать неожиданный результат, если суммарное число зон превышает 24.",
    );
  }

  // Проверка банов героев / стартовых героев.
  const heroBans = settings.heroSettings.heroBans;
  if (heroBans.length > 0) {
    const bansSet = new Set(heroBans.map((b) => b.toLowerCase()));
    const catalog = communityCatalog;
    for (const faction of catalog.factions) {
      const heroes = catalog.heroesByFaction(faction.id);
      if (heroes.length === 0) continue;
      if (heroes.every((h) => bansSet.has(h.id.toLowerCase()))) {
        warn(
          ValidationFieldKeys.HeroBans,
          `⚠️ Все герои фракции «${faction.name}» заблокированы. Игра может не суметь назначить стартового героя этой фракции.`,
        );
      }
    }
  }

  // T-206: per-player переопределения стартовых бонусов — предупреждаем (не
  // блокируем) на слотах вне диапазона, дублях слотов (побеждает последняя
  // строка) и строках без заданных полей. Эмиттер применяет те же правила.
  if (settings.bonuses.perPlayerOverrides.length > 0) {
    const seenSlots = new Set<number>();
    for (const row of settings.bonuses.perPlayerOverrides) {
      if (row.playerSlot < 1 || row.playerSlot > players) {
        warn(
          ValidationFieldKeys.BonusPerPlayerOverrides,
          `Переопределение стартового бонуса указывает на слот ${row.playerSlot}, но в шаблоне только ${players} игрок(ов). Строка будет пропущена.`,
        );
      } else if (seenSlots.has(row.playerSlot)) {
        warn(
          ValidationFieldKeys.BonusPerPlayerOverrides,
          `Дублирующее переопределение стартового бонуса для слота ${row.playerSlot}: применена будет последняя строка.`,
        );
      } else {
        seenSlots.add(row.playerSlot);
      }
      if (bonusRowIsEmpty(row.bonuses)) {
        warn(
          ValidationFieldKeys.BonusPerPlayerOverrides,
          `Переопределение стартового бонуса для слота ${row.playerSlot} не задаёт ни одного поля. Удалите его или заполните значение.`,
        );
      }
    }
  }

  // T-703: предупреждения о целостности контент-пулов. Срабатывают, только
  // если пользователь заполнил хотя бы один ContentList (пресеты — без предупреждений).
  inspectContentPools(settings, warn);

  return issues;
}

// ── T-703: предупреждения о целостности контент-пулов ────────────────────────
// Обход всех заполненных ContentList (глобальные player+neutral, по tier'ам и
// по буквам зон) и предупреждение, если комбинированная конфигурация не
// достигает категории, на которую движок обычно рассчитывает. Каждое правило
// срабатывает максимум один раз за вызов validate(). Триггер — «пользователь
// заполнил любой ContentList»; при пустых списках работают дефолты генератора.

// Категории «Shrines & conflux» и «Banks & utopias» из ZoneContentSidCatalog:
// валидатору нужен только membership-тест по этим двум категориям.
const SHRINE_SIDS: ReadonlySet<string> = new Set([
  "sacrificial_shrine",
  "fickle_shrine",
  "ritual_pyre",
  "celestial_sphere",
  "point_of_balance",
  "tear_of_truth",
  "flattering_mirror",
  "tree_of_abundance",
  "mana_well",
]);

const BANK_SIDS: ReadonlySet<string> = new Set([
  "dragon_utopia",
  "eternal_dragon",
  "monty_hall",
  "the_gorge",
  "crystal_trail",
  "infernal_cirque",
  "twilight_bloom",
  "boreal_call",
  "insaras_eye",
  "quixs_path",
  "unstable_ruins",
  "troglodyte_throne",
]);

type WarnFn = (fieldKey: string, message: string, code?: string) => void;

function inspectContentPools(settings: GeneratorSettings, warn: WarnFn): void {
  const allItems: ZoneContentItem[] = collectAllContentItems(settings);
  if (allItems.length === 0) return;

  const sids = new Set<string>(
    allItems
      .map((i) => i.sid ?? "")
      .filter((s) => s.trim().length > 0)
      .map((s) => s.toLowerCase()),
  );
  const includeListIds = new Set<string>(
    allItems
      .flatMap((i) => i.includeListIds ?? [])
      .filter((s) => s.trim().length > 0)
      .map((s) => s.toLowerCase()),
  );

  // includeListId «покрывает» категорию, если его ID содержит все
  // строки-маркеры. Подстроки повторяют именование ID в ContentListCatalog
  // (например, «units_banks», «resource_banks», «random_hires…tier_7»).
  const anyIncludeListContains = (...markers: string[]): boolean =>
    Array.from(includeListIds).some((id) => markers.every((m) => id.includes(m.toLowerCase())));

  const anySidInSet = (set: ReadonlySet<string>): boolean =>
    Array.from(sids).some((s) => set.has(s));

  // 1. Случайный найм 7-го уровня. Достижим, когда (а) есть raw SID tier-7,
  //    (б) включён high-tier / tier-7 список найма, (в) включён общий пул
  //    «все уровни» (id с «random_hires», но без суффикса «tier_<n>» /
  //    «low_tier»).
  const hasGenericHirePool = Array.from(includeListIds).some(
    (id) => id.includes("random_hires") && !id.includes("tier_") && !id.includes("low_tier"),
  );
  const hasTier7Hire =
    sids.has("random_hire_7") ||
    anyIncludeListContains("random_hires", "tier_7") ||
    anyIncludeListContains("random_hires_high_tier") ||
    hasGenericHirePool;
  if (!hasTier7Hire) {
    warn(
      ValidationFieldKeys.ZoneContentPool,
      "⚠️ Из настроенного контента недостижимы жилища существ 7-го уровня. Добавьте случайный найм 7-го уровня (например, «random_hire_7») или пул найма, покрывающий высокие уровни.",
      ValidationIssueCodes.ContentPoolNoTier7Dwellings,
    );
  }

  // 2. Святилища.
  if (!anySidInSet(SHRINE_SIDS)) {
    warn(
      ValidationFieldKeys.ZoneContentPool,
      "⚠️ Из настроенного контента недостижимы святилища. Добавьте святилище (например, «sacrificial_shrine», «fickle_shrine») в один из заполненных списков контента.",
      ValidationIssueCodes.ContentPoolNoShrines,
    );
  }

  // 3. Банки существ.
  const hasCreatureBank = anySidInSet(BANK_SIDS) || anyIncludeListContains("units_banks");
  if (!hasCreatureBank) {
    warn(
      ValidationFieldKeys.ZoneContentPool,
      "⚠️ Из настроенного контента недостижимы банки существ. Добавьте SID банка (например, «dragon_utopia») или список контента с банками существ.",
      ValidationIssueCodes.ContentPoolNoCreatureBanks,
    );
  }

  // 4. Ресурсные банки.
  if (!anyIncludeListContains("resource_banks")) {
    warn(
      ValidationFieldKeys.ZoneContentPool,
      "⚠️ Из настроенного контента недостижимы ресурсные банки. Добавьте список контента с ресурсными банками (например, «basic_content_list_building_guarded_resource_banks_tier_1»).",
      ValidationIssueCodes.ContentPoolNoResourceBanks,
    );
  }

  // 5. Шахты.
  const hasMine =
    Array.from(sids).some((s) => s.startsWith("mine_") || s.startsWith("name_mine_")) ||
    anyIncludeListContains("rare_mines");
  if (!hasMine) {
    warn(
      ValidationFieldKeys.ZoneContentPool,
      "⚠️ Из настроенного контента недостижимы шахты. Добавьте SID шахты (например, «mine_gold») или список контента с шахтами.",
      ValidationIssueCodes.ContentPoolNoMines,
    );
  }
}

function collectAllContentItems(settings: GeneratorSettings): ZoneContentItem[] {
  const items: ZoneContentItem[] = [...settings.playerZoneContent.items];
  items.push(...settings.neutralZoneContent.global.items);
  for (const list of Object.values(settings.neutralZoneContent.byTier)) {
    if (list) items.push(...list.items);
  }
  for (const list of Object.values(settings.neutralZoneContent.byZoneLetter)) {
    items.push(...list.items);
  }
  return items;
}

function bonusRowIsEmpty(b: GeneratorSettings["bonuses"]): boolean {
  return (
    Object.keys(b.resources).length === 0 &&
    b.heroAttack === 0 &&
    b.heroDefense === 0 &&
    b.heroSpellpower === 0 &&
    b.heroKnowledge === 0 &&
    b.itemSid.trim().length === 0 &&
    b.spellSid.trim().length === 0 &&
    b.unitMultiplier === 0
  );
}

// ── Программные исправления ─────────────────────────────────────────────────
// Набор намеренно маленький: только однозначные однострочные remediation.
// Каждый fix мутирует настройки на месте; хост обязан перевалидировать и
// перерисовать UI после применения.

/** Применить однострочное исправление к настройкам (мутирует на месте). */
export function applyValidationFix(settings: GeneratorSettings, fix: ValidationFix): void {
  switch (fix.kind) {
    case "addNeutralZone":
      // В advanced-режиме простой счётчик не используется. Увеличиваем tier
      // medium-no-castle как самый нейтральный дефолт — пользователь сможет
      // перебалансировать.
      if (settings.zoneCfg.advanced.enabled) {
        settings.zoneCfg.advanced.neutralMediumNoCastleCount += 1;
      } else {
        settings.zoneCfg.neutralZoneCount += 1;
      }
      break;
    case "switchToHubTopology":
      // Переключение на Hub-and-Spoke снимает блокер «Удержанию города нужны нейтральные зоны».
      settings.topology = "HubAndSpoke";
      break;
    case "setDefaultTemplateName":
      // Непустое имя-заглушка, чтобы блокер снялся.
      settings.templateName = "Custom Template";
      break;
  }
}
