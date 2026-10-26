/** ID, на которые генератор ссылается строковыми литералами. Единственный источник имён. */

export const KnownIdsZoneLayouts = {
  // Генератор строит их inline (BuildZoneLayouts); в shipped GameData их нет.
  Spawn: "zone_layout_spawns",
  Sides: "zone_layout_sides",
  TreasureZone: "zone_layout_treasure_zone",
  Center: "zone_layout_center",
} as const;

export const KnownIdsGeneralResourcePools = {
  StartZonePoor: "content_pool_general_resources_start_zone_poor",
  StartZoneMedium: "content_pool_general_resources_start_zone_medium",
  StartZoneRich: "content_pool_general_resources_start_zone_rich",
} as const;

export const generalResourcePoolsAll = (): string[] => [
  KnownIdsGeneralResourcePools.StartZonePoor,
  KnownIdsGeneralResourcePools.StartZoneMedium,
  KnownIdsGeneralResourcePools.StartZoneRich,
];

export const KnownIdsContentLists = {
  BuildingGuardedResourceBanksTier1: "basic_content_list_building_guarded_resource_banks_tier_1",
  BuildingGuardedResourceBanksTier2: "basic_content_list_building_guarded_resource_banks_tier_2",
  BuildingGuardedResourceBanksTier3: "basic_content_list_building_guarded_resource_banks_tier_3",
  BuildingGuardedUnitsBanksNoBiome:
    "basic_content_list_building_guarded_units_banks_no_biome_restriction",
  BuildingGuardedUnitsBanksOnlyBiome:
    "basic_content_list_building_guarded_units_banks_only_biome_restriction",
  BuildingHeroBuffTier1: "basic_content_list_building_hero_buff_tier_1",
  BuildingHeroStatsAndSkillsTier1: "basic_content_list_building_hero_stats_and_skills_tier_1",
  BuildingHeroStatsAndSkillsTier2: "basic_content_list_building_hero_stats_and_skills_tier_2",
  BuildingHeroStatsAndSkillsTier3: "basic_content_list_building_hero_stats_and_skills_tier_3",
  BuildingMagicTier1: "basic_content_list_building_magic_tier_1",
  BuildingMagicTier2: "basic_content_list_building_magic_tier_2",
  BuildingRandomHires: "basic_content_list_building_random_hires",
  PickupMythicScrollBox: "basic_content_list_pickup_mythic_scroll_box",
  PickupRandomItems: "basic_content_list_pickup_random_items",
  RareMinesByBiome: "basic_content_list_rare_mines_by_biome",
  RareMines: "basic_content_list_rare_mines",
  VisionBuildingsTier1: "basic_content_list_vision_buildings_tier_1",
  BuildingEpicGuardedResourceBanks: "content_list_building_epic_guarded_resource_banks",
  BuildingRandomHiresHighTier: "content_list_building_random_hires_high_tier",
  BuildingRandomHiresLowTier: "content_list_building_random_hires_low_tier",
  BuildingUncommonHeroBanks: "content_list_building_uncommon_hero_banks",
  BuildingUtopia: "content_list_building_utopia",
  PickupPandoraBoxArmyHighTier: "content_list_pickup_pandora_box_army_high_tier",
  PickupPandoraBoxArmyLowTier: "content_list_pickup_pandora_box_army_low_tier",
} as const;

export const contentListsAll = (): string[] => Object.values(KnownIdsContentLists);
