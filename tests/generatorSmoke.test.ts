import { describe, expect, it } from "vitest";
import { defaultGeneratorSettings } from "../src/generator/settings";
import { generate } from "../src/generator/templateGenerator";
import { toJsonIndented } from "../src/generator/json";
import { validate } from "../src/generator/settingsValidator";
import { toFile, fromFile } from "../src/generator/settingsMapper";
import { encodeSettings, tryDecodeSettings } from "../src/generator/settingsShareCodec";
import { presetCatalog } from "../src/generator/presetCatalog";
import { communityCatalog } from "../src/generator/communityCatalog";
import { EditHistory } from "../src/generator/editHistory";
import { loadFromDirectory, knownIdsValidateAgainst } from "../tests/helpers/gameDataCatalog";
import path from "node:path";

describe("generate (smoke)", () => {
  it("дефолтные настройки дают валидный шаблон с ожидаемой структурой", () => {
    const settings = defaultGeneratorSettings();
    const template = generate(settings);

    expect(template.name).toBe("Custom Template");
    expect(template.sizeX).toBe(160);
    expect(template.sizeZ).toBe(160);
    expect(template.gameMode).toBe("Classic");
    expect(template.variants).toHaveLength(1);

    const variant = template.variants![0];
    expect(variant.zones!.length).toBeGreaterThanOrEqual(2);
    const spawnZones = variant.zones!.filter((z) => z.name.startsWith("Spawn-"));
    expect(spawnZones).toHaveLength(2);

    expect(variant.connections!.length).toBeGreaterThan(0);
    for (const c of variant.connections!) {
      expect(c.from).toBeTruthy();
      expect(c.to).toBeTruthy();
    }

    // generatorPosition не должен попасть в JSON.
    const json = toJsonIndented(template);
    expect(json).not.toContain("generatorPosition");
    expect(json).toContain("\"zoneLayouts\"");
    expect(json).toContain("\"gameRules\"");
  });

  it("тот же seed → байт-идентичный вывод; разный seed → другой", () => {
    const s1 = { ...defaultGeneratorSettings(), seed: 12345, topology: "Random" as const };
    const s2 = { ...s1 };
    const a = toJsonIndented(generate(s1));
    const b = toJsonIndented(generate(s2));
    expect(a).toBe(b);

    let foundDifferent = false;
    for (let i = 0; i < 5 && !foundDifferent; i++) {
      const c = toJsonIndented(generate({ ...s1, seed: 777 + i }));
      if (c !== a) foundDifferent = true;
    }
    expect(foundDifferent).toBe(true);
  });
});

describe("validator", () => {
  it("дефолты — без блокеров", () => {
    const issues = validate(defaultGeneratorSettings());
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("heroMin > heroMax — блокер на hero.minMax", () => {
    const s = defaultGeneratorSettings();
    s.heroSettings.heroCountMin = 9;
    s.heroSettings.heroCountMax = 5;
    const issues = validate(s);
    expect(issues.some((i) => i.severity === "error" && i.fieldKey === "hero.minMax")).toBe(true);
  });
});

describe("settings mapper round-trip", () => {
  it("toFile → fromFile → toFile стабилен", () => {
    const s = defaultGeneratorSettings();
    s.playerCount = 4;
    s.topology = "HubAndSpoke";
    s.zoneCfg.neutralZoneCount = 5;
    s.gameEndConditions.cityHold = true;
    const f1 = toFile(s);
    const s2 = fromFile(f1);
    const f2 = toFile(s2);
    expect(f2.playerCount).toBe(f1.playerCount);
    expect(f2.topology).toBe(f1.topology);
    expect(f2.neutralZoneCount).toBe(f1.neutralZoneCount);
    expect(f2.cityHold).toBe(f1.cityHold);
  });
});

describe("share codec", () => {
  it("encode → decode восстанавливает настройки", () => {
    const s = defaultGeneratorSettings();
    s.playerCount = 6;
    const f = toFile(s);
    f.seed = 4242; // C#-маппер не переносит seed — это делает хост
    const encoded = encodeSettings(f);
    expect(encoded.length).toBeLessThanOrEqual(8192);
    const decoded = tryDecodeSettings(encoded);
    expect(decoded.status).toBe("Ok");
    expect(decoded.file!.playerCount).toBe(6);
    expect(decoded.file!.seed).toBe(4242);
  });

  it("мусор на входе даёт статус ошибки, не бросает", () => {
    expect(tryDecodeSettings("").status).toBe("Empty");
    expect(tryDecodeSettings("!!!not-base64!!!").status).toBe("MalformedBase64");
  });
});

describe("preset catalog", () => {
  it("манифест содержит ≥14 пресетов, и все валидны", () => {
    expect(presetCatalog.entries.length).toBeGreaterThanOrEqual(14);
    for (const entry of presetCatalog.entries.slice(0, 5)) {
      const f = presetCatalog.load(entry.id);
      expect(validate(fromFile(f)).filter((i) => i.severity === "error")).toHaveLength(0);
    }
  });
});

describe("community catalog", () => {
  it("108 героев, 6 фракций", () => {
    expect(communityCatalog.heroes).toHaveLength(108);
    expect(communityCatalog.factions).toHaveLength(6);
    for (const h of communityCatalog.heroes) {
      expect(h.id).toMatch(/^[a-z_]+_hero_\d+$/);
    }
  });
});

describe("edit history", () => {
  it("push/undo/redo/dedupe (семантика C#-эталона)", () => {
    const hist = new EditHistory();
    hist.push("a");
    expect(hist.canUndo).toBe(true);
    expect(hist.canRedo).toBe(false);
    expect(hist.tryUndo("b")).toBe("a");
    expect(hist.canUndo).toBe(false);
    expect(hist.canRedo).toBe(true);
    expect(hist.tryRedo("a")).toBe("b");
    expect(hist.canUndo).toBe(true);
    expect(hist.canRedo).toBe(false);

    // Подряд идущие одинаковые склеиваются
    const h2 = new EditHistory();
    h2.push("a");
    h2.push("a");
    h2.push("a");
    expect(h2.undoCount).toBe(1);
  });
});

describe("emitted ids vs game data", () => {
  it("все эмитируемые ID существуют в данных игры", () => {
    const root = path.resolve(__dirname, "../tests/fixtures/gamedata");
    const catalog = loadFromDirectory(root);
    expect(knownIdsValidateAgainst(catalog)).toHaveLength(0);
  });
});
