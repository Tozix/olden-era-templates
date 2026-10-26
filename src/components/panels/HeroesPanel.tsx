import { useState } from "react";
import { useApp } from "../../state/settingsStore";
import { Card, Chip, Collapsible, SliderRow, TextField } from "../../components/ui";
import { FACTIONS } from "../../generator/heroCatalog";
import { communityCatalog, spellTooltipText } from "../../generator/communityCatalog";
import { pickerMatches } from "../../generator/pickerFilter";
import { SPELL_SCHOOLS_RU } from "../../generator/knownValues";

const T = {
  card: "Герои",
  heroesHint:
    "Максимум героев, которых может нанять игрок; увеличивается с каждым захваченным замком.",
  heroMin: "Героев у игрока (мин)",
  heroMax: "Героев у игрока (макс)",
  heroIncrement: "Бонусные герои за каждый захваченный замок",
  banHeroesSummary: (n: number) => `Запретить конкретных героев (выбрано: ${n})`,
  banHeroesHint:
    "Запрещённые герои исключаются из пула героев шаблона (попадают в globalBans.heroes).",
  searchHeroes: "Поиск героев",
  searchPlaceholder: "Введите часть имени…",
  noHeroMatches: (q: string) => `Нет героев по запросу «${q}».`,
  banSpellsSummary: (n: number) => `Запретить конкретные заклинания (выбрано: ${n})`,
  banSpellsHint:
    "Запрещённые заклинания исключаются из гильдий магов, святилищ и ящиков Пандоры (попадают в globalBans.magics).",
  searchSpells: "Поиск заклинаний",
  noSpellMatches: (q: string) => `Нет заклинаний по запросу «${q}».`,
};

/** Подпись школы магии (RU) — через SPELL_SCHOOLS_RU, устойчиво к регистру. */
function schoolLabel(school: string): string {
  const capitalized = school.charAt(0).toUpperCase() + school.slice(1);
  return SPELL_SCHOOLS_RU[capitalized] ?? SPELL_SCHOOLS_RU[school] ?? school;
}

/** Предупреждения (не блокеры) по полю: ui-кит показывает только ошибки. */
function FieldWarnings(props: { fieldKey: string }) {
  const issues = useApp((s) => s.issues);
  const warnings = issues.filter(
    (i) => i.fieldKey === props.fieldKey && i.severity === "warning",
  );
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w, idx) => (
        <div key={idx} className="hint">
          {w.message}
        </div>
      ))}
    </>
  );
}

export function HeroesPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const [activeFaction, setActiveFaction] = useState<string>(FACTIONS[0].displayName);
  const [heroFilter, setHeroFilter] = useState("");
  const [activeSchool, setActiveSchool] = useState<string>(communityCatalog.spellSchools[0] ?? "Day");
  const [spellFilter, setSpellFilter] = useState("");

  const toggleHeroBan = (heroId: string) =>
    patch((f) => {
      f.heroBans = f.heroBans.includes(heroId)
        ? f.heroBans.filter((x) => x !== heroId)
        : [...f.heroBans, heroId];
    });

  const toggleSpellBan = (spellId: string) =>
    patch((f) => {
      f.bannedSpells = f.bannedSpells.includes(spellId)
        ? f.bannedSpells.filter((x) => x !== spellId)
        : [...f.bannedSpells, spellId];
    });

  // heroesByFaction сравнивает фракцию без учёта регистра: displayName
  // фракций ("Temple"…) совпадает с id фракций каталога ("temple"...).
  const factionHeroes = communityCatalog
    .heroesByFaction(activeFaction)
    .filter((h) => pickerMatches(heroFilter, h.name, h.id, h.specialty))
    .sort((a, b) => a.name.localeCompare(b.name));

  const schoolSpells = communityCatalog
    .spellsBySchool(activeSchool)
    .filter((s) => pickerMatches(spellFilter, s.name, s.id, `T${s.tier}`))
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  return (
    <Card title={T.card}>
      <div className="hint">{T.heroesHint}</div>

      <SliderRow
        label={T.heroMin}
        value={file.heroMin}
        min={1}
        max={12}
        step={1}
        onChange={(v) => patch((f) => { f.heroMin = v; })}
        fieldKey="hero.minMax"
      />
      <SliderRow
        label={T.heroMax}
        value={file.heroMax}
        min={1}
        max={12}
        step={1}
        onChange={(v) => patch((f) => { f.heroMax = v; })}
        fieldKey="hero.minMax"
      />
      <SliderRow
        label={T.heroIncrement}
        value={file.heroIncrement}
        min={0}
        max={10}
        step={1}
        onChange={(v) => patch((f) => { f.heroIncrement = v; })}
      />

      <Collapsible summary={T.banHeroesSummary(file.heroBans.length)}>
        <div className="hint">{T.banHeroesHint}</div>
        <FieldWarnings fieldKey="hero.bans" />

        <div className="chip-tabs" role="tablist">
          {FACTIONS.map((faction) => (
            <Chip
              key={faction.displayName}
              label={faction.ru}
              active={activeFaction === faction.displayName}
              onClick={() => setActiveFaction(faction.displayName)}
            />
          ))}
        </div>

        <TextField
          label={T.searchHeroes}
          value={heroFilter}
          placeholder={T.searchPlaceholder}
          onChange={setHeroFilter}
        />

        <div className="chips">
          {factionHeroes.map((hero) => (
            <Chip
              key={hero.id}
              label={hero.name}
              active={file.heroBans.includes(hero.id)}
              title={hero.specialty ?? undefined}
              onClick={() => toggleHeroBan(hero.id)}
            />
          ))}
        </div>
        {factionHeroes.length === 0 && heroFilter.trim().length > 0 && (
          <div className="hint">{T.noHeroMatches(heroFilter.trim())}</div>
        )}
      </Collapsible>

      <Collapsible summary={T.banSpellsSummary(file.bannedSpells.length)}>
        <div className="hint">{T.banSpellsHint}</div>

        <div className="chip-tabs" role="tablist">
          {communityCatalog.spellSchools.map((school) => (
            <Chip
              key={school}
              label={schoolLabel(school)}
              active={activeSchool === school}
              onClick={() => setActiveSchool(school)}
            />
          ))}
        </div>

        <TextField
          label={T.searchSpells}
          value={spellFilter}
          placeholder={T.searchPlaceholder}
          onChange={setSpellFilter}
        />

        <div className="chips">
          {schoolSpells.map((spell) => (
            <Chip
              key={spell.id}
              label={`T${spell.tier}. ${spell.name}`}
              active={file.bannedSpells.includes(spell.id)}
              title={spellTooltipText(spell)}
              onClick={() => toggleSpellBan(spell.id)}
            />
          ))}
        </div>
        {schoolSpells.length === 0 && spellFilter.trim().length > 0 && (
          <div className="hint">{T.noSpellMatches(spellFilter.trim())}</div>
        )}
      </Collapsible>
    </Card>
  );
}
