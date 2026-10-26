import { describe, expect, it } from "vitest";
import { applySettingsPatch } from "../src/ai/patching";
import { settingsFieldCatalog, settingsCatalogJson } from "../src/ai/settingsSchema";
import { buildSystemPrompt } from "../src/ai/systemPrompt";
import { defaultSettingsFile } from "../src/generator/settingsFile";
import { parseToolArguments } from "../src/ai/openaiClient";

describe("ai patching", () => {
  it("применяет известные поля и валидирует типы", () => {
    const file = defaultSettingsFile();
    const { file: next, result } = applySettingsPatch(file, {
      playerCount: 6,
      topology: "HubAndSpoke",
      cityHold: true,
      heroBans: ["human_hero_1", "necro_hero_5"],
    });
    expect(result.applied).toEqual(["playerCount", "topology", "cityHold", "heroBans"]);
    expect(result.ignored).toEqual([]);
    expect(next.playerCount).toBe(6);
    expect(next.topology).toBe("HubAndSpoke");
    expect(next.cityHold).toBe(true);
    expect(next.heroBans).toEqual(["human_hero_1", "necro_hero_5"]);
    // исходник не мутирован
    expect(file.playerCount).toBe(2);
  });

  it("игнорирует неизвестные ключи и неправильные типы", () => {
    const { result } = applySettingsPatch(defaultSettingsFile(), {
      totallyUnknownField: 1,
      playerCount: "шесть",
      mapSize: true,
      heroBans: "human_hero_1",
    });
    expect(result.applied).toEqual([]);
    expect(result.ignored).toEqual(["totallyUnknownField", "playerCount", "mapSize", "heroBans"]);
  });

  it("принимает null для nullable-полей (seed)", () => {
    const file = { ...defaultSettingsFile(), seed: 123 };
    const { file: next, result } = applySettingsPatch(file, { seed: null });
    expect(result.applied).toEqual(["seed"]);
    expect(next.seed).toBeNull();
  });

  it("не-объектный патч — пустой результат без исключений", () => {
    for (const bad of [null, "x", 42, [1, 2]]) {
      const { result } = applySettingsPatch(defaultSettingsFile(), bad);
      expect(result.applied).toEqual([]);
    }
  });
});

describe("ai schema & prompt", () => {
  it("каталог покрывает все поля SettingsFile", () => {
    const catalog = settingsFieldCatalog();
    const keys = Object.keys(defaultSettingsFile());
    for (const key of keys) {
      expect(catalog[key], `нет описания для ${key}`).toBeDefined();
    }
    expect(catalog.playerCount.range).toContain("2..8");
    expect(catalog.topology.range).toContain("Balanced");
  });

  it("систем-промпт содержит каталог и оба инструмента", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("update_settings");
    expect(prompt).toContain("generate_map");
    expect(prompt).toContain("playerCount");
    expect(settingsCatalogJson()).toContain("victoryCondition");
  });
});

describe("tool arguments", () => {
  it("парсит валидный JSON и не падает на обрезанном", () => {
    expect(parseToolArguments({ id: "1", name: "update_settings", arguments: '{"patch":{"playerCount":4}}' })).toEqual({
      patch: { playerCount: 4 },
    });
    expect(parseToolArguments({ id: "2", name: "generate_map", arguments: '{"broken"' })).toEqual({});
    expect(parseToolArguments({ id: "3", name: "x", arguments: '"строка-не-объект"' })).toEqual({});
  });
});
