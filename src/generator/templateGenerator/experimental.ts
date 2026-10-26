import type { NeutralZoneQuality } from "../enums";
import type {
  BordersRoadsSettings,
  EncounterHolesOptions,
  GeneratorSettings,
  StartingBonusSettings,
  TierOverrides,
  ZoneOverridesSettings,
  ZoneRoadDecoration,
} from "../settings";
import type {
  BiomeSelector,
  Bonus,
  ContentSidLimit,
  RmgTemplate,
  Zone,
  ZoneLayout,
} from "../template";
import { formatUnitMultiplier, roundHalfEven } from "./shared";
import { applyRoadDecorationsToZone } from "../zoneContent/roadDecorations";

/**
 * Порт пост-процессоров TemplateGenerator.cs: экспериментальные настройки,
 * per-zone оверлеи, terrain-клоны по тирам, borders/roads, encounter holes,
 * стартовые бонусы (включая per-player переопределения).
 * Каждая ветка гейтится на не-дефолтное значение: свежие настройки дают
 * байт-идентичный дефолтный вывод.
 */

// ── Дорожные декорации (пост-пасс Generate) ──────────────────────────────────

/**
 * Применяет пользовательские дорожные декорации к каждой зоне. Вынесено в
 * пост-пасс (а не в BuildSpawnZone/BuildNeutralZone), потому что те билдеры
 * не принимают GeneratorSettings и вызываются из многих топологических
 * мест; мутация списка зон варианта даёт тот же эффект.
 */
export function applyZoneRoadDecorations(template: RmgTemplate, settings: GeneratorSettings): void {
  if (settings.zoneRoadDecorations.length === 0 || template.variants === null || template.variants === undefined) return;

  const byZoneName = new Map<string, ZoneRoadDecoration[]>();
  for (const d of settings.zoneRoadDecorations) {
    const list = byZoneName.get(d.zone);
    if (list) list.push(d);
    else byZoneName.set(d.zone, [d]);
  }

  for (const variant of template.variants) {
    if (variant.zones === null || variant.zones === undefined) continue;
    for (const zone of variant.zones) {
      const decorationsForThisZone = byZoneName.get(zone.name);
      if (decorationsForThisZone) applyRoadDecorationsToZone(zone, decorationsForThisZone);
    }
  }
}

// ── Экспериментальные настройки (главный пост-процессор) ────────────────────

export function applyExperimentalSettings(
  template: RmgTemplate,
  settings: GeneratorSettings,
  tierByLetter: Map<string, NeutralZoneQuality>,
): void {
  // Бан найма героев + переопределения desertion
  if (settings.heroHireBan && template.gameRules !== null && template.gameRules !== undefined) {
    template.gameRules.heroHireBan = true;
  }

  const wc = template.gameRules?.winConditions;
  if (wc) {
    if (settings.desertionDay > 0) wc.desertionDay = settings.desertionDay;
    if (settings.desertionValue > 0) wc.desertionValue = settings.desertionValue;
  }

  // Режим SingleHero форсирует число героев в 1.
  if (settings.gameMode === "SingleHero" && template.gameRules) {
    template.gameRules.heroCountMin = 1;
    template.gameRules.heroCountMax = 1;
    template.gameRules.heroCountIncrement = 1;
  }

  // Стартовые бонусы — добавляются к дефолтной generator-записи movementBonus.
  template.gameRules?.bonuses?.push(...buildExperimentalBonuses(settings.bonuses, settings.playerCount));

  // Глобальные баны контента
  if (settings.content.globalBans.length > 0) {
    template.globalBans ??= {};
    template.globalBans.items ??= [];
    for (const sid of settings.content.globalBans) {
      if (!template.globalBans.items.includes(sid)) template.globalBans.items.push(sid);
    }
  }

  // Баны героев — эмитятся как globalBans.heroes (схема подтверждена
  // shipped Arcade.rmg.json).
  if (settings.heroSettings.heroBans.length > 0) {
    template.globalBans ??= {};
    template.globalBans.heroes ??= [];
    for (const sid of settings.heroSettings.heroBans) {
      if (sid.trim().length > 0 && !template.globalBans.heroes.includes(sid)) {
        template.globalBans.heroes.push(sid);
      }
    }
  }

  // Баны спеллов — эмитятся как globalBans.magics; id проходят без
  // валидации, как и баны героев/предметов.
  if (settings.heroSettings.bannedSpells.length > 0) {
    template.globalBans ??= {};
    template.globalBans.magics ??= [];
    for (const sid of settings.heroSettings.bannedSpells) {
      if (sid.trim().length > 0 && !template.globalBans.magics.includes(sid)) {
        template.globalBans.magics.push(sid);
      }
    }
  }

  // Value overrides — эмитятся как RmgTemplate.valueOverrides (форма из
  // shipped Anarchy.rmg.json: { sid, variant, guardValue }). Пустой список →
  // поле опущено. Строки без SID, с неположительным guard value или
  // дублирующие уже выпущенную пару (sid,variant) пропускается (первая
  // валидная строка выигрывает).
  if (settings.content.valueOverrides.length > 0) {
    const seen = new Map<string, Set<number>>();
    for (const v of settings.content.valueOverrides) {
      if (v.sid.trim().length === 0) continue;
      if (v.guardValue <= 0) continue;
      let variants = seen.get(v.sid);
      if (!variants) seen.set(v.sid, (variants = new Set<number>()));
      if (variants.has(v.variant)) continue;
      variants.add(v.variant);
      template.valueOverrides ??= [];
      template.valueOverrides.push({
        sid: v.sid,
        variant: v.variant,
        guardValue: v.guardValue,
      });
    }
  }

  // Дополнительные content count limits — добавляются отдельными записями.
  if (settings.content.contentCountLimits.length > 0) {
    template.contentCountLimits ??= [];
    for (const l of settings.content.contentCountLimits) {
      if (l.sid.trim().length === 0) continue;
      const limits: ContentSidLimit[] = [{ sid: l.sid, maxCount: l.maxPerPlayer }];
      template.contentCountLimits.push({
        name: `user_limit_${l.sid}`,
        limits,
      });
    }
  }

  // Per-zone оверлеи.
  if (template.variants !== null && template.variants !== undefined) {
    for (const variant of template.variants) {
      if (variant.zones !== null && variant.zones !== undefined) {
        for (const zone of variant.zones) {
          applyExperimentalToZone(zone, settings, tierByLetter);
        }
      }
      if (
        variant.connections !== null &&
        variant.connections !== undefined &&
        settings.guardProgression.connectionGuardWeeklyIncrement > 0
      ) {
        for (const c of variant.connections) {
          c.guardWeeklyIncrement = settings.guardProgression.connectionGuardWeeklyIncrement;
        }
      }

      // T-001 — скалярный оверлей уровня подключений. Каждая ветка гейтится,
      // чтобы дефолтные настройки сохраняли байт-идентичный вывод.
      if (variant.connections !== null && variant.connections !== undefined) {
        const cd = settings.connectionDefaults;
        const hasGatePlacement = cd.gatePlacement !== null && cd.gatePlacement !== undefined && cd.gatePlacement.length > 0;
        const hasGuardEscape = cd.guardEscape !== null && cd.guardEscape !== undefined;
        const hasSimTurnSquad = cd.simTurnSquad !== null && cd.simTurnSquad !== undefined;
        const hasGuardRandomization = cd.guardRandomization !== null && cd.guardRandomization !== undefined;
        const anySet =
          cd.length > 0 || hasGatePlacement || hasGuardEscape || hasSimTurnSquad || hasGuardRandomization;
        if (anySet) {
          for (const c of variant.connections) {
            if (cd.length > 0) c.length = cd.length;
            if (hasGatePlacement) c.gatePlacement = cd.gatePlacement as string;
            if (hasGuardEscape) c.guardEscape = cd.guardEscape as boolean;
            if (hasSimTurnSquad) c.simTurnSquad = cd.simTurnSquad as boolean;
            if (hasGuardRandomization) c.guardRandomization = cd.guardRandomization as number;
          }
        }
      }
    }
  }

  // Плотности terrain — применяются ко всем zone layout'ам.
  if (settings.terrain.obstaclesFill > 0 || settings.terrain.lakesFill > 0) {
    if (template.zoneLayouts !== null && template.zoneLayouts !== undefined) {
      for (const layout of template.zoneLayouts) {
        if (settings.terrain.obstaclesFill > 0) layout.obstaclesFill = settings.terrain.obstaclesFill;
        if (settings.terrain.lakesFill > 0) layout.lakesFill = settings.terrain.lakesFill;
      }
    }
  }

  // T-205 — плотность terrain по тирам. Идёт после глобального Terrain-stamp,
  // чтобы клонированные layout'ы наследовали глобальное значение как базу.
  applyPerTierTerrainDensity(template, settings, tierByLetter);

  applyBordersAndRoads(template, settings.bordersRoads);
  applyZoneOverrides(template, settings.zoneOverrides);
  applyEncounterHoles(template, settings.encounterHoles);
}

// ── Encounter holes (T-201) ──────────────────────────────────────────────────
// При выключенном мастере (дефолт) — no-op; зоны не эмитят
// encounterHolesSettings — байт-идентично текущему выводу. При включении
// каждая зона получает одинаковый per-zone объект, как в shipped шаблонах.

function applyEncounterHoles(template: RmgTemplate, o: EncounterHolesOptions): void {
  if (!o.enabled) return;
  if (template.variants === null || template.variants === undefined) return;
  for (const variant of template.variants) {
    if (variant.zones === null || variant.zones === undefined) continue;
    for (const zone of variant.zones) {
      // Клон per zone, чтобы последующая мутация одной зоны не алиасила
      // через siblings.
      zone.encounterHolesSettings = {
        affectedEncounters: o.affectedEncounters,
        twoHoleEncounters: o.twoHoleEncounters,
      };
    }
  }
}

// ── Per-zone схемные ручки (T-005, T-006) ────────────────────────────────────
// Штампует каждое не-дефолтное значение ZoneOverrides на каждую зону каждого
// варианта. Все поля null/пустые (дефолт) → no-op. Списковые переопределения
// заменяют выбор билдера зоны.

function applyZoneOverrides(template: RmgTemplate, o: ZoneOverridesSettings): void {
  if (template.variants === null || template.variants === undefined) return;
  const hasDip = o.diplomacyModifier !== null && o.diplomacyModifier !== undefined;
  const hasXr = o.crossroadsPosition !== null && o.crossroadsPosition !== undefined;
  const hasBiome = o.contentBiomeType.length > 0;
  const hasMetaBiome = o.metaObjectsBiomeType.length > 0;
  const hasCutoff = o.guardCutoffValue !== null && o.guardCutoffValue !== undefined;
  const hasGuarded = o.guardedContentPool.length > 0;
  const hasUnguarded = o.unguardedContentPool.length > 0;
  const hasLimits = o.contentCountLimitRefs.length > 0;
  const hasGuardMultiplier = o.guardMultiplier !== null && o.guardMultiplier !== undefined;
  const hasGuardRandomization = o.guardRandomization !== null && o.guardRandomization !== undefined;
  // T-503 — per-zone content/resource value overrides.
  const hasResourcesValue = o.resourcesValue !== null && o.resourcesValue !== undefined;
  const hasResourcesValuePerArea = o.resourcesValuePerArea !== null && o.resourcesValuePerArea !== undefined;
  const hasGuardedContentValue = o.guardedContentValue !== null && o.guardedContentValue !== undefined;
  const hasGuardedContentValuePerArea =
    o.guardedContentValuePerArea !== null && o.guardedContentValuePerArea !== undefined;
  const hasUnguardedContentValue = o.unguardedContentValue !== null && o.unguardedContentValue !== undefined;
  const hasUnguardedContentValuePerArea =
    o.unguardedContentValuePerArea !== null && o.unguardedContentValuePerArea !== undefined;
  // T-508 — per-zone random-hire рост существ.
  const hasRandomHireEnable = o.randomHireEnableWeeklyUnitIncrement.length > 0;
  const hasRandomHireInitial = o.randomHireInitialUnitIncrement.length > 0;
  if (
    !hasDip && !hasXr && !hasBiome && !hasMetaBiome && !hasCutoff && !hasGuarded && !hasUnguarded && !hasLimits &&
    !hasGuardMultiplier && !hasGuardRandomization &&
    !hasResourcesValue && !hasResourcesValuePerArea &&
    !hasGuardedContentValue && !hasGuardedContentValuePerArea &&
    !hasUnguardedContentValue && !hasUnguardedContentValuePerArea &&
    !hasRandomHireEnable && !hasRandomHireInitial
  ) {
    return;
  }

  const biome: BiomeSelector | null = hasBiome ? buildBiomeOverride(o.contentBiomeType, o.contentBiomeArg) : null;
  const metaBiome: BiomeSelector | null = hasMetaBiome ? buildBiomeOverride(o.metaObjectsBiomeType, o.metaObjectsBiomeArg) : null;

  for (const variant of template.variants) {
    if (variant.zones === null || variant.zones === undefined) continue;
    for (const zone of variant.zones) {
      if (hasDip) zone.diplomacyModifier = o.diplomacyModifier as number;
      if (hasXr) zone.crossroadsPosition = o.crossroadsPosition as number;
      if (biome !== null) {
        // Клон per zone, чтобы последующая мутация не алиасила.
        zone.contentBiome = {
          type: biome.type,
          args: biome.args === null || biome.args === undefined ? null : [...biome.args],
        };
      }
      if (metaBiome !== null) {
        zone.metaObjectsBiome = {
          type: metaBiome.type,
          args: metaBiome.args === null || metaBiome.args === undefined ? null : [...metaBiome.args],
        };
      }
      if (hasCutoff) zone.guardCutoffValue = o.guardCutoffValue as number;
      // Клон каждого списка per zone — мутация одной зоны не протечёт в siblings.
      if (hasGuarded) zone.guardedContentPool = [...o.guardedContentPool];
      if (hasUnguarded) zone.unguardedContentPool = [...o.unguardedContentPool];
      if (hasLimits) zone.contentCountLimits = [...o.contentCountLimitRefs];
      // T-502: per-template переопределения per-zone guard-скаляров — штамп
      // дословно, заменяет вычисленное генератором значение.
      if (hasGuardMultiplier) zone.guardMultiplier = o.guardMultiplier as number;
      if (hasGuardRandomization) zone.guardRandomization = o.guardRandomization as number;
      // T-503: пер-зонные content/resource значения — штамп дословно.
      if (hasResourcesValue) zone.resourcesValue = o.resourcesValue as number;
      if (hasResourcesValuePerArea) zone.resourcesValuePerArea = o.resourcesValuePerArea as number;
      if (hasGuardedContentValue) zone.guardedContentValue = o.guardedContentValue as number;
      if (hasGuardedContentValuePerArea) zone.guardedContentValuePerArea = o.guardedContentValuePerArea as number;
      if (hasUnguardedContentValue) zone.unguardedContentValue = o.unguardedContentValue as number;
      if (hasUnguardedContentValuePerArea) zone.unguardedContentValuePerArea = o.unguardedContentValuePerArea as number;
      // T-508: per-zone random-hire рост существ (клон списков).
      if (hasRandomHireEnable) zone.randomHireEnableWeeklyUnitIncrement = [...o.randomHireEnableWeeklyUnitIncrement];
      if (hasRandomHireInitial) zone.randomHireInitialUnitIncrement = [...o.randomHireInitialUnitIncrement];
    }
  }
}

function buildBiomeOverride(type: string, arg: string): BiomeSelector {
  // MatchZone не принимает args — shipped шаблоны эмитят "args": [].
  // MatchMainObject принимает один индексный арг ("0", "1"). FromList
  // принимает ноль-или-больше biome / "differentFrom: …" токенов.
  // Общий для contentBiome (T-005) и metaObjectsBiome (T-203).
  const args: string[] = [];
  if (arg.trim().length > 0 && type !== "MatchZone") args.push(arg.trim());
  return { type, args };
}

function applyExperimentalToZone(
  zone: Zone,
  settings: GeneratorSettings,
  tierByLetter: Map<string, NeutralZoneQuality>,
): void {
  // Tier-оверлей применяется только к нейтральным зонам; player-зоны
  // используют глобальную настройку. Имена нейтральных — «Neutral-{letter}».
  const letter = extractZoneLetter(zone.name);
  const tier: TierOverrides | null =
    letter !== null && tierByLetter.has(letter) ? getTierOverrides(settings, tierByLetter.get(letter) as NeutralZoneQuality) : null;

  // Недельный прирост guard'ов зоны: tier выигрывает, затем глобальный.
  const tierZoneInc = tier?.guardWeeklyIncrement ?? 0;
  if (tierZoneInc > 0) zone.guardWeeklyIncrement = tierZoneInc;
  else if (settings.guardProgression.zoneGuardWeeklyIncrement > 0) {
    zone.guardWeeklyIncrement = settings.guardProgression.zoneGuardWeeklyIncrement;
  }

  if (zone.mainObjects === null || zone.mainObjects === undefined) return;
  const isPlayerZone = zone.mainObjects.some((o) => o.type === "Spawn");
  const playerPreset = settings.buildingPresets.playerZonePreset;
  const neutralPreset = settings.buildingPresets.neutralZonePreset;
  const tierPreset = tier?.buildingPreset ?? "";
  const neutralChance = settings.neutralCities.guardChance;
  const neutralPct = settings.neutralCities.guardValuePercent;
  const neutralRemoveGuard = settings.neutralCities.removeGuardIfHasOwner;

  for (const mo of zone.mainObjects) {
    // Player Spawn + Cities + AbandonedOutposts несут buildingsConstructionSid.
    const isCityLike = mo.type === "City" || mo.type === "AbandonedOutpost" || mo.type === "Spawn";
    if (!isCityLike) continue;
    const isSpawnCity =
      mo.type === "Spawn" ||
      (mo.type === "City" && mo.spawn !== null && mo.spawn !== undefined && mo.spawn.length > 0);

    if (isPlayerZone || isSpawnCity) {
      if (playerPreset.length > 0) mo.buildingsConstructionSid = playerPreset;
    } else {
      // Tier-переопределение выигрывает у глобального neutral-пресета.
      if (tierPreset.length > 0) mo.buildingsConstructionSid = tierPreset;
      else if (neutralPreset.length > 0) mo.buildingsConstructionSid = neutralPreset;
      if (neutralChance > 0) mo.guardChance = neutralChance;
      if (neutralPct !== 100 && typeof mo.guardValue === "number") {
        // C# Math.Round по умолчанию — banker's rounding (ToEven).
        mo.guardValue = roundHalfEven(mo.guardValue * (neutralPct / 100.0));
      }
      if (neutralRemoveGuard) mo.removeGuardIfHasOwner = true;
    }
  }
}

function applyBordersAndRoads(template: RmgTemplate, br: BordersRoadsSettings): void {
  if (template.variants === null || template.variants === undefined) return;
  for (const variant of template.variants) {
    if (variant.border !== null && variant.border !== undefined) {
      if (br.cornerRadius !== null && br.cornerRadius !== undefined) variant.border.cornerRadius = br.cornerRadius;
      if (br.obstaclesWidth !== null && br.obstaclesWidth !== undefined) variant.border.obstaclesWidth = br.obstaclesWidth;
      if (br.waterBorderEnabled) variant.border.waterWidth = br.waterWidth;
    }

    if (br.roadType !== null && br.roadType !== undefined && br.roadType.length > 0 && variant.zones) {
      for (const zone of variant.zones) {
        if (zone.roads === null || zone.roads === undefined) continue;
        for (const road of zone.roads) road.type = br.roadType;
      }
    }
  }
}

/** «{Prefix}-{letter}» → буква; null для непрефиксованных имён вроде «Hub». */
export function extractZoneLetter(zoneName: string): string | null {
  const dash = zoneName.indexOf("-");
  return dash >= 0 && dash + 1 < zoneName.length ? zoneName.slice(dash + 1) : null;
}

export function getTierOverrides(settings: GeneratorSettings, q: NeutralZoneQuality): TierOverrides {
  switch (q) {
    case "Low":
      return settings.zoneCfg.advanced.lowTier;
    case "High":
      return settings.zoneCfg.advanced.highTier;
    default:
      return settings.zoneCfg.advanced.mediumTier;
  }
}

// ── T-205 — плотность terrain по тирам ───────────────────────────────────────
//
// Схема моделирует плотность (obstaclesFill / lakesFill) только на ZoneLayout,
// а четыре встроенных layout'а (Spawn / Sides / TreasureZone / Center) общие
// для всех тиров. Чтобы тиры имели разные плотности, базовый layout клонируется
// на пару (layout, tier), клон добавляется в template.zoneLayouts, и zone.Layout
// переписывается на затронутых зонах. С нулевыми TierOverrides — no-op.

function applyPerTierTerrainDensity(
  template: RmgTemplate,
  settings: GeneratorSettings,
  tierByLetter: Map<string, NeutralZoneQuality>,
): void {
  const advanced = settings.zoneCfg.advanced;
  const anyTierSet =
    advanced.lowTier.obstaclesFill > 0 || advanced.lowTier.lakesFill > 0 ||
    advanced.mediumTier.obstaclesFill > 0 || advanced.mediumTier.lakesFill > 0 ||
    advanced.highTier.obstaclesFill > 0 || advanced.highTier.lakesFill > 0;
  if (!anyTierSet) return;
  if (template.zoneLayouts === null || template.zoneLayouts === undefined) return;
  if (template.variants === null || template.variants === undefined) return;

  // Layout'ы по имени для вставки/поиска клонов.
  const layoutsByName = new Map<string, ZoneLayout>(template.zoneLayouts.map((l): [string, ZoneLayout] => [l.name, l]));

  // Кэш клонов: пара (baseLayout, tier) → одно и то же клонированное имя
  // во всех вариантах.
  const clones = new Map<string, string>();

  const tierSuffix = (q: NeutralZoneQuality): string =>
    q === "Low" ? "low" : q === "High" ? "high" : "medium";

  for (const variant of template.variants) {
    if (variant.zones === null || variant.zones === undefined) continue;
    for (const zone of variant.zones) {
      const letter = extractZoneLetter(zone.name);
      if (letter === null) continue;
      const tierQuality = tierByLetter.get(letter);
      if (tierQuality === undefined) continue;

      const ov = getTierOverrides(settings, tierQuality);
      if (ov.obstaclesFill <= 0 && ov.lakesFill <= 0) continue;

      const baseName = zone.layout;
      if (baseName === null || baseName === undefined || baseName.length === 0) continue;
      const baseLayout = layoutsByName.get(baseName);
      if (!baseLayout) continue;

      const key = `${baseName}|${tierQuality}`;
      let cloneName = clones.get(key);
      if (cloneName === undefined) {
        cloneName = `${baseName}_${tierSuffix(tierQuality)}`;
        const clone: ZoneLayout = {
          name: cloneName,
          obstaclesFill: ov.obstaclesFill > 0 ? ov.obstaclesFill : baseLayout.obstaclesFill,
          obstaclesFillVoid: baseLayout.obstaclesFillVoid,
          lakesFill: ov.lakesFill > 0 ? ov.lakesFill : baseLayout.lakesFill,
          minLakeArea: baseLayout.minLakeArea,
          elevationClusterScale: baseLayout.elevationClusterScale,
          elevationModes:
            baseLayout.elevationModes === null || baseLayout.elevationModes === undefined
              ? null
              : [...baseLayout.elevationModes],
          roadClusterArea: baseLayout.roadClusterArea,
          guardedEncounterResourceFractions: baseLayout.guardedEncounterResourceFractions,
          ambientPickupDistribution: baseLayout.ambientPickupDistribution,
        };
        template.zoneLayouts.push(clone);
        layoutsByName.set(cloneName, clone);
        clones.set(key, cloneName);
      }
      zone.layout = cloneName;
    }
  }
}

// ── Стартовые бонусы (включая per-player переопределения, T-206) ─────────────

export function buildExperimentalBonuses(b: StartingBonusSettings, playerCount: number): Bonus[] {
  // Разрешение per-slot переопределений: last-write-wins для дубликатов;
  // вне-диапазона строки пропускаются (валидатор предупреждает отдельно).
  const overridesBySlot = new Map<number, StartingBonusSettings>();
  for (const row of b.perPlayerOverrides) {
    if (row.playerSlot < 1 || row.playerSlot > playerCount) continue;
    overridesBySlot.set(row.playerSlot, row.bonuses);
  }

  const resultList: Bonus[] = [];

  // Ресурсы: без переопределений — исходный порядок словаря сохраняется
  // (байт-идентично эмитеру до T-206). С переопределениями — union SID'ов:
  // сначала uniform SID'ы (в исходном порядке), затем override-only SID'ы.
  if (overridesBySlot.size === 0) {
    for (const [sid, amount] of Object.entries(b.resources)) {
      if (amount === 0 || sid.trim().length === 0) continue;
      resultList.push(makeResourceBonus(sid, amount, -1));
    }
  } else {
    const orderedSids: string[] = [];
    const seen = new Set<string>();
    for (const sid of Object.keys(b.resources)) {
      if (!seen.has(sid)) {
        seen.add(sid);
        orderedSids.push(sid);
      }
    }
    for (const ov of overridesBySlot.values()) {
      for (const sid of Object.keys(ov.resources)) {
        if (!seen.has(sid)) {
          seen.add(sid);
          orderedSids.push(sid);
        }
      }
    }

    for (const sid of orderedSids) {
      if (sid.trim().length === 0) continue;
      const uniform = Object.prototype.hasOwnProperty.call(b.resources, sid) ? b.resources[sid] : 0;
      const anyOverride = Array.from(overridesBySlot.values()).some((o) =>
        Object.prototype.hasOwnProperty.call(o.resources, sid),
      );
      if (!anyOverride) {
        if (uniform === 0) continue;
        resultList.push(makeResourceBonus(sid, uniform, -1));
        continue;
      }
      for (let slot = 1; slot <= playerCount; slot++) {
        let amount = uniform;
        const ov = overridesBySlot.get(slot);
        if (ov && Object.prototype.hasOwnProperty.call(ov.resources, sid)) {
          amount = ov.resources[sid];
        }
        if (amount === 0) continue;
        resultList.push(makeResourceBonus(sid, amount, slot));
      }
    }
  }

  // Статы героя
  emitStat("attack", (x) => x.heroAttack);
  emitStat("defense", (x) => x.heroDefense);
  emitStat("spellpower", (x) => x.heroSpellpower);
  emitStat("knowledge", (x) => x.heroKnowledge);

  // Предмет
  emitField(
    (x) => x.itemSid.trim().length > 0,
    (value, startHeroOnly, side) => {
      resultList.push({
        sid: "add_bonus_hero_item",
        receiverSide: side,
        receiverFilter: startHeroOnly ? "start_hero" : "all_heroes",
        parameters: [value],
      });
    },
    (x) => x.itemSid,
    (x) => x.itemStartHeroOnly,
  );

  // Спелл
  emitField(
    (x) => x.spellSid.trim().length > 0,
    (value, startHeroOnly, side) => {
      resultList.push({
        sid: "add_bonus_hero_spell",
        receiverSide: side,
        receiverFilter: startHeroOnly ? "start_hero" : "all_heroes",
        parameters: [value],
      });
    },
    (x) => x.spellSid,
    (x) => x.spellStartHeroOnly,
  );

  // Множитель юнитов
  emitField(
    (x) => x.unitMultiplier > 0,
    (value, startHeroOnly, side) => {
      resultList.push({
        sid: "add_bonus_hero_unit_multipler",
        receiverSide: side,
        receiverFilter: startHeroOnly ? "start_hero" : "all_heroes",
        parameters: [value],
      });
    },
    (x) => formatUnitMultiplier(x.unitMultiplier),
    (x) => x.unitMultiplierStartHeroOnly,
  );

  return resultList;

  function makeResourceBonus(sid: string, amount: number, receiverSide: number): Bonus {
    return {
      sid: "add_bonus_res",
      receiverSide,
      receiverFilter: "all_heroes",
      parameters: [sid, String(amount)],
    };
  }

  function emitStat(statName: string, get: (x: StartingBonusSettings) => number): void {
    const uniform = get(b);
    const anyOverride = Array.from(overridesBySlot.values()).some((o) => get(o) !== 0);
    if (!anyOverride) {
      if (uniform === 0) return;
      resultList.push({
        sid: "add_bonus_hero_stat",
        receiverSide: -1,
        receiverFilter: b.heroStatStartHeroOnly ? "start_hero" : "all_heroes",
        parameters: [statName, String(uniform)],
      });
      return;
    }
    for (let slot = 1; slot <= playerCount; slot++) {
      let value = uniform;
      let startHeroOnly = b.heroStatStartHeroOnly;
      const ov = overridesBySlot.get(slot);
      if (ov) {
        const ovVal = get(ov);
        if (ovVal !== 0) {
          value = ovVal;
          startHeroOnly = ov.heroStatStartHeroOnly;
        }
      }
      if (value === 0) continue;
      resultList.push({
        sid: "add_bonus_hero_stat",
        receiverSide: slot,
        receiverFilter: startHeroOnly ? "start_hero" : "all_heroes",
        parameters: [statName, String(value)],
      });
    }
  }

  function emitField(
    hasValue: (x: StartingBonusSettings) => boolean,
    emitOne: (value: string, startHeroOnly: boolean, side: number) => void,
    getValue: (x: StartingBonusSettings) => string,
    getStartHeroOnly: (x: StartingBonusSettings) => boolean,
  ): void {
    const uniformHas = hasValue(b);
    const anyOverride = Array.from(overridesBySlot.values()).some(hasValue);
    if (!anyOverride) {
      if (!uniformHas) return;
      emitOne(getValue(b), getStartHeroOnly(b), -1);
      return;
    }
    for (let slot = 1; slot <= playerCount; slot++) {
      let value = uniformHas ? getValue(b) : "";
      let startHeroOnly = getStartHeroOnly(b);
      const ov = overridesBySlot.get(slot);
      if (ov && hasValue(ov)) {
        value = getValue(ov);
        startHeroOnly = getStartHeroOnly(ov);
      }
      if (value.length === 0) continue;
      emitOne(value, startHeroOnly, slot);
    }
  }
}
