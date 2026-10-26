import { useMemo, useState } from "react";
import { useApp } from "../../state/settingsStore";
import { Card, Chip, FieldError, NumberField, SelectField, TextField, type SelectOption } from "../ui";
import { communityCatalog, unitTooltipText } from "../../generator/communityCatalog";
import type { UnitEntry } from "../../generator/communityCatalog";
import { FACTIONS } from "../../generator/heroCatalog";
import { allSidCatalogEntries } from "../../generator/zoneContent/sidCatalog";
import { pickerMatches } from "../../generator/pickerFilter";
import { ValidationFieldKeys } from "../../generator/settingsValidator";

/**
 * Порт content-control-секции ExperimentalZonePanel.razor + UnitBanGrid.razor:
 * баны существ по фракциям (globalBans), лимиты количества на игрока
 * (contentCountLimits) и переопределения значения стражи (valueOverrides).
 */

const T = {
  title: "Контроль контента",
  hint: "Бан конкретных объектов, ограничение количества объектов на игрока и переопределение силы стражи по SID.",
  bannedUnits: "Забаненные существа",
  searchUnits: "Поиск существ",
  clearFaction: "Очистить",
  legacyBans: "Лимит-баны вне каталога",
  legacyBanHint: "Нажмите, чтобы снять бан",
  noMatch: "Ничего не найдено",
  countLimits: "Лимиты на игрока",
  limitObject: "Объект",
  limitMax: "Макс. на игрока",
  pickObject: "Выберите объект…",
  addLimit: "+ Добавить лимит",
  valueOverrides: "Переопределения значений стражи",
  valueOverridesHint:
    "Переопределяет силу стражи для стека у конкретного SID. Вариант −1 = любой вариант. Пустой список ничего не добавляет.",
  variant: "Вариант",
  variantAny: "(−1 = любой)",
  guardValue: "Значение стражи",
  addOverride: "+ Добавить переопределение",
  remove: "Удалить",
} as const;

// RU-подпись фракции: id каталога → имя фракции → ru-метка из FACTIONS.
// TODO: verify wording against in-game Russian localization (названия фракций).
function factionRuLabel(factionId: string): string {
  const lower = factionId.toLowerCase();
  const catalogFaction = communityCatalog.factions.find((f) => f.id.toLowerCase() === lower);
  const displayName = catalogFaction?.name ?? factionId;
  const ru = FACTIONS.find((f) => f.displayName.toLowerCase() === displayName.toLowerCase());
  if (ru) return ru.ru;
  if (lower === "neutral") return "Нейтральные";
  return displayName;
}

interface UnitTierGroup {
  tier: number;
  units: UnitEntry[];
}

interface UnitFactionGroup {
  factionId: string;
  label: string;
  tiers: UnitTierGroup[];
}

/** Фракции в каноническом порядке каталога (+ «нейтральные» и прочие в конце), внутри — по тиру и имени. */
function buildUnitGroups(): UnitFactionGroup[] {
  const units = communityCatalog.units;
  const factionIds: string[] = [];
  const seen = new Set<string>();
  const pushId = (id: string) => {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      factionIds.push(id);
    }
  };
  for (const f of communityCatalog.factions) pushId(f.id);
  for (const u of units) pushId(u.faction);

  const groups: UnitFactionGroup[] = [];
  for (const fid of factionIds) {
    const inFaction = units.filter((u) => u.faction.toLowerCase() === fid.toLowerCase());
    if (inFaction.length === 0) continue;
    const tierKeys = [...new Set(inFaction.map((u) => u.tier))].sort((a, b) => a - b);
    groups.push({
      factionId: fid,
      label: factionRuLabel(fid),
      tiers: tierKeys.map((tier) => ({
        tier,
        units: inFaction
          .filter((u) => u.tier === tier)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    });
  }
  return groups;
}

export function ContentControlCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const [unitFilter, setUnitFilter] = useState("");

  const unitGroups = useMemo(() => buildUnitGroups(), []);
  const catalogIds = useMemo(
    () => new Set(communityCatalog.units.map((u) => u.id.toLowerCase())),
    [],
  );
  const sidOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: T.pickObject },
      ...allSidCatalogEntries().map((e) => ({ value: e.sid, label: `${e.sid} · ${e.friendlyName}` })),
    ],
    [],
  );

  // Баны, которых нет в каталоге (авторские правки) — показываем отдельно, только снятие.
  const legacyBans = useMemo(
    () => file.globalBans.filter((b) => !catalogIds.has(b.toLowerCase())),
    [file.globalBans, catalogIds],
  );

  const toggleBan = (id: string) => {
    patch((f) => {
      f.globalBans = f.globalBans.includes(id)
        ? f.globalBans.filter((b) => b !== id)
        : [...f.globalBans, id];
    });
  };

  const clearFaction = (group: UnitFactionGroup) => {
    const ids = new Set(group.tiers.flatMap((t) => t.units.map((u) => u.id)));
    patch((f) => {
      f.globalBans = f.globalBans.filter((b) => !ids.has(b));
    });
  };

  const patchLimit = (idx: number, partial: Partial<{ sid: string; maxPerPlayer: number }>) => {
    patch((f) => {
      f.contentCountLimits = f.contentCountLimits.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      );
    });
  };
  const addLimit = () => {
    patch((f) => {
      f.contentCountLimits = [...f.contentCountLimits, { sid: "", maxPerPlayer: 1 }];
    });
  };
  const removeLimit = (idx: number) => {
    patch((f) => {
      f.contentCountLimits = f.contentCountLimits.filter((_, i) => i !== idx);
    });
  };

  const patchOverride = (idx: number, partial: Partial<{ sid: string; variant: number; guardValue: number }>) => {
    patch((f) => {
      f.valueOverrides = f.valueOverrides.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      );
    });
  };
  const addOverride = () => {
    // Вариант −1 = «любой», значение 0 = «не задано» (не эмитится) — как в razor.
    patch((f) => {
      f.valueOverrides = [...f.valueOverrides, { sid: "", variant: -1, guardValue: 0 }];
    });
  };
  const removeOverride = (idx: number) => {
    patch((f) => {
      f.valueOverrides = f.valueOverrides.filter((_, i) => i !== idx);
    });
  };

  let anyUnitMatch = false;

  return (
    <Card title={T.title}>
      <FieldError fieldKey={ValidationFieldKeys.ZoneContentPool} />
      <div className="hint">{T.hint}</div>

      {/* Баны существ (UnitBanGrid.razor) */}
      <div className="rows-editor">
        <div className="hint">
          {T.bannedUnits} ({file.globalBans.length})
        </div>
        <TextField label={T.searchUnits} value={unitFilter} onChange={setUnitFilter} />
        <div className="rows-editor">
          {unitGroups.map((group) => {
            const filteredTiers = group.tiers
              .map((tier) => ({
                tier: tier.tier,
                units: tier.units.filter((u) =>
                  pickerMatches(unitFilter, u.name, u.id, u.variant ?? null, `T${tier.tier}`, group.label),
                ),
              }))
              .filter((t) => t.units.length > 0);
            if (filteredTiers.length === 0) return null;
            anyUnitMatch = true;
            return (
              <div key={group.factionId} className="rows-editor">
                <div className="row-editor">
                  <span className="hint grow">{group.label}</span>
                  <button
                    type="button"
                    className="icon"
                    title={`${T.clearFaction}: ${group.label}`}
                    onClick={() => clearFaction(group)}
                  >
                    {T.clearFaction}
                  </button>
                </div>
                {filteredTiers.map((tier) => (
                  <div key={tier.tier} className="row-editor">
                    <span className="hint">T{tier.tier}</span>
                    <div className="chips grow">
                      {tier.units.map((unit) => (
                        <Chip
                          key={unit.id}
                          label={unit.variant ? `${unit.name} (${unit.variant})` : unit.name}
                          title={unitTooltipText(unit)}
                          active={file.globalBans.includes(unit.id)}
                          onClick={() => toggleBan(unit.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {!anyUnitMatch && unitFilter.trim().length > 0 && (
            <div className="hint">
              {T.noMatch}: «{unitFilter}»
            </div>
          )}
          {legacyBans.length > 0 && (
            <div className="rows-editor">
              <div className="hint">{T.legacyBans}</div>
              <div className="chips">
                {legacyBans.map((sid) => (
                  <Chip key={sid} label={sid} title={T.legacyBanHint} active={true} onClick={() => toggleBan(sid)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Лимиты количества на игрока */}
      <div className="rows-editor">
        <div className="hint">{T.countLimits}</div>
        <div className="rows-editor">
          {file.contentCountLimits.map((limit, idx) => (
            <div key={idx} className="row-editor">
              <span className="grow">
                <SelectField
                  label={T.limitObject}
                  value={limit.sid}
                  options={sidOptions}
                  onChange={(v) => patchLimit(idx, { sid: v })}
                />
              </span>
              <NumberField
                label={T.limitMax}
                value={limit.maxPerPlayer}
                min={1}
                max={99}
                onChange={(v) => patchLimit(idx, { maxPerPlayer: v })}
              />
              <button type="button" className="icon" title={T.remove} onClick={() => removeLimit(idx)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLimit}>
          {T.addLimit}
        </button>
      </div>

      {/* Переопределения значения стражи */}
      <div className="rows-editor">
        <div className="hint">{T.valueOverrides}</div>
        <div className="hint">{T.valueOverridesHint}</div>
        <div className="rows-editor">
          {file.valueOverrides.map((vo, idx) => (
            <div key={idx} className="row-editor">
              <span className="grow">
                <SelectField
                  label={T.limitObject}
                  value={vo.sid}
                  options={sidOptions}
                  onChange={(v) => patchOverride(idx, { sid: v })}
                />
              </span>
              <NumberField
                label={T.variant}
                hint={T.variantAny}
                value={vo.variant}
                min={-1}
                max={8}
                onChange={(v) => patchOverride(idx, { variant: v })}
              />
              <NumberField
                label={T.guardValue}
                value={vo.guardValue}
                min={0}
                max={999999}
                step={100}
                onChange={(v) => patchOverride(idx, { guardValue: v })}
              />
              <button type="button" className="icon" title={T.remove} onClick={() => removeOverride(idx)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addOverride}>
          {T.addOverride}
        </button>
      </div>
    </Card>
  );
}
