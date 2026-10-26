import fieldHelpYaml from "../data/field-help.yaml?raw";

/**
 * T-803: инлайн-подсказки по полям. Загружает src/data/field-help.yaml
 * (raw-импорт Vite) и отдаёт однострочную подсказку по id поля. Хосты
 * используют `get` для `title=`-атрибутов Web и ToolTip в WPF — текст один и
 * тот же.
 *
 * Каталог намеренно терпимый: отсутствие файла, битая строка или неизвестный
 * ключ дают null — хост не показывает тултип, поведение по умолчанию не
 * меняется. Ключи повторяют идентификаторы ValidationFieldKeys, где такие
 * уже есть; ключи только для документации живут в FieldHelpKeys и следуют
 * той же dotted-форме.
 */

/** Ключи документации, у которых нет собственного правила валидации. */
export const FieldHelpKeys = {
  Seed: "seed",
  PlayerZoneSize: "zones.player.size",
  NeutralZoneSize: "zones.neutral.size",
  GuardsRandomization: "guards.randomization",
  GuardsMultiplier: "guards.multiplier",
  ConnectionGuardRandomization: "connection.guardRandomization",
  ConnectionDefaultsGuardRandomization: "connection.defaults.guardRandomization",
  HeroLighting: "hero.lighting",
  HeroLightingDay: "hero.lightingDay",
  GameRulesCityHold: "gameRules.cityHold",
  GameRulesVictoryCondition: "gameRules.victoryCondition",
  ZoneContentIncludeLists: "zoneContent.includeLists",
  ZoneContentDensity: "zoneContent.density",
  BordersWater: "borders.water",
  BordersNoise: "borders.noise",
  RoadsStyle: "roads.style",
  RoadsDensity: "roads.density",
  EncounterHolesEnabled: "encounterHoles.enabled",
  EncounterHolesAffectedEncounters: "encounterHoles.affectedEncounters",
  EncounterHolesTwoHoleEncounters: "encounterHoles.twoHoleEncounters",
  ZoneOverridesGuardRandomization: "zoneOverrides.guardRandomization",
  ZoneOverridesGuardMultiplier: "zoneOverrides.guardMultiplier",
  PreviewZoom: "preview.zoom",
  PresetLoad: "preset.load",
} as const;

/**
 * Разбор используемого подмножества YAML: пустые строки и `#`-комментарии
 * пропускаются; каждая остальная строка обязана быть `key: value`. Кавычки
 * вокруг значения опциональны и снимаются, если сбалансированы. Отступы,
 * якоря, flow-стиль и многострочные скаляры не поддерживаются — битая строка
 * отбрасывается, разбор продолжается.
 */
export function parseFieldHelpYaml(yaml: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!yaml) return result;

  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const colon = line.indexOf(":");
    if (colon <= 0) continue;

    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (key.length === 0 || value.length === 0) continue;

    // Снять один слой сбалансированных кавычек, если есть.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result.set(key, value);
  }
  return result;
}

const entries = parseFieldHelpYaml(fieldHelpYaml);

/** Каталог подсказок, собранный один раз из встроенного YAML-ассета. */
export const fieldHelp = {
  /**
   * Подсказка по ключу; null для неизвестного ключа — вызывающий обязан
   * трактовать null как «нет тултипа» и не эмитить `title=`/ToolTip.
   */
  get(key?: string | null): string | null {
    if (!key || key.trim().length === 0) return null;
    return entries.get(key) ?? null;
  },

  /** Число задокументированных полей. */
  count(): number {
    return entries.size;
  },

  /** Все пары ключ/значение (для тестов и тулинга). */
  listEntries(): Array<[string, string]> {
    return [...entries.entries()];
  },
};
