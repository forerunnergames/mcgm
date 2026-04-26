# Minecraft Game Master Cheatsheet
### Paper 26.1.1 Bot Command Reference

---

## Blocks

Blocks can be placed with `/setblock`, filled with `/fill`, or used in replace commands. 1,166 total blocks available.

### Stone & Variants
- stone, smooth_stone, cobblestone, mossy_cobblestone
- stone_bricks, mossy_stone_bricks, cracked_stone_bricks, chiseled_stone_bricks, infested_stone_bricks
- stone_slab, stone_stairs, stone_brick_slab, stone_brick_stairs, stone_brick_wall
- cobblestone_slab, cobblestone_stairs, cobblestone_wall
- mossy_cobblestone_slab, mossy_cobblestone_stairs, mossy_cobblestone_wall
- mossy_stone_brick_slab, mossy_stone_brick_stairs, mossy_stone_brick_wall
- smooth_stone_slab
- granite, polished_granite, granite_slab, granite_stairs, granite_wall
- diorite, polished_diorite, diorite_slab, diorite_stairs, diorite_wall
- andesite, polished_andesite, andesite_slab, andesite_stairs, andesite_wall
- calcite, tuff, polished_tuff, tuff_bricks, chiseled_tuff, chiseled_tuff_bricks
- tuff_slab, tuff_stairs, tuff_wall, tuff_brick_slab, tuff_brick_stairs, tuff_brick_wall
- polished_tuff_slab, polished_tuff_stairs, polished_tuff_wall
- bricks, brick_slab, brick_stairs, brick_wall
- mud_bricks, mud_brick_slab, mud_brick_stairs, mud_brick_wall
- stone_button, stone_pressure_plate

### Deepslate
- deepslate, cobbled_deepslate, polished_deepslate, deepslate_bricks, deepslate_tiles, chiseled_deepslate
- cobbled_deepslate_slab, cobbled_deepslate_stairs, cobbled_deepslate_wall
- deepslate_brick_slab, deepslate_brick_stairs, deepslate_brick_wall
- deepslate_tile_slab, deepslate_tile_stairs, deepslate_tile_wall
- polished_deepslate_slab, polished_deepslate_stairs, polished_deepslate_wall
- reinforced_deepslate, cracked_deepslate_bricks, cracked_deepslate_tiles

### Wood (per species: oak, birch, spruce, jungle, acacia, dark_oak, mangrove, cherry, pale_oak, bamboo, crimson, warped)
Each wood species has:
- log, wood, stripped_log, stripped_wood (crimson/warped: stem, hyphae)
- planks, slab, stairs, fence, fence_gate
- door, trapdoor, button, pressure_plate
- sign, wall_sign, hanging_sign, wall_hanging_sign
- shelf
- leaves, sapling (not crimson/warped; mangrove has propagule; crimson/warped have fungus, nylium, roots)
- boat, chest_boat (not crimson/warped; bamboo has raft, chest_raft)

Special: bamboo_block, stripped_bamboo_block, bamboo_mosaic, bamboo_mosaic_slab, bamboo_mosaic_stairs

### Ore Blocks
- coal_ore, deepslate_coal_ore
- iron_ore, deepslate_iron_ore, raw_iron_block
- copper_ore, deepslate_copper_ore, raw_copper_block
- gold_ore, deepslate_gold_ore, raw_gold_block, nether_gold_ore
- diamond_ore, deepslate_diamond_ore
- emerald_ore, deepslate_emerald_ore
- lapis_ore, deepslate_lapis_ore
- redstone_ore, deepslate_redstone_ore
- nether_quartz_ore
- ancient_debris

### Mineral Blocks
- coal_block, iron_block, copper_block, gold_block
- diamond_block, emerald_block, lapis_block, redstone_block
- netherite_block, amethyst_block, budding_amethyst
- quartz_block, quartz_bricks, quartz_pillar, chiseled_quartz_block, smooth_quartz

### Dirt, Sand & Gravel
- dirt, coarse_dirt, rooted_dirt, podzol, mycelium, grass_block, dirt_path, farmland
- mud, packed_mud, muddy_mangrove_roots
- sand, red_sand, sandstone, red_sandstone, smooth_sandstone, smooth_red_sandstone
- chiseled_sandstone, chiseled_red_sandstone, cut_sandstone, cut_red_sandstone
- sandstone_slab, sandstone_stairs, sandstone_wall
- red_sandstone_slab, red_sandstone_stairs, red_sandstone_wall
- smooth_sandstone_slab, smooth_sandstone_stairs
- smooth_red_sandstone_slab, smooth_red_sandstone_stairs
- gravel, suspicious_sand, suspicious_gravel, clay

### Glass
- glass, glass_pane, tinted_glass
- {color}_stained_glass, {color}_stained_glass_pane (16 colors)

Colors: white, orange, magenta, light_blue, yellow, lime, pink, gray, light_gray, cyan, purple, blue, brown, green, red, black

### Concrete & Concrete Powder
- {color}_concrete (16 colors)
- {color}_concrete_powder (16 colors)

### Terracotta
- terracotta (plain)
- {color}_terracotta (16 colors)
- {color}_glazed_terracotta (16 colors)

### Wool & Carpet
- {color}_wool (16 colors)
- {color}_carpet (16 colors)

### Coral
Living: brain_coral, bubble_coral, fire_coral, horn_coral, tube_coral
- {type}_coral_block, {type}_coral_fan, {type}_coral_wall_fan
Dead variants: dead_{type}_coral, dead_{type}_coral_block, dead_{type}_coral_fan

### Copper (4 oxidation stages x waxed/unwaxed)
Stages: copper, exposed_copper, weathered_copper, oxidized_copper (+ waxed_ variants)
- copper_block, cut_copper, cut_copper_slab, cut_copper_stairs
- chiseled_copper, copper_grate, copper_bulb, copper_door, copper_trapdoor
- copper_bars, copper_chain, copper_chest, copper_lantern, copper_torch
- copper_golem_statue, lightning_rod

### Nether
- netherrack, basalt, polished_basalt, smooth_basalt
- blackstone, polished_blackstone, chiseled_polished_blackstone, gilded_blackstone
- polished_blackstone_bricks, cracked_polished_blackstone_bricks
- blackstone_slab, blackstone_stairs, blackstone_wall
- polished_blackstone_slab, polished_blackstone_stairs, polished_blackstone_wall
- polished_blackstone_brick_slab, polished_blackstone_brick_stairs, polished_blackstone_brick_wall
- nether_bricks, red_nether_bricks, chiseled_nether_bricks, cracked_nether_bricks
- nether_brick_slab, nether_brick_stairs, nether_brick_wall, nether_brick_fence
- red_nether_brick_slab, red_nether_brick_stairs, red_nether_brick_wall
- soul_sand, soul_soil, magma_block, glowstone, shroomlight
- nether_wart_block, warped_wart_block, crimson_nylium, warped_nylium
- nether_sprouts, crimson_roots, warped_roots, twisting_vines, weeping_vines
- nether_portal, respawn_anchor, crying_obsidian

### End
- end_stone, end_stone_bricks, end_stone_brick_slab, end_stone_brick_stairs, end_stone_brick_wall
- purpur_block, purpur_pillar, purpur_slab, purpur_stairs
- end_rod, chorus_plant, chorus_flower
- end_portal_frame, end_gateway, dragon_egg
- shulker_box, {color}_shulker_box (16 colors)

### Prismarine
- prismarine, prismarine_bricks, dark_prismarine, sea_lantern
- prismarine_slab, prismarine_stairs, prismarine_wall
- prismarine_brick_slab, prismarine_brick_stairs
- dark_prismarine_slab, dark_prismarine_stairs

### Redstone
- redstone_wire, redstone_torch, redstone_block, redstone_lamp
- repeater, comparator, target
- piston, sticky_piston, observer
- dispenser, dropper, hopper
- lever, stone_button, {wood}_button
- stone_pressure_plate, {wood}_pressure_plate, heavy_weighted_pressure_plate, light_weighted_pressure_plate
- rail, powered_rail, detector_rail, activator_rail
- tripwire_hook, trapped_chest, daylight_detector
- note_block, tnt, sculk_sensor, calibrated_sculk_sensor, sculk_shrieker

### Ice & Snow
- ice, packed_ice, blue_ice, frosted_ice
- snow, snow_block, powder_snow

### Decoration & Utility
- torch, wall_torch, soul_torch, soul_wall_torch, lantern, soul_lantern
- campfire, soul_campfire
- bookshelf, chiseled_bookshelf, lectern, enchanting_table
- chest, ender_chest, barrel, decorated_pot
- crafting_table, furnace, blast_furnace, smoker, stonecutter, grindstone, smithing_table, loom, cartography_table, fletching_table, crafter
- anvil, chipped_anvil, damaged_anvil
- brewing_stand, cauldron, conduit, beacon, bell
- bed ({color}_bed, 16 colors)
- banner ({color}_banner, 16 colors)
- candle, {color}_candle (16 colors + plain)
- flower_pot, armor_stand, item_frame, glow_item_frame, painting
- ladder, scaffolding, chain, iron_chain, iron_bars
- cobweb, hay_block, bone_block, dried_kelp_block
- sponge, wet_sponge, slime_block, honey_block, honeycomb_block
- jack_o_lantern, carved_pumpkin, pumpkin, melon
- jukebox, spawner, trial_spawner, vault, heavy_core
- creaking_heart

### Flowers & Plants
- dandelion, poppy, blue_orchid, allium, azure_bluet, oxeye_daisy, cornflower, lily_of_the_valley
- red_tulip, orange_tulip, white_tulip, pink_tulip
- wither_rose, torchflower, open_eyeblossom, closed_eyeblossom, wildflowers, cactus_flower
- sunflower, lilac, rose_bush, peony, pitcher_plant
- short_grass, tall_grass, fern, large_fern, short_dry_grass, tall_dry_grass
- dead_bush, bush, firefly_bush, sweet_berry_bush
- lily_pad, spore_blossom, pink_petals, leaf_litter
- vine, glow_lichen, hanging_roots, moss_block, moss_carpet
- pale_moss_block, pale_moss_carpet, pale_hanging_moss
- big_dripleaf, small_dripleaf, pointed_dripstone, dripstone_block
- kelp, seagrass, tall_seagrass, sea_pickle
- sugar_cane, bamboo, cactus, cocoa
- brown_mushroom, red_mushroom, mushroom_stem, brown_mushroom_block, red_mushroom_block

### Sculk
- sculk, sculk_catalyst, sculk_sensor, calibrated_sculk_sensor, sculk_shrieker, sculk_vein

### Resin
- resin_block, resin_bricks, resin_clump, chiseled_resin_bricks
- resin_brick_slab, resin_brick_stairs, resin_brick_wall

### Froglight
- ochre_froglight, pearlescent_froglight, verdant_froglight

### Amethyst
- amethyst_block, budding_amethyst
- small_amethyst_bud, medium_amethyst_bud, large_amethyst_bud, amethyst_cluster

### Special / Technical
- bedrock, barrier, light, structure_block, structure_void, jigsaw
- command_block, chain_command_block, repeating_command_block
- air, cave_air, void_air, water, lava, fire, soul_fire, bubble_column
- obsidian, crying_obsidian
- dragon_head, creeper_head, skeleton_skull, wither_skeleton_skull, zombie_head, piglin_head, player_head
- sniffer_egg, turtle_egg, frogspawn
- dried_ghast

---

## Structures

Can be placed with `/place structure` or located with `/locate structure`. 34 total.

### Overworld
- ancient_city
- buried_treasure
- desert_pyramid
- igloo
- jungle_pyramid
- mansion (woodland mansion)
- mineshaft, mineshaft_mesa
- monument (ocean monument)
- ocean_ruin_cold, ocean_ruin_warm
- pillager_outpost
- ruined_portal, ruined_portal_desert, ruined_portal_jungle, ruined_portal_mountain, ruined_portal_ocean, ruined_portal_swamp
- shipwreck, shipwreck_beached
- stronghold
- swamp_hut (witch hut)
- trail_ruins
- trial_chambers
- village_desert, village_plains, village_savanna, village_snowy, village_taiga

### Nether
- bastion_remnant
- fortress (nether fortress)
- nether_fossil
- ruined_portal_nether

### End
- end_city

---

## Biomes

Can teleport to with `/locate biome`. 65 total.

### Overworld - Temperate
- plains, sunflower_plains, meadow, flower_forest
- forest, birch_forest, old_growth_birch_forest, dark_forest
- cherry_grove, pale_garden
- taiga, old_growth_pine_taiga, old_growth_spruce_taiga, snowy_taiga
- swamp, mangrove_swamp

### Overworld - Hot
- desert
- savanna, savanna_plateau, windswept_savanna
- jungle, sparse_jungle, bamboo_jungle
- badlands, eroded_badlands, wooded_badlands

### Overworld - Cold & Snowy
- snowy_plains, ice_spikes
- snowy_slopes, frozen_peaks, jagged_peaks, stony_peaks
- grove
- windswept_hills, windswept_gravelly_hills, windswept_forest
- snowy_beach, snowy_taiga, frozen_river

### Overworld - Ocean
- ocean, deep_ocean
- warm_ocean
- lukewarm_ocean, deep_lukewarm_ocean
- cold_ocean, deep_cold_ocean
- frozen_ocean, deep_frozen_ocean
- beach, stony_shore
- river, mushroom_fields

### Overworld - Underground
- lush_caves
- dripstone_caves
- deep_dark

### Nether
- nether_wastes
- crimson_forest
- warped_forest
- soul_sand_valley
- basalt_deltas

### End
- the_end
- end_highlands
- end_midlands
- end_barrens
- small_end_islands

### Special
- the_void

---

## Mobs

Can be summoned with `/summon`. Living entities from the entity list.

### Passive
- allay
- armadillo
- axolotl
- bat
- camel
- camel_husk
- cat
- chicken
- cod
- cow
- dolphin
- donkey
- fox
- frog
- glow_squid
- goat
- happy_ghast
- horse
- llama
- mooshroom
- mule
- nautilus
- ocelot
- panda
- parrot
- pig
- pufferfish
- rabbit
- salmon
- sheep
- skeleton_horse
- sniffer
- squid
- strider
- tadpole
- trader_llama
- tropical_fish
- turtle
- villager
- wandering_trader
- zombie_horse

### Neutral
- bee
- copper_golem
- enderman
- goat
- iron_golem
- llama
- panda
- piglin
- polar_bear
- spider (neutral in daylight)
- wolf
- zombified_piglin

### Hostile
- blaze
- bogged
- breeze
- cave_spider
- creaking
- creeper
- drowned
- elder_guardian
- endermite
- evoker
- ghast
- guardian
- hoglin
- husk
- illusioner
- magma_cube
- parched
- phantom
- piglin_brute
- pillager
- ravager
- shulker
- silverfish
- skeleton
- slime
- spider
- stray
- vex
- vindicator
- warden
- witch
- wither_skeleton
- zoglin
- zombie
- zombie_nautilus
- zombie_villager

### Bosses
- ender_dragon
- wither

### Utility
- snow_golem
- iron_golem
- armor_stand

---

## Items

Can be given with `/give`. 1,505 total. Highlights below by category.

### Weapons
- wooden_sword, stone_sword, iron_sword, copper_sword, golden_sword, diamond_sword, netherite_sword
- wooden_spear, stone_spear, iron_spear, copper_spear, golden_spear, diamond_spear, netherite_spear
- bow, crossbow, trident, mace
- arrow, spectral_arrow, tipped_arrow
- wind_charge

### Armor
- leather_helmet, leather_chestplate, leather_leggings, leather_boots
- chainmail_helmet, chainmail_chestplate, chainmail_leggings, chainmail_boots
- iron_helmet, iron_chestplate, iron_leggings, iron_boots
- copper_helmet, copper_chestplate, copper_leggings, copper_boots
- golden_helmet, golden_chestplate, golden_leggings, golden_boots
- diamond_helmet, diamond_chestplate, diamond_leggings, diamond_boots
- netherite_helmet, netherite_chestplate, netherite_leggings, netherite_boots
- turtle_helmet, elytra, shield, wolf_armor
- leather_horse_armor, iron_horse_armor, copper_horse_armor, golden_horse_armor, diamond_horse_armor, netherite_horse_armor
- iron_nautilus_armor, copper_nautilus_armor, golden_nautilus_armor, diamond_nautilus_armor, netherite_nautilus_armor
- {color}_harness (16 colors)

### Tools
- wooden_pickaxe, stone_pickaxe, iron_pickaxe, copper_pickaxe, golden_pickaxe, diamond_pickaxe, netherite_pickaxe
- wooden_axe, stone_axe, iron_axe, copper_axe, golden_axe, diamond_axe, netherite_axe
- wooden_shovel, stone_shovel, iron_shovel, copper_shovel, golden_shovel, diamond_shovel, netherite_shovel
- wooden_hoe, stone_hoe, iron_hoe, copper_hoe, golden_hoe, diamond_hoe, netherite_hoe
- fishing_rod, flint_and_steel, shears, brush, spyglass
- bucket, water_bucket, lava_bucket, powder_snow_bucket, milk_bucket
- axolotl_bucket, cod_bucket, salmon_bucket, pufferfish_bucket, tropical_fish_bucket, tadpole_bucket
- compass, recovery_compass, clock, lead, name_tag, saddle
- carrot_on_a_stick, warped_fungus_on_a_stick

### Food
- apple, golden_apple, enchanted_golden_apple
- bread, cookie, cake, pumpkin_pie
- beef, cooked_beef, porkchop, cooked_porkchop, mutton, cooked_mutton
- chicken, cooked_chicken, rabbit, cooked_rabbit, rabbit_stew
- cod, cooked_cod, salmon, cooked_salmon, tropical_fish, pufferfish
- melon_slice, glistering_melon_slice, sweet_berries, glow_berries
- carrot, golden_carrot, potato, baked_potato, poisonous_potato, beetroot, beetroot_soup
- mushroom_stew, suspicious_stew
- dried_kelp, honey_bottle, chorus_fruit, rotten_flesh, spider_eye
- ominous_bottle

### Potions & Brewing
- potion, splash_potion, lingering_potion
- glass_bottle, dragon_breath, experience_bottle
- blaze_powder, blaze_rod, breeze_rod
- ghast_tear, magma_cream, fermented_spider_eye
- nether_wart, glowstone_dust, redstone, gunpowder
- sugar, rabbit_foot, phantom_membrane

### Valuables & Materials
- diamond, emerald, gold_ingot, gold_nugget, iron_ingot, iron_nugget, copper_ingot, copper_nugget
- netherite_ingot, netherite_scrap, amethyst_shard
- lapis_lazuli, quartz, coal, charcoal
- raw_iron, raw_gold, raw_copper
- nether_star, heart_of_the_sea, echo_shard, disc_fragment_5
- prismarine_shard, prismarine_crystals, nautilus_shell, shulker_shell
- leather, feather, string, slime_ball, bone, bone_meal, ink_sac, glow_ink_sac
- ender_pearl, ender_eye, end_crystal
- totem_of_undying

### Redstone Items
- redstone, redstone_torch, redstone_block, redstone_lamp
- repeater, comparator, observer, target
- piston, sticky_piston, dispenser, dropper, hopper
- lever, tripwire_hook, trapped_chest, daylight_detector
- note_block, tnt, rail, powered_rail, detector_rail, activator_rail

### Minecarts
- minecart, chest_minecart, furnace_minecart, tnt_minecart, hopper_minecart, command_block_minecart

### Music Discs
- music_disc_11, music_disc_13, music_disc_5, music_disc_blocks, music_disc_cat
- music_disc_chirp, music_disc_creator, music_disc_creator_music_box, music_disc_far
- music_disc_lava_chicken, music_disc_mall, music_disc_mellohi, music_disc_otherside
- music_disc_pigstep, music_disc_precipice, music_disc_relic, music_disc_stal
- music_disc_strad, music_disc_tears, music_disc_wait, music_disc_ward

### Smithing Templates & Pottery Sherds
- netherite_upgrade_smithing_template
- Armor trims: bolt, coast, dune, eye, flow, host, raiser, rib, sentry, shaper, silence, snout, spire, tide, vex, ward, wayfinder, wild
- Pottery sherds: angler, archer, arms_up, blade, brewer, burn, danger, explorer, flow, friend, guster, heart, heartbreak, howl, miner, mourner, plenty, prize, scrape, sheaf, shelter, skull, snort

### Banner Patterns
- creeper_banner_pattern, skull_banner_pattern, flower_banner_pattern, mojang_banner_pattern
- globe_banner_pattern, piglin_banner_pattern, flow_banner_pattern, guster_banner_pattern
- bordure_indented_banner_pattern, field_masoned_banner_pattern

### Dyes (16 colors)
- white_dye, orange_dye, magenta_dye, light_blue_dye, yellow_dye, lime_dye, pink_dye, gray_dye
- light_gray_dye, cyan_dye, purple_dye, blue_dye, brown_dye, green_dye, red_dye, black_dye

### Eggs (colored)
- egg, blue_egg, brown_egg

### Bundles (17 variants)
- bundle, {color}_bundle (16 colors)

### Spawn Eggs
- {mob}_spawn_egg for every mob type (allay, armadillo, axolotl, bat, bee, blaze, bogged, breeze, camel, camel_husk, cat, cave_spider, chicken, cod, copper_golem, cow, creaking, creeper, dolphin, donkey, drowned, elder_guardian, ender_dragon, enderman, endermite, evoker, fox, frog, ghast, glow_squid, goat, guardian, happy_ghast, hoglin, horse, husk, iron_golem, llama, magma_cube, mooshroom, mule, nautilus, ocelot, panda, parched, parrot, phantom, pig, piglin, piglin_brute, pillager, polar_bear, pufferfish, rabbit, ravager, salmon, sheep, shulker, silverfish, skeleton, skeleton_horse, slime, sniffer, snow_golem, spider, squid, stray, strider, tadpole, trader_llama, tropical_fish, turtle, vex, villager, vindicator, wandering_trader, warden, witch, wither, wither_skeleton, wolf, zoglin, zombie, zombie_horse, zombie_nautilus, zombie_villager, zombified_piglin)

---

## Effects

Applied with `/effect give <player> minecraft:<effect> <seconds> <amplifier>`. 40 total.

### Positive
- Absorption
- ConduitPower
- DolphinsGrace
- FireResistance
- Haste
- HealthBoost
- HeroOfTheVillage
- InstantHealth
- Invisibility
- JumpBoost
- Luck
- NightVision
- Regeneration
- Resistance
- Saturation
- SlowFalling
- Speed
- Strength
- WaterBreathing
- BreathOfTheNautilus

### Negative
- BadLuck
- BadOmen
- Blindness
- Darkness
- Hunger
- Infested
- InstantDamage
- Levitation
- MiningFatigue
- Nausea
- Oozing
- Poison
- Slowness
- Weakness
- Weaving
- WindCharged
- Wither

### Neutral / Situational
- Glowing
- RaidOmen
- TrialOmen

---

## Enchantments

43 total. Applied via enchanted books or `/enchant`.

### Armor (any piece)
- protection (max 4)
- fire_protection (max 4)
- blast_protection (max 4)
- projectile_protection (max 4)
- thorns (max 3)
- unbreaking (max 3)
- mending (max 1)
- binding_curse (max 1)
- vanishing_curse (max 1)

### Helmet Only
- respiration (max 3)
- aqua_affinity (max 1)

### Boots Only
- feather_falling (max 4)
- depth_strider (max 3)
- frost_walker (max 2)
- soul_speed (max 3)

### Leggings Only
- swift_sneak (max 3)

### Weapon (Sword)
- sharpness (max 5)
- smite (max 5)
- bane_of_arthropods (max 5)
- knockback (max 2)
- fire_aspect (max 2)
- looting (max 3)
- sweeping_edge (max 3)

### Weapon (Mace)
- density (max 5)
- breach (max 4)
- wind_burst (max 3)

### Spear
- lunge

### Tool (Pickaxe, Axe, Shovel, Hoe)
- efficiency (max 5)
- silk_touch (max 1)
- fortune (max 3)
- unbreaking (max 3)
- mending (max 1)

### Bow
- power (max 5)
- punch (max 2)
- flame (max 1)
- infinity (max 1)

### Crossbow
- multishot (max 1)
- piercing (max 4)
- quick_charge (max 3)

### Trident
- loyalty (max 3)
- riptide (max 3)
- channeling (max 1)
- impaling (max 5)

### Fishing Rod
- luck_of_the_sea (max 3)
- lure (max 3)

---

## Weather & Time

### Weather Commands
- `weather clear`
- `weather rain`
- `weather thunder`
- `weather clear <duration_ticks>`

### Time Commands
- `time set day` (1000)
- `time set noon` (6000)
- `time set night` (13000)
- `time set midnight` (18000)
- `time set sunrise` (23000)
- `time set <ticks>`
- `time add <ticks>`

### Gamemode
- `gamemode survival <player>`
- `gamemode creative <player>`
- `gamemode adventure <player>`
- `gamemode spectator <player>`

### Difficulty
- `difficulty peaceful`
- `difficulty easy`
- `difficulty normal`
- `difficulty hard`

---

## Block Groups (shorthand for replace commands)

Built-in group names resolved by the bot's `replace_blocks_in_area` tool:

| Group | Matches |
|-------|---------|
| `wood` | #planks, #logs, #stairs, #slabs, #fences, #doors |
| `trees` | #logs, #leaves |
| `stone` | #base_stone_overworld |
| `ores` | #gold_ores, #iron_ores, #diamond_ores, #coal_ores, #copper_ores, #emerald_ores, #lapis_ores, #redstone_ores |
| `flowers` | #flowers, #tall_flowers |
| `ice` | #ice |
| `sand` | #sand |
| `dirt` | #dirt |
| `wool` | #wool |
| `water` | minecraft:water |
| `lava` | minecraft:lava |

---

## Tree Types (can be planted via `/place feature`)

55 tree-related features. Common ones:

### Standard Trees
- oak, fancy_oak, birch, birch_tall, spruce, pine
- jungle_tree, mega_jungle_tree, jungle_bush
- acacia, dark_oak, cherry, pale_oak, mangrove, tall_mangrove
- swamp_oak, azalea_tree, rooted_azalea_tree

### With Bees
- oak_bees_002, oak_bees_005
- birch_bees_002, birch_bees_005, birch_bees_0002
- fancy_oak_bees, fancy_oak_bees_002, fancy_oak_bees_005
- cherry_bees_005
- super_birch_bees, super_birch_bees_0002

### Mega / Tall
- birch_tall, mega_jungle_tree, mega_pine, mega_spruce
- tall_mangrove

### With Leaf Litter
- oak_leaf_litter, birch_leaf_litter, dark_oak_leaf_litter
- fancy_oak_leaf_litter
- oak_bees_0002_leaf_litter, birch_bees_0002_leaf_litter
- fancy_oak_bees_0002_leaf_litter

### Fallen Trees
- fallen_oak_tree, fallen_birch_tree, fallen_spruce_tree
- fallen_jungle_tree, fallen_super_birch_tree

### Nether "Trees"
- crimson_fungus, crimson_fungus_planted
- warped_fungus, warped_fungus_planted
- huge_brown_mushroom, huge_red_mushroom

### Pale Garden
- pale_oak, pale_oak_bonemeal, pale_oak_creaking

### Tree Clusters (place groups of trees)
- trees_birch, trees_jungle, trees_plains, trees_savanna, trees_snowy, trees_taiga
- trees_badlands, trees_flower_forest, trees_grove, trees_water
- trees_old_growth_pine_taiga, trees_old_growth_spruce_taiga
- trees_sparse_jungle, trees_windswept_hills
- trees_birch_and_oak_leaf_litter

### Other Vegetation Features
- flower_cherry, flower_default, flower_flower_forest, flower_meadow, flower_plain, flower_swamp, flower_pale_garden
- bamboo_vegetation, mangrove_vegetation
- amethyst_geode, desert_well, ice_spike, basalt_pillar

---

## Equip Presets

The bot has built-in gear presets for fast equipping:

| Tier | Includes |
|------|----------|
| `netherite` | Full enchanted netherite armor + sword + pickaxe + axe + shovel + bow + shield + totem + elytra + trident + fireworks |
| `diamond` | Full enchanted diamond armor + sword + pickaxe + shield |
| `iron` | Full iron armor + sword + pickaxe + shield |
| `leather` | Full enchanted leather armor + wooden sword + wooden pickaxe + shield |

Individual equip slots: helmet, chestplate, leggings, boots, sword, pickaxe, axe, shovel, bow, shield, totem, elytra, fireworks, trident

---

## Locate Targets (natural language shortcuts)

The bot resolves these natural language names to locate commands:

| Say | Finds |
|-----|-------|
| village | village_plains |
| desert village | village_desert |
| ocean monument / guardian temple | monument |
| fortress / nether fortress | fortress (in nether) |
| bastion | bastion_remnant (in nether) |
| end city | end_city (in end) |
| mineshaft | mineshaft |
| stronghold | stronghold |
| trial chambers | trial_chambers |
| mansion / woodland mansion | mansion |
| witch hut | swamp_hut |
| pyramid / desert pyramid | desert_pyramid |
| jungle temple | jungle_pyramid |
| igloo | igloo |
| shipwreck | shipwreck |
| ocean ruin | ocean_ruin_warm |
| ancient city | ancient_city |
| pillager outpost | pillager_outpost |
| trail ruins | trail_ruins |
| deep dark / skulk | biome: deep_dark |
| lush cave / lush caves | biome: lush_caves |
| mushroom | biome: mushroom_fields |
| cherry grove / cherry blossom | biome: cherry_grove |
| desert | biome: desert |
| jungle | biome: jungle |
| swamp | biome: swamp |
| dark forest | biome: dark_forest |
| flower forest | biome: flower_forest |
| ice spikes | biome: ice_spikes |
| badlands | biome: badlands |
| meadow | biome: meadow |
| warm ocean | biome: warm_ocean |
| soul sand valley | biome: soul_sand_valley (in nether) |
| crimson forest | biome: crimson_forest (in nether) |
| warped forest | biome: warped_forest (in nether) |
| basalt deltas | biome: basalt_deltas (in nether) |

---

## Example Commands

Natural language examples you can say to the bot, organized by what you want to do.

### Equipping & Gear
- "Give me full netherite gear"
- "Equip Aaron with diamond armor and a sword"
- "Give me iron armor"
- "Give me leather gear"
- "Give me just a netherite pickaxe and elytra with fireworks"
- "Give Aaron 64 golden apples"
- "Give me a stack of ender pearls"
- "Give me a diamond sword with sharpness 5 and fire aspect 2"

### Building & Blocks
- "Build a 20x20 platform of oak planks under me"
- "Fill this area with glass"
- "Replace all stone with diamond blocks in a 10 block radius"
- "Replace all dirt with grass blocks around me"
- "Clear all water in a 50 block radius"
- "Remove all trees within 30 blocks"
- "Replace all wool with concrete nearby"
- "Fill the area from here to there with air" (clear an area)
- "Build walls of stone bricks around me, 5 high"
- "Place a layer of snow on everything"
- "Turn all the flowers into lava"

### Teleporting & Exploration
- "Take me to a village"
- "Find the nearest stronghold"
- "Teleport me to a cherry grove"
- "Find a nether fortress"
- "Take me to the deep dark"
- "Locate an end city"
- "Find a mushroom island"
- "Teleport me to lush caves"
- "Take me to the basalt deltas"

### Spawning & Mobs
- "Summon a wither"
- "Spawn 100 chickens"
- "Summon an ender dragon"
- "Spawn a bunch of zombies around Aaron"
- "Summon an iron golem"
- "Spawn some wolves"
- "Summon a warden"
- "Fill the area with creepers"

### Effects
- "Give me night vision"
- "Make me invisible"
- "Give me speed 5 for 10 minutes"
- "Apply strength 2 to Aaron"
- "Give me slow falling"
- "Poison Aaron"
- "Give me resistance and regeneration"
- "Make Aaron glow"
- "Give me haste 3"
- "Remove all effects from me"

### Planting & Nature
- "Plant some oak trees around here"
- "Plant 20 cherry trees in a 50 block radius"
- "Plant a mega jungle tree"
- "Grow dark oak trees everywhere"
- "Plant birch trees with bees"
- "Create a forest of pale oak trees"

### Structures
- "Place a desert pyramid here"
- "Place a village here"
- "Put a nether fortress at my location"

### Weather & Time
- "Make it night"
- "Set time to noon"
- "Make it rain"
- "Start a thunderstorm"
- "Clear the weather"
- "Set difficulty to hard"
- "Put me in creative mode"

### Trolling & Chaos
- "Replace the ground under Aaron with lava"
- "Surround Aaron with bedrock"
- "Spawn 50 withers"
- "Replace all the blocks around Aaron with TNT and light it"
- "Fill Aaron's area with cobwebs"
- "Give Aaron blindness and slowness"
- "Remove the floor beneath Aaron"
- "Replace all air around Aaron with water"
- "Spawn a warden on top of Aaron"
- "Take away all of Aaron's effects and give him hunger and weakness"

### Scanning & Information
- "Scan the area and tell me what's here"
- "What blocks are around me?"
- "Where did I die?"

---

## Quick Reference: Color Names

Used for wool, concrete, terracotta, glass, beds, banners, candles, bundles, harnesses, dyes, shulker boxes, carpet:

`white` `orange` `magenta` `light_blue` `yellow` `lime` `pink` `gray` `light_gray` `cyan` `purple` `blue` `brown` `green` `red` `black`

---

## Quick Reference: Wood Species

`oak` `birch` `spruce` `jungle` `acacia` `dark_oak` `mangrove` `cherry` `pale_oak` `bamboo` `crimson` `warped`

---

## Quick Reference: Copper Oxidation States

`copper` > `exposed_copper` > `weathered_copper` > `oxidized_copper`

Each can be prefixed with `waxed_` to prevent further oxidation.
