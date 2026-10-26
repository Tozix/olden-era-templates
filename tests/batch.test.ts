import { describe, expect, it } from "vitest";
import { planBatch, type BatchParams } from "../src/generator/batch";
import { defaultGeneratorSettings } from "../src/generator/settings";
import { generate } from "../src/generator/templateGenerator";
import { fromFile, toFile } from "../src/generator/settingsMapper";
import { defaultSettingsFile } from "../src/generator/settingsFile";
import { validate } from "../src/generator/settingsValidator";
import { generateMapNames } from "../src/generator/nameGen";
import { Rng } from "../src/generator/rng";

const PARAMS: BatchParams = {
  count: 4,
  sizeMin: 96,
  sizeMax: 240,
  topologies: ["Random", "HubAndSpoke"],
  playersMin: 2,
  playersMax: 6,
  baseSeed: 100,
  nameSeed: 200,
};

describe("batch", () => {
  it("детерминизм: одинаковые параметры → одинаковые имена/параметры/шаблоны", () => {
    const base = defaultGeneratorSettings();
    const a = planBatch(base, { ...PARAMS });
    const b = planBatch(base, { ...PARAMS });
    expect(a.map((m) => m.name)).toEqual(b.map((m) => m.name));
    expect(a.map((m) => [m.mapSize, m.topology, m.playerCount, m.seed])).toEqual(
      b.map((m) => [m.mapSize, m.topology, m.playerCount, m.seed]),
    );
    expect(JSON.stringify(a[0].template)).toBe(JSON.stringify(b[0].template));
  });

  it("имена уникальны и осмысленные (не заглушки «Карта N»)", () => {
    const names = generateMapNames(10, new Rng(42));
    expect(new Set(names).size).toBe(10);
    for (const name of names) {
      expect(name).not.toMatch(/^Карта \d/);
    }
  });

  it("каждая карта партии валидна, топология/игроки из диапазона", () => {
    const base = defaultGeneratorSettings();
    const maps = planBatch(base, { ...PARAMS });
    for (const m of maps) {
      expect(m.playerCount).toBeGreaterThanOrEqual(2);
      expect(m.playerCount).toBeLessThanOrEqual(6);
      expect(PARAMS.topologies).toContain(m.topology);
      expect(validate(m.settings).filter((i) => i.severity === "error")).toHaveLength(0);
    }
  });

  it("mapper: forcedContent round-trip (sid/count/zoneTarget↔target)", () => {
    const file = defaultSettingsFile();
    file.forcedContent = [{ sid: "dragon_utopia", count: 3, zoneTarget: "neutral" }];
    const s = fromFile(file);
    expect(s.forcedContent).toEqual([{ sid: "dragon_utopia", count: 3, target: "neutral" }]);
    const back = toFile(s);
    expect(back.forcedContent).toEqual(file.forcedContent);
  });

  it("generate: гарантированные утопии попадают в mandatory content", () => {
    const s = defaultGeneratorSettings();
    s.zoneCfg.neutralZoneCount = 3;
    s.forcedContent = [{ sid: "dragon_utopia", count: 5, target: "neutral" }];
    const t = generate(s);
    let utopias = 0;
    for (const g of t.mandatoryContent ?? []) {
      utopias += (g.content ?? []).filter((c) => c.sid === "dragon_utopia").length;
    }
    expect(utopias).toBe(5);
  });
});
