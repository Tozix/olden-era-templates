import { useApp } from "../../state/settingsStore";
import type { SettingsFile } from "../../generator/settingsFile";
import { Card, CheckboxRow, NumberField, SelectField, TextField, type SelectOption } from "../ui";
import { SELECTOR_TYPES } from "../../generator/knownValues";

/**
 * Порт zone-overrides-секции ExperimentalZonePanel.razor (T-005/T-006/T-502/
 * T-503/T-508): штамп настроек на каждую зону шаблона. null/пустая строка =
 * «Авто» — значение генератора не изменяется.
 */

const T = {
  title: "Переопределения зон",
  hint: "Настройки, применяемые к каждой зоне шаблона. «Авто» / пустое значение = настройки генератора не меняются.",
  override: "Переопределить",
  diplomacy: "Модификатор дипломатии",
  diplomacyHint: "Пусто — значение генератора (−0.5). Диапазон −1.0 (враждебность) … +1.0 (дружелюбие).",
  crossroads: "Позиция перекрёстка",
  crossroadsAuto: "Авто (значение генератора)",
  crossroads0: "0 — нет",
  crossroads1: "1 — угол",
  crossroads2: "2",
  crossroads3: "3",
  contentBiome: "Биом контента",
  metaObjectsBiome: "Биом метаобъектов",
  biomeAuto: "Авто (значение генератора)",
  biomeArg: "Аргумент",
  biomeArgMainObject: "Индекс главного объекта (0)",
  biomeArgBiomeName: "Имя биома (например, Sand, Deathland)",
  // TODO: verify wording against in-game Russian localization (значения биомов — из данных игры)
  guardCutoff: "Порог силы стражи",
  guardCutoffHint: "Пусто — значение генератора (2000). В шаблонах игры 2000–2500.",
  guardedPool: "Пул контента под стражей (SID)",
  guardedPoolHint: "SID'ы через запятую. Пусто — оставить выбор конструктора зоны.",
  guardedPoolPlaceholder: "template_pool_arcade_guarded_treasure_zone",
  unguardedPool: "Пул контента без стражи (SID)",
  unguardedPoolHint: "SID'ы через запятую. Пусто — значение генератора.",
  unguardedPoolPlaceholder: "template_pool_arcade_unguarded_treasure_zone",
  contentCountLimits: "Ссылки на лимиты контента (CSV)",
  contentCountLimitsHint:
    "Именованные лимиты, которые генератор эмитит в корне шаблона. Пусто — оставить значения по умолчанию.",
  contentCountLimitsPlaceholder: "content_limits_spawn, content_limits_side",
  guardMultiplier: "Множитель стражи",
  guardMultiplierHint:
    "Пусто — значение генератора (по тиру и роли зоны, затем масштабирование). Заданное значение ставится на каждую зону дословно.",
  guardRandomization: "Рандомизация стражи",
  guardRandomizationHint:
    "Пусто — глобальный слайдер (Продвинутые → Рандомизация стражи). 0 = без рандомизации.",
  resourcesValue: "Ресурсы: значение",
  resourcesValuePerArea: "Ресурсы: на площадь",
  resourcesHint:
    "Скаляр и «на площадь» для resourcesValue. Пусто — значение генератора (с масштабом тюнинга). Заданное значение ставится дословно.",
  guardedContentValue: "Контент под стражей: значение",
  guardedContentValuePerArea: "Контент под стражей: на площадь",
  guardedContentHint: "Пусто — значение генератора (по тиру, с масштабом ContentScale).",
  unguardedContentValue: "Контент без стражи: значение",
  unguardedContentValuePerArea: "Контент без стражи: на площадь",
  unguardedContentHint: "Пусто — значение генератора.",
  randomHireEnableWeekly: "Еженедельный прирост найма (по сложности)",
  randomHireEnableWeeklyHint: "CSV из true/false — 7 значений по сложности. Пусто — поле не эмитится.",
  randomHireEnableWeeklyPlaceholder: "false,false,false,false,false,false,false",
  randomHireInitial: "Начальный прирост найма (по сложности)",
  randomHireInitialHint: "CSV из целых чисел — 7 значений по сложности. Пусто — поле не эмитится.",
  randomHireInitialPlaceholder: "3,3,3,3,3,3,3",
} as const;

const BIOME_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.biomeAuto },
  ...SELECTOR_TYPES.map((t) => ({ value: t, label: t })),
];

const CROSSROADS_OPTIONS: SelectOption<string>[] = [
  { value: "", label: T.crossroadsAuto },
  { value: "0", label: T.crossroads0 },
  { value: "1", label: T.crossroads1 },
  { value: "2", label: T.crossroads2 },
  { value: "3", label: T.crossroads3 },
];

/** Nullable-число: CheckboxRow «Переопределить» (null ↔ значение) + NumberField. */
function NullableNumberRow(props: {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  step?: number;
  enableValue?: number;
  hint?: string;
  onChange: (v: number | null) => void;
}) {
  const on = props.value !== null && props.value !== undefined;
  return (
    <div className="rows-editor">
      <CheckboxRow
        label={`${T.override} — ${props.label}`}
        checked={on}
        onChange={(v) => props.onChange(v ? props.enableValue ?? 0 : null)}
      />
      <NumberField
        label={props.label}
        value={props.value ?? 0}
        min={props.min}
        max={props.max}
        step={props.step}
        disabled={!on}
        onChange={(v) => props.onChange(v)}
      />
      {props.hint && <div className="hint">{props.hint}</div>}
    </div>
  );
}

export function ZoneOverridesCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const set = <K extends keyof SettingsFile>(key: K, value: SettingsFile[K]) => {
    patch((f) => {
      f[key] = value;
    });
  };

  const contentBiomeNeedsArg =
    file.zoneContentBiomeType === "MatchMainObject" || file.zoneContentBiomeType === "FromList";
  const metaBiomeNeedsArg =
    file.zoneMetaObjectsBiomeType === "MatchMainObject" || file.zoneMetaObjectsBiomeType === "FromList";

  const crossroadsValue =
    file.zoneCrossroadsPosition === null || file.zoneCrossroadsPosition === undefined
      ? ""
      : String(file.zoneCrossroadsPosition);

  return (
    <Card title={T.title} badge="Экспериментально">
      <div className="hint">{T.hint}</div>

      <NullableNumberRow
        label={T.diplomacy}
        value={file.zoneDiplomacyModifier}
        min={-1}
        max={1}
        step={0.05}
        hint={T.diplomacyHint}
        onChange={(v) => set("zoneDiplomacyModifier", v)}
      />

      <SelectField
        label={T.crossroads}
        value={crossroadsValue}
        options={CROSSROADS_OPTIONS}
        onChange={(v) => {
          const n = Number(v);
          set("zoneCrossroadsPosition", v !== "" && Number.isInteger(n) && n >= 0 && n <= 3 ? n : null);
        }}
      />

      <div className="rows-editor">
        <SelectField
          label={T.contentBiome}
          value={file.zoneContentBiomeType}
          options={BIOME_OPTIONS}
          onChange={(v) => {
            set("zoneContentBiomeType", v);
            if (v === "") set("zoneContentBiomeArg", "");
          }}
        />
        {contentBiomeNeedsArg && (
          <TextField
            label={T.biomeArg}
            value={file.zoneContentBiomeArg}
            placeholder={file.zoneContentBiomeType === "MatchMainObject" ? T.biomeArgMainObject : T.biomeArgBiomeName}
            onChange={(v) => set("zoneContentBiomeArg", v.trim())}
          />
        )}
      </div>

      <div className="rows-editor">
        <SelectField
          label={T.metaObjectsBiome}
          value={file.zoneMetaObjectsBiomeType}
          options={BIOME_OPTIONS}
          onChange={(v) => {
            set("zoneMetaObjectsBiomeType", v);
            if (v === "") set("zoneMetaObjectsBiomeArg", "");
          }}
        />
        {metaBiomeNeedsArg && (
          <TextField
            label={T.biomeArg}
            value={file.zoneMetaObjectsBiomeArg}
            placeholder={file.zoneMetaObjectsBiomeType === "MatchMainObject" ? T.biomeArgMainObject : T.biomeArgBiomeName}
            onChange={(v) => set("zoneMetaObjectsBiomeArg", v.trim())}
          />
        )}
      </div>

      <NullableNumberRow
        label={T.guardCutoff}
        value={file.zoneGuardCutoffValue}
        min={0}
        max={100000}
        step={100}
        enableValue={2000}
        hint={T.guardCutoffHint}
        onChange={(v) => set("zoneGuardCutoffValue", v)}
      />

      <div className="rows-editor">
        <TextField
          label={T.guardedPool}
          value={file.zoneGuardedContentPool}
          placeholder={T.guardedPoolPlaceholder}
          hint={T.guardedPoolHint}
          onChange={(v) => set("zoneGuardedContentPool", v)}
        />
        <TextField
          label={T.unguardedPool}
          value={file.zoneUnguardedContentPool}
          placeholder={T.unguardedPoolPlaceholder}
          hint={T.unguardedPoolHint}
          onChange={(v) => set("zoneUnguardedContentPool", v)}
        />
        <TextField
          label={T.contentCountLimits}
          value={file.zoneContentCountLimits}
          placeholder={T.contentCountLimitsPlaceholder}
          hint={T.contentCountLimitsHint}
          onChange={(v) => set("zoneContentCountLimits", v)}
        />
      </div>

      <NullableNumberRow
        label={T.guardMultiplier}
        value={file.zoneGuardMultiplier}
        min={0}
        max={10}
        step={0.1}
        enableValue={1}
        hint={T.guardMultiplierHint}
        onChange={(v) => set("zoneGuardMultiplier", v)}
      />
      <NullableNumberRow
        label={T.guardRandomization}
        value={file.zoneGuardRandomization}
        min={0}
        max={0.5}
        step={0.01}
        enableValue={0.05}
        hint={T.guardRandomizationHint}
        onChange={(v) => set("zoneGuardRandomization", v)}
      />

      <NullableNumberRow
        label={T.resourcesValue}
        value={file.zoneResourcesValue}
        min={0}
        step={1000}
        onChange={(v) => set("zoneResourcesValue", v)}
      />
      <NullableNumberRow
        label={T.resourcesValuePerArea}
        value={file.zoneResourcesValuePerArea}
        min={0}
        step={50}
        hint={T.resourcesHint}
        onChange={(v) => set("zoneResourcesValuePerArea", v)}
      />

      <NullableNumberRow
        label={T.guardedContentValue}
        value={file.zoneGuardedContentValue}
        min={0}
        step={1000}
        onChange={(v) => set("zoneGuardedContentValue", v)}
      />
      <NullableNumberRow
        label={T.guardedContentValuePerArea}
        value={file.zoneGuardedContentValuePerArea}
        min={0}
        step={50}
        hint={T.guardedContentHint}
        onChange={(v) => set("zoneGuardedContentValuePerArea", v)}
      />

      <NullableNumberRow
        label={T.unguardedContentValue}
        value={file.zoneUnguardedContentValue}
        min={0}
        step={1000}
        onChange={(v) => set("zoneUnguardedContentValue", v)}
      />
      <NullableNumberRow
        label={T.unguardedContentValuePerArea}
        value={file.zoneUnguardedContentValuePerArea}
        min={0}
        step={50}
        hint={T.unguardedContentHint}
        onChange={(v) => set("zoneUnguardedContentValuePerArea", v)}
      />

      <TextField
        label={T.randomHireEnableWeekly}
        value={file.zoneRandomHireEnableWeeklyUnitIncrement}
        placeholder={T.randomHireEnableWeeklyPlaceholder}
        hint={T.randomHireEnableWeeklyHint}
        onChange={(v) => set("zoneRandomHireEnableWeeklyUnitIncrement", v)}
      />
      <TextField
        label={T.randomHireInitial}
        value={file.zoneRandomHireInitialUnitIncrement}
        placeholder={T.randomHireInitialPlaceholder}
        hint={T.randomHireInitialHint}
        onChange={(v) => set("zoneRandomHireInitialUnitIncrement", v)}
      />
    </Card>
  );
}
