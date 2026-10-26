/**
 * Метаданные фракций Olden Era + шаблон SID героя.
 * displayName — канонический ключ (по нему строится SID), ru — подпись для UI.
 */
// TODO: verify wording against in-game Russian localization
export interface FactionEntry {
  displayName: string;
  ru: string;
  sidPrefix: string;
  mightClass: string;
  magicClass: string;
}

export const FACTIONS: FactionEntry[] = [
  { displayName: "Temple", ru: "Храм", sidPrefix: "human", mightClass: "Knight", magicClass: "Cleric" },
  { displayName: "Necropolis", ru: "Некрополис", sidPrefix: "necro", mightClass: "Death Knight", magicClass: "Necromancer" },
  { displayName: "Grove", ru: "Роща", sidPrefix: "nature", mightClass: "Warden", magicClass: "Druid" },
  { displayName: "Hive", ru: "Улей", sidPrefix: "demon", mightClass: "Enforcer", magicClass: "Herald" },
  { displayName: "Schism", ru: "Раскол", sidPrefix: "unfrozen", mightClass: "Oathkeeper", magicClass: "Riftspeaker" },
  { displayName: "Dungeon", ru: "Подземелье", sidPrefix: "dungeon", mightClass: "Overlord", magicClass: "Warlock" },
];

export const HEROES_PER_FACTION = 18;
export const MIGHT_HERO_LAST_INDEX = 9;

export function findFaction(displayName: string): FactionEntry | undefined {
  const needle = displayName.toLowerCase();
  return FACTIONS.find((f) => f.displayName.toLowerCase() === needle);
}

export function buildHeroSid(factionDisplayName: string, heroIndex: number): string {
  const faction = findFaction(factionDisplayName);
  if (!faction) {
    throw new Error(
      `Неизвестная фракция '${factionDisplayName}'. Ожидалась одна из: ${FACTIONS.map((f) => f.displayName).join(", ")}`,
    );
  }
  if (heroIndex < 1 || heroIndex > HEROES_PER_FACTION) {
    throw new Error(`Индекс героя должен быть от 1 до ${HEROES_PER_FACTION}`);
  }
  return `${faction.sidPrefix}_hero_${heroIndex}`;
}

export function isMightHero(heroIndex: number): boolean {
  return heroIndex >= 1 && heroIndex <= MIGHT_HERO_LAST_INDEX;
}

export function isMagicHero(heroIndex: number): boolean {
  return heroIndex > MIGHT_HERO_LAST_INDEX && heroIndex <= HEROES_PER_FACTION;
}
