import { useApp } from "../../state/settingsStore";
import {
  Card,
  CheckboxRow,
  NumberField,
  SelectField,
  SliderRow,
  TextField,
} from "../ui";
import type { SelectOption } from "../ui";
import { RESOURCE_CODES } from "../../generator/knownValues";
import { communityCatalog } from "../../generator/communityCatalog";
import type { PerPlayerBonusFile } from "../../generator/settingsFile";

const T = {
  cardTitle: "Стартовые бонусы",
  badge: "Экспериментально",
  hint: "Одни и те же бонусы получают все игроки. 0 / пусто — бонус не задан.",
  resourcesHeader: "Ресурсы",
  heroStatsHeader: "Характеристики героя",
  itemSpellUnitsHeader: "Предмет / заклинание / юниты",
  gold: "Золото (×1000)",
  wood: "Дерево",
  ore: "Руда",
  mercury: "Ртуть",
  crystals: "Кристаллы",
  gemstones: "Самоцветы",
  attack: "Атака",
  defense: "Защита",
  spellpower: "Сила магии",
  knowledge: "Знание",
  startHeroOnly: "Только стартовому герою",
  itemStartHeroOnly: "Предмет только стартовому герою",
  spellStartHeroOnly: "Заклинание только стартовому герою",
  unitMultiplierStartHeroOnly: "Множитель юнитов — только стартовому герою",
  bonusItemSid: "SID предмета",
  bonusItemPlaceholder: "пусто — предмет не выдаётся",
  bonusSpell: "Заклинание",
  bonusSpellNone: "— не задан —",
  unitMultiplier: "Множитель юнитов",
  perPlayerHeader: "Переопределения по игрокам",
  perPlayerHint:
    "Заданные поля заменяют общие значения выше только для выбранного слота; остальные поля наследуются.",
  slot: "Слот",
  remove: "Удалить",
  addOverride: "+ Добавить переопределение",
};

const RESOURCE_LABELS: Record<string, string> = {
  gold: T.gold,
  wood: T.wood,
  ore: T.ore,
  mercury: T.mercury,
  crystals: T.crystals,
  gemstones: T.gemstones,
};

// TODO: verify wording against in-game Russian localization (названия заклинаний взяты из датамайна)
const SPELL_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.bonusSpellNone },
  ...communityCatalog.spells
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((spell) => ({ value: spell.id, label: spell.name })),
];

function emptyOverride(): PerPlayerBonusFile {
  return {
    playerSlot: 1,
    resources: {},
    heroAttack: 0,
    heroDefense: 0,
    heroSpellpower: 0,
    heroKnowledge: 0,
    heroStatStartHeroOnly: false,
    itemSid: "",
    itemStartHeroOnly: false,
    spellSid: "",
    spellStartHeroOnly: false,
    unitMultiplier: 0,
    unitMultiplierStartHeroOnly: false,
  };
}

export function StartingBonusesCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const setResource = (code: string, v: number) =>
    patch((f) => {
      const resources = { ...f.bonusResources };
      if (v === 0) delete resources[code];
      else resources[code] = v;
      f.bonusResources = resources;
    });

  const updateRow = (idx: number, mut: (row: PerPlayerBonusFile) => void) =>
    patch((f) => {
      const rows = f.bonusPerPlayerOverrides.map((row) => ({
        ...row,
        resources: { ...row.resources },
      }));
      mut(rows[idx]);
      f.bonusPerPlayerOverrides = rows;
    });

  const slotOptions: SelectOption<number>[] = Array.from(
    { length: Math.max(1, file.playerCount) },
    (_, i) => ({ value: i + 1, label: String(i + 1) }),
  );

  return (
    <Card title={T.cardTitle} badge={T.badge}>
      <div className="hint">{T.hint}</div>

      <div className="hint">{T.resourcesHeader}</div>
      {RESOURCE_CODES.map((code) => (
        <SliderRow
          key={code}
          label={RESOURCE_LABELS[code] ?? code}
          min={0}
          max={100}
          value={file.bonusResources[code] ?? 0}
          onChange={(v) => setResource(code, v)}
        />
      ))}

      <div className="hint">{T.heroStatsHeader}</div>
      <SliderRow
        label={T.attack}
        min={0}
        max={20}
        value={file.bonusHeroAttack}
        onChange={(v) =>
          patch((f) => {
            f.bonusHeroAttack = v;
          })
        }
      />
      <SliderRow
        label={T.defense}
        min={0}
        max={20}
        value={file.bonusHeroDefense}
        onChange={(v) =>
          patch((f) => {
            f.bonusHeroDefense = v;
          })
        }
      />
      <SliderRow
        label={T.spellpower}
        min={0}
        max={20}
        value={file.bonusHeroSpellpower}
        onChange={(v) =>
          patch((f) => {
            f.bonusHeroSpellpower = v;
          })
        }
      />
      <SliderRow
        label={T.knowledge}
        min={0}
        max={20}
        value={file.bonusHeroKnowledge}
        onChange={(v) =>
          patch((f) => {
            f.bonusHeroKnowledge = v;
          })
        }
      />
      <CheckboxRow
        label={T.startHeroOnly}
        checked={file.bonusHeroStatStartHeroOnly}
        onChange={(v) =>
          patch((f) => {
            f.bonusHeroStatStartHeroOnly = v;
          })
        }
      />

      <div className="hint">{T.itemSpellUnitsHeader}</div>
      <TextField
        label={T.bonusItemSid}
        value={file.bonusItemSid}
        placeholder={T.bonusItemPlaceholder}
        onChange={(v) =>
          patch((f) => {
            f.bonusItemSid = v;
          })
        }
      />
      <CheckboxRow
        label={T.itemStartHeroOnly}
        checked={file.bonusItemStartHeroOnly}
        onChange={(v) =>
          patch((f) => {
            f.bonusItemStartHeroOnly = v;
          })
        }
      />
      <SelectField
        label={T.bonusSpell}
        value={file.bonusSpellSid}
        options={SPELL_OPTIONS}
        onChange={(v) =>
          patch((f) => {
            f.bonusSpellSid = v;
          })
        }
      />
      <CheckboxRow
        label={T.spellStartHeroOnly}
        checked={file.bonusSpellStartHeroOnly}
        onChange={(v) =>
          patch((f) => {
            f.bonusSpellStartHeroOnly = v;
          })
        }
      />
      <SliderRow
        label={T.unitMultiplier}
        min={0}
        max={500}
        suffix="%"
        value={Math.round(file.bonusUnitMultiplier * 100)}
        onChange={(v) =>
          patch((f) => {
            f.bonusUnitMultiplier = v / 100;
          })
        }
      />
      <CheckboxRow
        label={T.unitMultiplierStartHeroOnly}
        checked={file.bonusUnitMultiplierStartHeroOnly}
        onChange={(v) =>
          patch((f) => {
            f.bonusUnitMultiplierStartHeroOnly = v;
          })
        }
      />

      <div className="hint">{T.perPlayerHeader}</div>
      <div className="hint">{T.perPlayerHint}</div>
      <div className="rows-editor">
        {file.bonusPerPlayerOverrides.map((row, idx) => (
          <div className="row-editor" key={idx}>
            <SelectField
              label={T.slot}
              value={row.playerSlot}
              options={slotOptions}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.playerSlot = v;
                })
              }
            />
            <NumberField
              label={T.attack}
              value={row.heroAttack}
              min={0}
              max={20}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.heroAttack = Math.max(0, Math.round(v));
                })
              }
            />
            <NumberField
              label={T.defense}
              value={row.heroDefense}
              min={0}
              max={20}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.heroDefense = Math.max(0, Math.round(v));
                })
              }
            />
            <NumberField
              label={T.spellpower}
              value={row.heroSpellpower}
              min={0}
              max={20}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.heroSpellpower = Math.max(0, Math.round(v));
                })
              }
            />
            <NumberField
              label={T.knowledge}
              value={row.heroKnowledge}
              min={0}
              max={20}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.heroKnowledge = Math.max(0, Math.round(v));
                })
              }
            />
            <NumberField
              label={T.gold}
              value={row.resources.gold ?? 0}
              min={0}
              max={100}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  const gold = Math.max(0, Math.round(v));
                  if (gold === 0) delete r.resources.gold;
                  else r.resources.gold = gold;
                })
              }
            />
            <SliderRow
              label={T.unitMultiplier}
              min={0}
              max={500}
              suffix="%"
              value={Math.round(row.unitMultiplier * 100)}
              onChange={(v) =>
                updateRow(idx, (r) => {
                  r.unitMultiplier = v / 100;
                })
              }
            />
            <button
              type="button"
              onClick={() =>
                patch((f) => {
                  f.bonusPerPlayerOverrides = f.bonusPerPlayerOverrides.filter(
                    (_, i) => i !== idx,
                  );
                })
              }
            >
              {T.remove}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          patch((f) => {
            f.bonusPerPlayerOverrides = [...f.bonusPerPlayerOverrides, emptyOverride()];
          })
        }
      >
        {T.addOverride}
      </button>
    </Card>
  );
}
