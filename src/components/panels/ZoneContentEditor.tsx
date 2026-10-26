import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../state/settingsStore";
import type { SettingsFile } from "../../generator/settingsFile";
import { fromFile } from "../../generator/settingsMapper";
import type { NeutralZoneTier, RoadDistance, ZoneContentPool, ZoneRoadEndpointKind, ZoneRoadType } from "../../generator/enums";
import {
  emptyZoneContentList,
  emptyZoneRoadDecoration,
  type ZoneContentItem,
  type ZoneRoadDecoration,
} from "../../generator/settings";
import { ZoneContentScopeKind } from "../../generator/zoneContent/scope";
import {
  cloneItem,
  cloneList,
  cloneNeutral,
  cloneRoadDecorations,
} from "../../generator/zoneContent/cloning";
import { groupedSidCatalogEntries } from "../../generator/zoneContent/sidCatalog";
import { groupedContentListEntries } from "../../generator/zoneContent/contentListCatalog";
import { allZoneContentPresets } from "../../generator/zoneContent/presets";
import { validateZoneContentItem } from "../../generator/zoneContent/itemValidator";
import { projectZoneContentWarnings } from "../../generator/zoneContent/warnings";
import type { EmitWarning, ZoneContentWarning } from "../../generator/zoneContent/warnings";
import { parseRulesCsv, joinRulesCsv } from "../../generator/zoneContent/ruleCsv";
import { parseSidCsv, joinSidCsv } from "../../generator/sidCsv";
import { pickerMatches } from "../../generator/pickerFilter";
import {
  CheckboxRow,
  Chip,
  Collapsible,
  NumberField,
  SelectField,
  TextField,
  type SelectOption,
} from "../ui";

/**
 * Порт ZoneContentEditor.razor: мастер-редактор контента зон — скоуп-табы
 * (игроки / нейтральные глобально / по тирам / по буквам зон / дорожные
 * декорации), master-detail списка ZoneContentItem, форма выбранного элемента,
 * дорожные декорации. Все мутации — через store.patch с предварительным
 * глубоким клонированием затрагиваемого дерева (settingsMapper алиасит деревья
 * между GeneratorSettings и SettingsFile, мутировать их на месте нельзя).
 */

const T = {
  compareDefaults: "Сравнивать с настройками по умолчанию (только чтение)",
  compareBanner: "Показаны настройки по умолчанию — редактирование приостановлено.",
  warnings: "Предупреждения контента",
  selection: "Выбрано",
  tabPlayer: "Зоны игроков",
  tabNeutralGlobal: "Нейтральные: все",
  tabNeutralPoor: "Нейтральные: бедные",
  tabNeutralNormal: "Нейтральные: обычные",
  tabNeutralRich: "Нейтральные: богатые",
  tabPerZone: "По зонам",
  tabRoads: "Дорожные декорации",
  zoneLetter: "Буква зоны",
  addLetter: "+ Добавить букву",
  newLetter: "Новая буква",
  newLetterPlaceholder: "A",
  pickLetter: "Выберите букву зоны выше (или добавьте её).",
  add: "+ Добавить",
  preset: "Пресет",
  presetPick: "+ Добавить из пресета…",
  noItems: "Пока нет элементов.",
  noSid: "(без SID)",
  selectItem: "Выберите элемент для редактирования.",
  item: "Элемент",
  sid: "SID",
  handle: "Обработчик (handle)",
  isGroup: "Группа (isGroup)",
  minCount: "Мин. количество",
  maxCount: "Макс. количество",
  pool: "Пул",
  poolMandatory: "Обязательный",
  poolGuarded: "Под стражей",
  poolUnguarded: "Без стражи",
  poolResources: "Ресурсы",
  isGuarded: "Под стражей",
  nearCastle: "Возле замка",
  roadDistance: "Расстояние до дороги",
  roadDistanceUnset: "—",
  roadDistanceClose: "Близко",
  roadDistanceMid: "Средне",
  roadDistanceFar: "Далеко",
  factionAffinity: "Привязка к фракциям",
  biomeFilter: "Фильтр биома",
  rules: "Правила",
  rulesPlaceholder: "MainObject|0|0.05|0.25|1; Crossroads||0.10|0.30|1",
  rulesHint: "Формат: Тип|арг1/арг2|мин|макс|вес; правила разделяются точкой с запятой.",
  includeLists: "Списки контента (включённые)",
  search: "Поиск",
  problems: "Проверка",
  // Дорожные декорации
  addRoad: "+ Добавить декорацию",
  noRoads: "Дорожных декораций нет.",
  roadN: "Декорация",
  noZone: "(без зоны)",
  zone: "Зона",
  roadType: "Тип дороги",
  roadTypeStone: "Камень",
  roadTypeDirt: "Грунт",
  from: "От",
  to: "До",
  arg: "Аргумент",
  endpointConnection: "Связь",
  endpointMainObject: "Главный объект",
  endpointMandatoryContent: "Обязательный контент",
} as const;

interface ScopeState {
  kind: number;
  letter: string;
}

const TABS: readonly { kind: number; label: string }[] = [
  { kind: ZoneContentScopeKind.Player, label: T.tabPlayer },
  { kind: ZoneContentScopeKind.NeutralGlobal, label: T.tabNeutralGlobal },
  { kind: ZoneContentScopeKind.NeutralPoor, label: T.tabNeutralPoor },
  { kind: ZoneContentScopeKind.NeutralNormal, label: T.tabNeutralNormal },
  { kind: ZoneContentScopeKind.NeutralRich, label: T.tabNeutralRich },
  { kind: ZoneContentScopeKind.NeutralPerZone, label: T.tabPerZone },
  { kind: ZoneContentScopeKind.RoadDecorations, label: T.tabRoads },
];

const POOL_OPTIONS: SelectOption<ZoneContentPool>[] = [
  { value: "Mandatory", label: T.poolMandatory },
  { value: "Guarded", label: T.poolGuarded },
  { value: "Unguarded", label: T.poolUnguarded },
  { value: "Resources", label: T.poolResources },
];

const ROAD_DISTANCE_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.roadDistanceUnset },
  { value: "Close", label: T.roadDistanceClose },
  { value: "Mid", label: T.roadDistanceMid },
  { value: "Far", label: T.roadDistanceFar },
];

const ROAD_TYPE_OPTIONS: SelectOption<ZoneRoadType>[] = [
  { value: "Stone", label: T.roadTypeStone },
  { value: "Dirt", label: T.roadTypeDirt },
];

const ENDPOINT_KIND_OPTIONS: SelectOption<ZoneRoadEndpointKind>[] = [
  { value: "Connection", label: T.endpointConnection },
  { value: "MainObject", label: T.endpointMainObject },
  { value: "MandatoryContent", label: T.endpointMandatoryContent },
];

// ── Чистые хелперы над деревом zone-content ─────────────────────────────────

function itemKeyOf(item: ZoneContentItem, index: number): string {
  return item.handle && item.handle.length > 0 ? item.handle : `#${index}`;
}

function itemIndexOf(items: readonly ZoneContentItem[], key: string | null): number {
  if (key === null) return -1;
  if (key.startsWith("#")) {
    const n = Number(key.slice(1));
    return Number.isInteger(n) && n >= 0 && n < items.length ? n : -1;
  }
  return items.findIndex((it) => it.handle === key);
}

function tierForKind(kind: number): NeutralZoneTier | null {
  switch (kind) {
    case ZoneContentScopeKind.NeutralPoor:
      return "Poor";
    case ZoneContentScopeKind.NeutralNormal:
      return "Normal";
    case ZoneContentScopeKind.NeutralRich:
      return "Rich";
    default:
      return null;
  }
}

/** Список элементов текущего скоупа (read-only вью); null — нужна буква зоны. */
function resolveItems(file: SettingsFile, scope: ScopeState): ZoneContentItem[] | null {
  const neutral = file.neutralZoneContent ?? {
    global: emptyZoneContentList(),
    byTier: {},
    byZoneLetter: {},
  };
  switch (scope.kind) {
    case ZoneContentScopeKind.Player:
      return file.playerZoneContent?.items ?? [];
    case ZoneContentScopeKind.NeutralGlobal:
      return neutral.global?.items ?? [];
    default: {
      const tier = tierForKind(scope.kind);
      if (tier !== null) return neutral.byTier?.[tier]?.items ?? [];
      if (scope.kind === ZoneContentScopeKind.NeutralPerZone) {
        if (!scope.letter) return null;
        return neutral.byZoneLetter?.[scope.letter]?.items ?? [];
      }
      return null;
    }
  }
}

/**
 * Клонирует затрагиваемое дерево, применяет мутацию списка элементов и
 * записывает клон обратно в file. Транзиентные скоупы (tier без записи,
 * буква без списка) материализуются при первой правке — как в razor.
 */
function mutateScopeList(
  file: SettingsFile,
  scope: ScopeState,
  mutate: (items: ZoneContentItem[]) => void,
): void {
  switch (scope.kind) {
    case ZoneContentScopeKind.Player: {
      const list = cloneList(file.playerZoneContent ?? emptyZoneContentList());
      mutate(list.items);
      file.playerZoneContent = list;
      return;
    }
    case ZoneContentScopeKind.NeutralGlobal: {
      const neutral = cloneNeutral(
        file.neutralZoneContent ?? { global: emptyZoneContentList(), byTier: {}, byZoneLetter: {} },
      );
      mutate(neutral.global.items);
      file.neutralZoneContent = neutral;
      return;
    }
    case ZoneContentScopeKind.NeutralPerZone: {
      if (!scope.letter) return;
      const neutral = cloneNeutral(
        file.neutralZoneContent ?? { global: emptyZoneContentList(), byTier: {}, byZoneLetter: {} },
      );
      const list = neutral.byZoneLetter[scope.letter] ?? emptyZoneContentList();
      mutate(list.items);
      neutral.byZoneLetter[scope.letter] = list;
      file.neutralZoneContent = neutral;
      return;
    }
    default: {
      const tier = tierForKind(scope.kind);
      if (tier === null) return;
      const neutral = cloneNeutral(
        file.neutralZoneContent ?? { global: emptyZoneContentList(), byTier: {}, byZoneLetter: {} },
      );
      const list = neutral.byTier[tier] ?? emptyZoneContentList();
      mutate(list.items);
      neutral.byTier[tier] = list;
      file.neutralZoneContent = neutral;
    }
  }
}

function warningLine(w: ZoneContentWarning): string {
  const where =
    w.warning.zoneName ??
    (w.scope.kind === ZoneContentScopeKind.NeutralPerZone ? w.scope.zoneLetter ?? "" : "");
  const who = w.warning.sid ?? w.handle ?? `#${w.itemIndex}`;
  const prefix = [where, who].filter((p) => p.length > 0).join(" · ");
  return prefix.length > 0 ? `${prefix}: ${w.warning.message}` : w.warning.message;
}

// ── Локальные под-компоненты ────────────────────────────────────────────────

/** TextField с автодополнением по общему <datalist> каталога SID'ов. */
function SidField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field-row">
      <label>{props.label}</label>
      <span className="field-input">
        <input
          type="text"
          list="zone-content-sids"
          value={props.value}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value)}
        />
      </span>
    </div>
  );
}

/**
 * Текстовое поле для CSV-представления списка (factionAffinity / biomeFilter /
 * rules). Черновик держится локально, чтобы набор «a, b» не нормализовался на
 * каждый ввод; сброс — только когда разбор черновика расходится с внешним
 * значением (undo, загрузка файла).
 */
function CsvListField<T>(props: {
  label: string;
  value: readonly T[];
  parse: (raw: string) => T[];
  join: (list: readonly T[] | null | undefined) => string;
  onChange: (values: T[]) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const joined = props.join(props.value);
  const [draft, setDraft] = useState(joined);
  useEffect(() => {
    if (JSON.stringify(props.parse(draft)) !== JSON.stringify([...props.value])) {
      setDraft(joined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  return (
    <div className="rows-editor">
      <TextField
        label={props.label}
        value={draft}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(v) => {
          setDraft(v);
          props.onChange(props.parse(v));
        }}
      />
      {props.hint && <div className="hint">{props.hint}</div>}
    </div>
  );
}

// Пустой элемент по умолчанию — через cloneItem (как требует контракт клонирования).
function blankItem(): ZoneContentItem {
  return cloneItem({
    sid: "",
    handle: null,
    isGroup: false,
    minCount: 0,
    maxCount: 0,
    pool: "Mandatory",
    isGuarded: false,
    nearCastle: false,
    roadDistance: null,
    factionAffinity: [],
    biomeFilter: [],
    includeListIds: [],
    rules: [],
  });
}

// ── Мастер-редактор ─────────────────────────────────────────────────────────

export function ZoneContentEditor() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const [compare, setCompare] = useState(false);
  const [scope, setScope] = useState<ScopeState>({
    kind: ZoneContentScopeKind.Player,
    letter: "",
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newLetter, setNewLetter] = useState("");
  const [presetChoice, setPresetChoice] = useState("");
  const [includeSearch, setIncludeSearch] = useState("");

  const settings = useMemo(() => fromFile(file), [file]);
  const warnings = useMemo(() => projectZoneContentWarnings(settings), [settings]);
  const sidGroups = useMemo(() => groupedSidCatalogEntries(), []);
  const contentGroups = useMemo(() => groupedContentListEntries(), []);
  const presetOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: T.presetPick },
      ...allZoneContentPresets().map((p) => ({ value: p.name, label: `${p.category} — ${p.name}` })),
    ],
    [],
  );

  const items = useMemo(() => resolveItems(file, scope), [file, scope]);

  const scopeWarnings = useMemo(
    () =>
      warnings.filter(
        (w) =>
          w.scope.kind === scope.kind &&
          (w.scope.kind !== ZoneContentScopeKind.NeutralPerZone || w.scope.zoneLetter === scope.letter),
      ),
    [warnings, scope],
  );
  const warningsByIdx = useMemo(() => {
    const map = new Map<number, EmitWarning[]>();
    for (const w of scopeWarnings) {
      const list = map.get(w.itemIndex);
      if (list) list.push(w.warning);
      else map.set(w.itemIndex, [w.warning]);
    }
    return map;
  }, [scopeWarnings]);

  const selectedIdx = items ? itemIndexOf(items, selectedKey) : -1;
  const selectedItem = items && selectedIdx >= 0 ? items[selectedIdx] : null;
  // TODO: validateZoneContentItem возвращает английские строки — уточнить локализацию.
  const itemProblems = selectedItem ? validateZoneContentItem(selectedItem) : [];
  const selectedItemWarnings = selectedItem && selectedIdx >= 0 ? warningsByIdx.get(selectedIdx) ?? [] : [];

  const chooseScope = (kind: number) => {
    setScope({ kind, letter: kind === ZoneContentScopeKind.NeutralPerZone ? scope.letter : "" });
    setSelectedKey(null);
  };

  const chooseLetter = (letter: string) => {
    setScope({ kind: ZoneContentScopeKind.NeutralPerZone, letter });
    setSelectedKey(null);
  };

  const addLetter = () => {
    const letter = newLetter.trim().toUpperCase();
    if (letter.length !== 1 || !/\p{L}/u.test(letter)) return;
    const existing = file.neutralZoneContent?.byZoneLetter ?? {};
    if (existing[letter]) return;
    patch((f) => {
      const neutral = cloneNeutral(
        f.neutralZoneContent ?? { global: emptyZoneContentList(), byTier: {}, byZoneLetter: {} },
      );
      neutral.byZoneLetter[letter] = emptyZoneContentList();
      f.neutralZoneContent = neutral;
    });
    setNewLetter("");
    chooseLetter(letter);
  };

  const addItem = () => {
    const nextIndex = items?.length ?? 0;
    patch((f) => mutateScopeList(f, scope, (list) => list.push(blankItem())));
    setSelectedKey(`#${nextIndex}`);
  };

  const applyPreset = (name: string) => {
    setPresetChoice("");
    if (!name || !items) return;
    const preset = allZoneContentPresets().find((p) => p.name === name);
    if (!preset) return;
    const inserted = { index: -1 };
    patch((f) =>
      mutateScopeList(f, scope, (list) => {
        list.push(cloneItem(preset.item));
        inserted.index = list.length - 1;
      }),
    );
    if (inserted.index >= 0) setSelectedKey(`#${inserted.index}`);
  };

  const removeItem = (idx: number) => {
    const removedKey = items ? itemKeyOf(items[idx], idx) : null;
    patch((f) => mutateScopeList(f, scope, (list) => list.splice(idx, 1)));
    if (selectedKey === removedKey) setSelectedKey(null);
  };

  const editItem = (mutate: (item: ZoneContentItem) => void) => {
    if (selectedIdx < 0) return;
    patch((f) => mutateScopeList(f, scope, (list) => mutate(list[selectedIdx])));
  };

  const toggleInclude = (id: string) => {
    if (compare) return; // Chip не имеет disabled — режим «только чтение» гасим в обработчике.
    editItem((it) => {
      it.includeListIds = it.includeListIds.includes(id)
        ? it.includeListIds.filter((x) => x !== id)
        : [...it.includeListIds, id];
    });
  };

  // ── Дорожные декорации ────────────────────────────────────────────────────
  const editRoad = (idx: number, mutate: (deco: ZoneRoadDecoration) => void) => {
    patch((f) => {
      const arr = cloneRoadDecorations(f.zoneRoadDecorations ?? []);
      if (idx < 0 || idx >= arr.length) return;
      mutate(arr[idx]);
      f.zoneRoadDecorations = arr;
    });
  };
  const addRoad = () => {
    patch((f) => {
      f.zoneRoadDecorations = [...cloneRoadDecorations(f.zoneRoadDecorations ?? []), emptyZoneRoadDecoration()];
    });
  };
  const removeRoad = (idx: number) => {
    patch((f) => {
      f.zoneRoadDecorations = cloneRoadDecorations(f.zoneRoadDecorations ?? []).filter((_, i) => i !== idx);
    });
  };

  const scopeLabel =
    scope.kind === ZoneContentScopeKind.NeutralPerZone
      ? scope.letter
        ? `${T.tabPerZone} · ${scope.letter}`
        : T.tabPerZone
      : TABS.find((tab) => tab.kind === scope.kind)?.label ?? "";

  const decorations = file.zoneRoadDecorations ?? [];

  return (
    <div className="rows-editor">
      {/* Единый <datalist> для всех Sid-полей редактора (как в razor). */}
      <datalist id="zone-content-sids">
        {sidGroups.map((group) =>
          group.entries.map((entry) => (
            <option
              key={`${group.category}:${entry.sid}`}
              value={entry.sid}
              label={`${entry.friendlyName} — ${group.category}`}
            >
              {entry.friendlyName}
            </option>
          )),
        )}
      </datalist>

      <CheckboxRow label={T.compareDefaults} checked={compare} onChange={setCompare} />
      {compare && <div className="hint">{T.compareBanner}</div>}

      {warnings.length > 0 && (
        <Collapsible summary={`${T.warnings} (${warnings.length})`} defaultOpen={warnings.length <= 5}>
          <div className="rows-editor">
            {warnings.map((w, i) => (
              <div className="hint" key={i} title={w.warning.code}>
                ⚠ {warningLine(w)}
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      <div className="chip-tabs">
        {TABS.map((tab) => (
          <Chip
            key={tab.kind}
            label={tab.label}
            active={scope.kind === tab.kind}
            onClick={() => chooseScope(tab.kind)}
          />
        ))}
      </div>

      {scope.kind === ZoneContentScopeKind.NeutralPerZone && (
        <div className="rows-editor">
          <div className="hint">{T.zoneLetter}</div>
          <div className="chips">
            {Object.keys(file.neutralZoneContent?.byZoneLetter ?? {})
              .sort()
              .map((letter) => (
                <Chip
                  key={letter}
                  label={letter}
                  active={scope.letter === letter}
                  onClick={() => chooseLetter(letter)}
                />
              ))}
          </div>
          <div className="row-editor">
            <span className="grow">
              <TextField
                label={T.newLetter}
                value={newLetter}
                placeholder={T.newLetterPlaceholder}
                disabled={compare}
                onChange={setNewLetter}
              />
            </span>
            <button type="button" className="icon" disabled={compare} onClick={addLetter}>
              {T.addLetter}
            </button>
          </div>
        </div>
      )}

      <div className="hint">
        {T.selection}: {scopeLabel}
      </div>

      {scope.kind === ZoneContentScopeKind.RoadDecorations ? (
        <div className="rows-editor">
          <button type="button" className="icon" disabled={compare} onClick={addRoad}>
            {T.addRoad}
          </button>
          {decorations.length === 0 && <div className="hint">{T.noRoads}</div>}
          {decorations.map((deco, idx) => (
            <Collapsible
              key={idx}
              summary={`${T.roadN} ${idx + 1} — ${deco.zone.length > 0 ? deco.zone : T.noZone}`}
            >
              <div className="rows-editor">
                <div className="row-editor">
                  <span className="grow">
                    <TextField
                      label={T.zone}
                      value={deco.zone}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.zone = v; })}
                    />
                  </span>
                  <span className="grow">
                    <SelectField
                      label={T.roadType}
                      value={deco.roadType}
                      options={ROAD_TYPE_OPTIONS}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.roadType = v; })}
                    />
                  </span>
                  <button
                    type="button"
                    className="icon"
                    disabled={compare}
                    aria-label="✕"
                    onClick={() => removeRoad(idx)}
                  >
                    ✕
                  </button>
                </div>
                <div className="row-editor">
                  <span className="grow">
                    <SelectField
                      label={T.from}
                      value={deco.from.kind}
                      options={ENDPOINT_KIND_OPTIONS}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.from.kind = v; })}
                    />
                  </span>
                  <span className="grow">
                    <TextField
                      label={T.arg}
                      value={deco.from.arg}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.from.arg = v; })}
                    />
                  </span>
                </div>
                <div className="row-editor">
                  <span className="grow">
                    <SelectField
                      label={T.to}
                      value={deco.to.kind}
                      options={ENDPOINT_KIND_OPTIONS}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.to.kind = v; })}
                    />
                  </span>
                  <span className="grow">
                    <TextField
                      label={T.arg}
                      value={deco.to.arg}
                      disabled={compare}
                      onChange={(v) => editRoad(idx, (d) => { d.to.arg = v; })}
                    />
                  </span>
                </div>
              </div>
            </Collapsible>
          ))}
        </div>
      ) : items === null ? (
        <div className="hint">{T.pickLetter}</div>
      ) : (
        <>
          {/* Master: список элементов + добавление */}
          <div className="row-editor">
            <button type="button" className="icon" disabled={compare} onClick={addItem}>
              {T.add}
            </button>
            <span className="grow">
              <SelectField
                label={T.preset}
                value={presetChoice}
                options={presetOptions}
                disabled={compare}
                onChange={applyPreset}
              />
            </span>
          </div>
          {items.length === 0 ? (
            <div className="hint">{T.noItems}</div>
          ) : (
            <div className="rows-editor">
              {items.map((item, idx) => {
                const key = itemKeyOf(item, idx);
                const ws = warningsByIdx.get(idx) ?? [];
                const selected = key === selectedKey;
                return (
                  <div
                    key={`${key}:${idx}`}
                    className="row-editor"
                    style={selected ? { borderColor: "var(--accent)" } : undefined}
                    onClick={() => setSelectedKey(key)}
                  >
                    <span className="grow">{item.sid.length > 0 ? item.sid : T.noSid}</span>
                    <span className="hint">{item.handle ?? "—"}</span>
                    <span className="hint">
                      {item.minCount}-{item.maxCount}
                    </span>
                    {ws.length > 0 && (
                      <span
                        className="hint"
                        title={ws.map((w) => `${w.code}: ${w.message}`).join("\n")}
                      >
                        ⚠ {ws.length}
                      </span>
                    )}
                    <button
                      type="button"
                      className="icon"
                      disabled={compare}
                      aria-label="✕"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(idx);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail: форма выбранного элемента */}
          {selectedItem ? (
            <div className="rows-editor">
              <div className="hint">
                {T.item}: {selectedItem.sid.length > 0 ? selectedItem.sid : T.noSid}
              </div>
              <SidField
                label={T.sid}
                value={selectedItem.sid}
                placeholder="name_mana_well"
                disabled={compare}
                onChange={(v) => editItem((it) => { it.sid = v; })}
              />
              <TextField
                label={T.handle}
                value={selectedItem.handle ?? ""}
                disabled={compare}
                onChange={(v) =>
                  editItem((it) => {
                    it.handle = v.trim().length === 0 ? null : v;
                  })
                }
              />
              <CheckboxRow
                label={T.isGroup}
                checked={selectedItem.isGroup}
                disabled={compare}
                onChange={(v) => editItem((it) => { it.isGroup = v; })}
              />
              <div className="row-editor">
                <span className="grow">
                  <NumberField
                    label={T.minCount}
                    value={selectedItem.minCount}
                    min={0}
                    max={99}
                    disabled={compare}
                    onChange={(v) => editItem((it) => { it.minCount = v; })}
                  />
                </span>
                <span className="grow">
                  <NumberField
                    label={T.maxCount}
                    value={selectedItem.maxCount}
                    min={0}
                    max={99}
                    disabled={compare}
                    onChange={(v) => editItem((it) => { it.maxCount = v; })}
                  />
                </span>
              </div>
              <SelectField
                label={T.pool}
                value={selectedItem.pool}
                options={POOL_OPTIONS}
                disabled={compare}
                onChange={(v) => editItem((it) => { it.pool = v; })}
              />
              <div className="row-editor">
                <CheckboxRow
                  label={T.isGuarded}
                  checked={selectedItem.isGuarded}
                  disabled={compare}
                  onChange={(v) => editItem((it) => { it.isGuarded = v; })}
                />
                <CheckboxRow
                  label={T.nearCastle}
                  checked={selectedItem.nearCastle}
                  disabled={compare}
                  onChange={(v) => editItem((it) => { it.nearCastle = v; })}
                />
              </div>
              <SelectField
                label={T.roadDistance}
                value={selectedItem.roadDistance ?? ""}
                options={ROAD_DISTANCE_OPTIONS}
                disabled={compare}
                onChange={(v) =>
                  editItem((it) => {
                    it.roadDistance = v === "" ? null : (v as RoadDistance);
                  })
                }
              />
              <CsvListField
                label={T.factionAffinity}
                value={selectedItem.factionAffinity}
                parse={parseSidCsv}
                join={joinSidCsv}
                disabled={compare}
                onChange={(vals) => editItem((it) => { it.factionAffinity = vals; })}
              />
              <CsvListField
                label={T.biomeFilter}
                value={selectedItem.biomeFilter}
                parse={parseSidCsv}
                join={joinSidCsv}
                disabled={compare}
                onChange={(vals) => editItem((it) => { it.biomeFilter = vals; })}
              />
              <CsvListField
                label={T.rules}
                value={selectedItem.rules}
                parse={parseRulesCsv}
                join={joinRulesCsv}
                placeholder={T.rulesPlaceholder}
                hint={T.rulesHint}
                disabled={compare}
                onChange={(vals) => editItem((it) => { it.rules = vals; })}
              />

              {/* Каталожный мульти-выбор includeLists (T-605, как ContentListPicker). */}
              <div className="rows-editor">
                <div className="hint">{T.includeLists}</div>
                <TextField
                  label={T.search}
                  value={includeSearch}
                  disabled={compare}
                  onChange={setIncludeSearch}
                />
                {contentGroups.map((group) => {
                  const matches = group.entries.filter((e) =>
                    pickerMatches(includeSearch, e.display, e.id),
                  );
                  if (matches.length === 0) return null;
                  return (
                    <div key={group.category} className="rows-editor">
                      <div className="hint">{group.category}</div>
                      <div className="chips">
                        {matches.map((entry) => (
                          <Chip
                            key={entry.id}
                            label={entry.display}
                            title={entry.id}
                            active={selectedItem.includeListIds.includes(entry.id)}
                            onClick={() => toggleInclude(entry.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {itemProblems.length > 0 && (
                <div className="rows-editor">
                  {itemProblems.map((p, i) => (
                    <div className="hint" key={i}>
                      {T.problems}: {p}
                    </div>
                  ))}
                </div>
              )}
              {selectedItemWarnings.length > 0 && (
                <div className="rows-editor">
                  {selectedItemWarnings.map((w, i) => (
                    <div className="hint" key={i} title={w.code}>
                      ⚠ {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="hint">{T.selectItem}</div>
          )}
        </>
      )}
    </div>
  );
}
