import { SPELL_SCHOOLS_RU } from "./knownValues";
import classesJson from "../data/community/classes.json";
import factionsJson from "../data/community/factions.json";
import heroesJson from "../data/community/heroes.json";
import skillColumnsJson from "../data/community/skill-columns.json";
import skillsJson from "../data/community/skills.json";
import specializationsJson from "../data/community/specializations.json";
import spellsJson from "../data/community/spells.json";
import subclassesJson from "../data/community/subclasses.json";
import unitsJson from "../data/community/units.json";

/**
 * Справочные данные из общественного датамайна alcaras/homm-olden. Держатся в
 * памяти после первого обращения; сетевого и дискового I/O в рантайме нет.
 * JSON-файлы инлайнятся статическими импортами Vite; интерфейсы ниже используют
 * РЕАЛЬНЫЕ имена полей JSON (в C# то же самое делали [JsonPropertyName]).
 */
// TODO: verify wording against in-game Russian localization (тексты тултипов)

// ── Типы записей ────────────────────────────────────────────────────────────
// Порядок первых полей каждой записи зеркалит C#-records (позиционная
// семантика): Id, Faction/Name, Kind, ... — не переупорядочивать.

export interface FactionEntry {
  id: string;
  unitKey: string;
  name: string;
  skill: string;
  might: string;
  magic: string;
}

export interface HeroStats {
  A: number;
  D: number;
  P: number;
  K: number;
}

export interface HeroEntry {
  id: string;
  faction: string;
  kind: string;
  name: string;
  specialty?: string | null;
  specDesc?: string | null;
  // ── T-603: стартовый лоадаут из heroes.json ──
  specId?: string | null;
  armyScore?: number;
  stats?: HeroStats | null;
  skills?: string[] | null;
  army?: string | null;
}

export interface UnitAbilityEntry {
  name: string;
  desc?: string | null;
}

export interface UnitEntry {
  id: string;
  name: string;
  faction: string;
  tier: number;
  variant?: string | null;
  // ── T-602: боевые статы из units.json ──
  attack?: string | null;
  hp?: number;
  off?: number;
  def?: number;
  dmgMin?: number;
  dmgMax?: number;
  init?: number;
  speed?: number;
  squadValue?: number;
  cost?: number;
  ai?: string | null;
  tags?: string[] | null;
  narrative?: string | null;
  passives?: UnitAbilityEntry[] | null;
  abilities?: UnitAbilityEntry[] | null;
}

export interface SpellResourceCost {
  name: string;
  cost: number;
}

export interface SpellEntry {
  id: string;
  name: string;
  school: string;
  tier: number;
  scope: string;
  desc?: string | null;
  // ── T-603: цена / иконка / тип магии из spells.json ──
  manaCost?: number[] | null;
  cooldown?: number;
  learnCost?: SpellResourceCost[] | null;
  icon?: string | null;
  magicType?: string | null;
}

export interface SkillSubskillEntry {
  id: string;
  name: string;
  desc?: string | null;
}

export interface SkillLevelEntry {
  level: number;
  icon?: string | null;
  name: string;
  desc?: string | null;
  bonuses?: string[] | null;
  subskills?: SkillSubskillEntry[] | null;
}

export interface SkillSubclassRef {
  name: string;
  class?: string | null;
  faction?: string | null;
  kind?: string | null;
}

export interface SkillStarterRef {
  id: string;
  name: string;
  faction?: string | null;
  kind?: string | null;
  level: number;
}

export interface SkillEntry {
  id: string;
  name: string;
  group: string;
  skillType: string;
  factionId?: string | null;
  // ── T-603: описания / прогрессия / перекрёстные ссылки ──
  baseDesc?: string | null;
  levels?: SkillLevelEntry[] | null;
  subclasses?: SkillSubclassRef[] | null;
  starters?: SkillStarterRef[] | null;
}

export interface SkillColumnEntry {
  key: string;
  name: string;
  group: string;
}

export interface SubclassEntry {
  faction: string;
  kind: string;
  name: string;
  class: string;
  skills: string[];
  effect: string;
}

export interface ClassSubclassEntry {
  id: string;
  skills: string[];
  effect: string;
}

export interface ClassEntry {
  name: string;
  factionId: string;
  classType: string;
  attack: number;
  defence: number;
  power: number;
  knowledge: number;
  statsBreakpointLevel: number;
  subclasses?: Record<string, ClassSubclassEntry> | null;
  // Прочие поля on-disk JSON (таблицы веса навыков, factionSkill и т.п.)
  // сознательно не поверхности — только стабильные между рефрешами поля.
}

export interface SpecializationHeroRef {
  id: string;
  name: string;
  faction?: string | null;
  classType?: string | null;
}

export interface SpecializationEntry {
  id: string;
  name: string;
  description?: string | null;
  faction?: string | null;
  classType?: string | null;
  heroes?: SpecializationHeroRef[] | null;
}

// ── Статические импорты ─────────────────────────────────────────────────────

const heroes = heroesJson as unknown as HeroEntry[];
const units = unitsJson as unknown as UnitEntry[];
const spells = spellsJson as unknown as SpellEntry[];
const skills = skillsJson as unknown as SkillEntry[];
const subclasses = subclassesJson as unknown as SubclassEntry[];
const factions = factionsJson as unknown as FactionEntry[];
const skillColumns = skillColumnsJson as unknown as SkillColumnEntry[];
const classes = classesJson as unknown as ClassEntry[];
const specializations = specializationsJson as unknown as SpecializationEntry[];

// ── Таксономия школ магии ───────────────────────────────────────────────────

/** Канонический порядок школ: Day → Night → Arcane → Primal, остальное — в конец. */
export function spellSchoolOrder(school?: string | null): number {
  switch (school?.toLowerCase()) {
    case "day": return 0;
    case "night": return 1;
    case "arcane": return 2;
    case "primal": return 3;
    default: return 99;
  }
}

/** Человекочитаемое имя школы (RU); неизвестная школа — с заглавной буквы. */
export function friendlySpellSchool(school?: string | null): string {
  if (!school) return "Другое";
  const lower = school.toLowerCase();
  const ru = SPELL_SCHOOLS_RU[lower.charAt(0).toUpperCase() + lower.slice(1)];
  return ru ?? school.charAt(0).toUpperCase() + school.slice(1);
}

// ── Каталог ─────────────────────────────────────────────────────────────────

export interface CommunityCatalog {
  readonly heroes: readonly HeroEntry[];
  readonly units: readonly UnitEntry[];
  readonly spells: readonly SpellEntry[];
  readonly skills: readonly SkillEntry[];
  readonly subclasses: readonly SubclassEntry[];
  readonly factions: readonly FactionEntry[];
  readonly skillColumns: readonly SkillColumnEntry[];
  readonly classes: readonly ClassEntry[];
  readonly specializations: readonly SpecializationEntry[];

  heroesByFaction(factionId: string): HeroEntry[];
  spellsBySchool(school: string): SpellEntry[];
  unitsByFaction(factionId: string): UnitEntry[];

  /** Различимые школы в каноническом порядке показа. */
  readonly spellSchools: readonly string[];
}

function buildCommunityCatalog(): CommunityCatalog {
  let spellSchoolsCache: string[] | null = null;

  const catalog: CommunityCatalog = {
    heroes,
    units,
    spells,
    skills,
    subclasses,
    factions,
    skillColumns,
    classes,
    specializations,

    heroesByFaction(factionId: string): HeroEntry[] {
      const needle = factionId.toLowerCase();
      return heroes.filter((h) => h.faction.toLowerCase() === needle);
    },

    spellsBySchool(school: string): SpellEntry[] {
      const needle = school.toLowerCase();
      return spells.filter((s) => s.school.toLowerCase() === needle);
    },

    unitsByFaction(factionId: string): UnitEntry[] {
      const needle = factionId.toLowerCase();
      return units.filter((u) => u.faction.toLowerCase() === needle);
    },

    get spellSchools(): string[] {
      if (spellSchoolsCache === null) {
        // Дистинкт без учёта регистра (представитель — первое вхождение),
        // сортировка: порядок школ, затем алфавит без учёта регистра.
        const seen = new Map<string, string>();
        for (const s of spells) {
          const key = (s.school ?? "").toLowerCase();
          if (!seen.has(key)) seen.set(key, s.school ?? "");
        }
        spellSchoolsCache = [...seen.values()].sort((a, b) => {
          const orderDiff = spellSchoolOrder(a) - spellSchoolOrder(b);
          if (orderDiff !== 0) return orderDiff;
          const al = a.toLowerCase();
          const bl = b.toLowerCase();
          return al < bl ? -1 : al > bl ? 1 : 0;
        });
      }
      return spellSchoolsCache;
    },
  };
  return catalog;
}

let cachedCatalog: CommunityCatalog | null = null;

function resolveCatalog(): CommunityCatalog {
  if (cachedCatalog === null) cachedCatalog = buildCommunityCatalog();
  return cachedCatalog;
}

/**
 * Ленивый синглтон-каталог: строится при первом обращении к любому свойству.
 */
export const communityCatalog: CommunityCatalog = {
  get heroes() { return resolveCatalog().heroes; },
  get units() { return resolveCatalog().units; },
  get spells() { return resolveCatalog().spells; },
  get skills() { return resolveCatalog().skills; },
  get subclasses() { return resolveCatalog().subclasses; },
  get factions() { return resolveCatalog().factions; },
  get skillColumns() { return resolveCatalog().skillColumns; },
  get classes() { return resolveCatalog().classes; },
  get specializations() { return resolveCatalog().specializations; },
  get spellSchools() { return resolveCatalog().spellSchools; },
  heroesByFaction(factionId: string) { return resolveCatalog().heroesByFaction(factionId); },
  spellsBySchool(school: string) { return resolveCatalog().spellsBySchool(school); },
  unitsByFaction(factionId: string) { return resolveCatalog().unitsByFaction(factionId); },
};

// ── Тултипы пикеров ─────────────────────────────────────────────────────────
// Компактные многострочные сводки для чипов пикеров (title=/ToolTip).

/** Компактный тултип героя: специализация, статы A/D/P/K, сила армии, навыки. */
export function heroTooltipText(hero: HeroEntry): string {
  const lines: string[] = [];
  let head = hero.name;
  if (hero.specialty && hero.specialty.trim().length > 0) {
    head += ` — ${hero.specialty}`;
  }
  lines.push(head);
  if (hero.stats) {
    lines.push(`A ${hero.stats.A} / D ${hero.stats.D} / P ${hero.stats.P} / K ${hero.stats.K}`);
  }
  if ((hero.armyScore ?? 0) > 0) {
    lines.push(`Сила армии ${hero.armyScore}`);
  }
  if (hero.skills && hero.skills.length > 0) {
    lines.push(`Навыки: ${hero.skills.join(", ")}`);
  }
  if (hero.specDesc && hero.specDesc.trim().length > 0) {
    lines.push(hero.specDesc);
  }
  return lines.join("\n");
}

/** Тултип существа: тир/имя, статы и не более одной активной способности. */
export function unitTooltipText(unit: UnitEntry): string {
  const lines: string[] = [];
  let head = `T${unit.tier} ${unit.name}`;
  if (unit.variant) head += ` (${unit.variant})`;
  lines.push(head);
  const hp = unit.hp ?? 0;
  if (hp > 0) {
    const statLine =
      (unit.attack ? `${unit.attack} • ` : "") +
      `HP ${hp} • Атк ${unit.off ?? 0} / Зщ ${unit.def ?? 0}`;
    lines.push(statLine);
    lines.push(
      `Урон ${unit.dmgMin ?? 0}-${unit.dmgMax ?? 0} • Иниц ${unit.init ?? 0} • Скор ${unit.speed ?? 0}`,
    );
    lines.push(`Отряд ${unit.squadValue ?? 0} • Цена ${unit.cost ?? 0}`);
  }
  if (unit.abilities && unit.abilities.length > 0) {
    lines.push(`Способность: ${unit.abilities[0].name}`);
  }
  return lines.join("\n");
}

/** Тултип заклинания: тир/имя, цена маны (или диапазон по уровням), КД, описание. */
export function spellTooltipText(spell: SpellEntry): string {
  const lines: string[] = [];
  let head = `T${spell.tier} ${spell.name}`;
  if (spell.magicType && spell.magicType.trim().length > 0) head += ` · ${spell.magicType}`;
  lines.push(head);
  const manaCost = spell.manaCost ?? [];
  const cooldown = spell.cooldown ?? 0;
  if (manaCost.length > 0) {
    const uniform = new Set(manaCost).size === 1;
    let manaLine = `Мана ${uniform ? String(manaCost[0]) : manaCost.join("/")}`;
    if (cooldown > 0) manaLine += ` · КД ${cooldown}`;
    lines.push(manaLine);
  } else if (cooldown > 0) {
    lines.push(`КД ${cooldown}`);
  }
  if (spell.desc && spell.desc.trim().length > 0) {
    lines.push(spell.desc);
  }
  return lines.join("\n");
}

/** Тултип навыка: описание + счётчики уровней/подклассов/стартовых героев. */
export function skillTooltipText(skill: SkillEntry): string {
  const lines: string[] = [skill.name];
  if (skill.baseDesc && skill.baseDesc.trim().length > 0) {
    lines.push(skill.baseDesc);
  }
  const levels = skill.levels?.length ?? 0;
  const subs = skill.subclasses?.length ?? 0;
  const starters = skill.starters?.length ?? 0;
  if (levels + subs + starters > 0) {
    lines.push(`Уровней: ${levels} · Подклассов: ${subs} · Стартовых: ${starters}`);
  }
  return lines.join("\n");
}
