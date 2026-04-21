// High-level Minecraft tools that handle all the complexity internally.
// Claude just picks the tool and provides simple parameters — the code handles
// chunk loading, tiling, block tags, enchantment syntax, equipment slots, etc.

const fs = require('fs');
const path = require('path');
const bisect = require('./bisect');

// Load verified Minecraft reference data
const REF_FILE = path.join(__dirname, 'minecraft-reference.json');
const REF = JSON.parse(fs.readFileSync(REF_FILE, 'utf8'));
console.log(`[tools] loaded minecraft reference: ${Object.keys(REF.structures.overworld).length} structures, ${Object.keys(REF.tree_features).length} tree types, ${Object.keys(REF.locate_targets).length} locate targets`);

// ============================================================================
// EQUIP PLAYER — full gear set, auto-equipped to correct slots
// ============================================================================

const ENCHANTMENT_PRESETS = {
  netherite: {
    helmet: 'minecraft:netherite_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:respiration":3,"minecraft:aqua_affinity":1,"minecraft:thorns":3}]',
    chestplate: 'minecraft:netherite_chestplate[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    leggings: 'minecraft:netherite_leggings[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3,"minecraft:swift_sneak":3}]',
    boots: 'minecraft:netherite_boots[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3,"minecraft:feather_falling":4,"minecraft:depth_strider":3,"minecraft:soul_speed":3}]',
    sword: 'minecraft:netherite_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:looting":3,"minecraft:fire_aspect":2,"minecraft:knockback":2,"minecraft:sweeping_edge":3}]',
    pickaxe: 'minecraft:netherite_pickaxe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:fortune":3}]',
    axe: 'minecraft:netherite_axe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:sharpness":5}]',
    shovel: 'minecraft:netherite_shovel[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:silk_touch":1}]',
    bow: 'minecraft:bow[minecraft:enchantments={"minecraft:power":5,"minecraft:punch":2,"minecraft:flame":1,"minecraft:infinity":1,"minecraft:unbreaking":3}]',
    shield: 'minecraft:shield[minecraft:enchantments={"minecraft:unbreaking":3,"minecraft:mending":1}]',
    totem: 'minecraft:totem_of_undying',
    elytra: 'minecraft:elytra[minecraft:enchantments={"minecraft:unbreaking":3,"minecraft:mending":1}]',
    fireworks: 'minecraft:firework_rocket 64',
    trident: 'minecraft:trident[minecraft:enchantments={"minecraft:loyalty":3,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:channeling":1}]',
  },
  diamond: {
    helmet: 'minecraft:diamond_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    chestplate: 'minecraft:diamond_chestplate[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    leggings: 'minecraft:diamond_leggings[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    boots: 'minecraft:diamond_boots[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:feather_falling":4}]',
    sword: 'minecraft:diamond_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:unbreaking":3,"minecraft:looting":3}]',
    pickaxe: 'minecraft:diamond_pickaxe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:fortune":3}]',
    shield: 'minecraft:shield',
  },
  iron: {
    helmet: 'minecraft:iron_helmet', chestplate: 'minecraft:iron_chestplate',
    leggings: 'minecraft:iron_leggings', boots: 'minecraft:iron_boots',
    sword: 'minecraft:iron_sword', pickaxe: 'minecraft:iron_pickaxe', shield: 'minecraft:shield',
  },
};

// Maps item categories to equipment slots
const SLOT_MAP = {
  helmet: 'armor.head', chestplate: 'armor.chest', elytra: 'armor.chest',
  leggings: 'armor.legs', boots: 'armor.feet',
  sword: 'weapon.mainhand', trident: 'weapon.mainhand',
  shield: 'weapon.offhand', totem: 'weapon.offhand',
  bow: 'hotbar.0', pickaxe: 'hotbar.1', axe: 'hotbar.2',
  shovel: 'hotbar.3', fireworks: 'hotbar.4',
};

async function equipPlayer(player, tier = 'netherite', items = null) {
  const preset = ENCHANTMENT_PRESETS[tier] || ENCHANTMENT_PRESETS.netherite;
  // Default items: full armor + sword + pickaxe + shield
  const itemList = items || ['helmet', 'chestplate', 'leggings', 'boots', 'sword', 'pickaxe', 'shield'];
  const cmds = [];
  const equipped = [];

  for (const item of itemList) {
    const itemData = preset[item];
    const slot = SLOT_MAP[item];
    if (!itemData || !slot) continue;
    // Handle items with count (like fireworks "minecraft:firework_rocket 64")
    const parts = itemData.split(' ');
    if (parts.length > 1) {
      cmds.push(`item replace entity ${player} ${slot} with ${parts[0]} ${parts[1]}`);
    } else {
      cmds.push(`item replace entity ${player} ${slot} with ${itemData}`);
    }
    equipped.push(item);
  }

  if (cmds.length === 0) return { ok: false, error: 'no valid items to equip' };
  const result = await bisect.executeBatch(cmds);
  return { ok: true, equipped, player, tier, commands: cmds.length };
}

// ============================================================================
// REPLACE BLOCKS IN AREA — handles chunk loading, tiling, block tags, everything
// ============================================================================

// Common block group tags that /fill replace understands
// Block groups — loaded from reference file
const BLOCK_GROUPS = REF.block_groups || {};

async function replaceBlocksInArea(cx, cz, radius, fromBlock, toBlock, dimension, minY, maxY) {
  radius = Math.min(radius || 80, 150);
  minY = minY || 50;
  maxY = maxY || 120;
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';

  // Resolve block groups: "wood" → multiple tags, "trees" → logs + leaves, etc.
  const fromBlocks = BLOCK_GROUPS[fromBlock] || [fromBlock.startsWith('#') || fromBlock.includes(':') ? fromBlock : `minecraft:${fromBlock}`];
  const toBlockId = toBlock.includes(':') ? toBlock : `minecraft:${toBlock}`;

  // Step 1: Teleport bot to target for chunk loading
  await bisect.runCommand(`tp .knightofiam1294 ${cx} 100 ${cz}`);
  // Step 2: Forceload (capped at safe size)
  const flRadius = Math.min(radius, 100);
  await bisect.runCommand(`forceload add ${cx - flRadius} ${cz - flRadius} ${cx + flRadius} ${cz + flRadius}`);
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Generate fill commands for each block type
  const cmds = [];
  for (const from of fromBlocks) {
    cmds.push(`${dp}fill ${cx - radius} ${minY} ${cz - radius} ${cx + radius} ${maxY} ${cz + radius} ${toBlockId} replace ${from}`);
  }

  // Step 4: Execute (auto-tiling handles oversized fills)
  const result = await bisect.executeBatch(cmds);

  // Step 5: Cleanup forceload
  await bisect.runCommand('forceload remove all');

  return {
    ok: true,
    area: { from: { x: cx - radius, z: cz - radius }, to: { x: cx + radius, z: cz + radius }, y: { min: minY, max: maxY } },
    center: { x: cx, z: cz },
    block_types_replaced: fromBlocks,
    replaced_with: toBlockId,
    commands: result.commands_executed,
  };
}

// ============================================================================
// LOCATE AND TELEPORT — find structures/biomes and tp players
// ============================================================================

// Maps natural language to /locate commands — loaded from reference file
const LOCATE_MAP = REF.locate_targets || {
  // Structures
  village: 'locate structure minecraft:village_plains',
  'desert village': 'locate structure minecraft:village_desert',
  'ocean monument': 'locate structure minecraft:ocean_monument',
  'guardian temple': 'locate structure minecraft:ocean_monument',
  monument: 'locate structure minecraft:ocean_monument',
  fortress: 'execute in minecraft:the_nether run locate structure minecraft:fortress',
  'nether fortress': 'execute in minecraft:the_nether run locate structure minecraft:fortress',
  bastion: 'execute in minecraft:the_nether run locate structure minecraft:bastion_remnant',
  'end city': 'execute in minecraft:the_end run locate structure minecraft:end_city',
  mineshaft: 'locate structure minecraft:mineshaft',
  stronghold: 'locate structure minecraft:stronghold',
  'trial chambers': 'locate structure minecraft:trial_chambers',
  mansion: 'locate structure minecraft:woodland_mansion',
  'witch hut': 'locate structure minecraft:swamp_hut',
  pyramid: 'locate structure minecraft:desert_pyramid',
  'jungle temple': 'locate structure minecraft:jungle_pyramid',
  igloo: 'locate structure minecraft:igloo',
  shipwreck: 'locate structure minecraft:shipwreck',
  'ocean ruin': 'locate structure minecraft:ocean_ruin_warm',
  'ancient city': 'locate structure minecraft:ancient_city',
  'pillager outpost': 'locate structure minecraft:pillager_outpost',
  // Biomes
  'deep dark': 'locate biome minecraft:deep_dark',
  skulk: 'locate biome minecraft:deep_dark',
  'lush cave': 'locate biome minecraft:lush_caves',
  'lush caves': 'locate biome minecraft:lush_caves',
  mushroom: 'locate biome minecraft:mushroom_fields',
  'cherry grove': 'locate biome minecraft:cherry_grove',
  'cherry blossom': 'locate biome minecraft:cherry_grove',
  desert: 'locate biome minecraft:desert',
  jungle: 'locate biome minecraft:jungle',
  'bamboo jungle': 'locate biome minecraft:bamboo_jungle',
  swamp: 'locate biome minecraft:swamp',
  'dark forest': 'locate biome minecraft:dark_forest',
  forest: 'locate biome minecraft:forest',
  plains: 'locate biome minecraft:plains',
  'snowy plains': 'locate biome minecraft:snowy_plains',
  'polar bear': 'locate biome minecraft:snowy_plains',
  'ice spikes': 'locate biome minecraft:ice_spikes',
  ocean: 'locate biome minecraft:ocean',
  'deep ocean': 'locate biome minecraft:deep_ocean',
  'warm ocean': 'locate biome minecraft:warm_ocean',
  badlands: 'locate biome minecraft:badlands',
  meadow: 'locate biome minecraft:meadow',
  'flower forest': 'locate biome minecraft:flower_forest',
  taiga: 'locate biome minecraft:taiga',
  'snowy taiga': 'locate biome minecraft:snowy_taiga',
  savanna: 'locate biome minecraft:savanna',
  'frozen ocean': 'locate biome minecraft:frozen_ocean',
  'mangrove swamp': 'locate biome minecraft:mangrove_swamp',
  'dripstone caves': 'locate biome minecraft:dripstone_caves',
  // Nether biomes
  'soul sand valley': 'execute in minecraft:the_nether run locate biome minecraft:soul_sand_valley',
  'crimson forest': 'execute in minecraft:the_nether run locate biome minecraft:crimson_forest',
  'warped forest': 'execute in minecraft:the_nether run locate biome minecraft:warped_forest',
  'basalt deltas': 'execute in minecraft:the_nether run locate biome minecraft:basalt_deltas',
};

async function locateAndTeleport(target, players) {
  // Resolve the target to a /locate command
  const lowerTarget = target.toLowerCase().trim();
  let locateCmd = LOCATE_MAP[lowerTarget];

  // Fuzzy match if exact match fails
  if (!locateCmd) {
    for (const [key, cmd] of Object.entries(LOCATE_MAP)) {
      if (lowerTarget.includes(key) || key.includes(lowerTarget)) {
        locateCmd = cmd;
        break;
      }
    }
  }

  // Last resort: try as raw biome/structure name
  if (!locateCmd) {
    locateCmd = `locate biome minecraft:${lowerTarget.replace(/\s+/g, '_')}`;
  }

  // Execute locate
  const locResult = await bisect.runCommand(locateCmd, { captureOutput: true, waitMs: 2000 });
  if (!locResult.ok) return { ok: false, error: 'locate command failed' };

  // Parse coordinates from output: "The nearest X is at [x, ~, z] (N blocks away)"
  const match = (locResult.output || '').match(/at \[(-?\d+),\s*~?,?\s*(-?\d+)\]/);
  if (!match) {
    // Try alternate format: "at [-480, 75, 64]"
    const match2 = (locResult.output || '').match(/at \[(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/);
    if (!match2) {
      return { ok: false, error: `Could not parse coordinates from locate output. Raw: ${(locResult.output || '').slice(-200)}` };
    }
    var x = parseInt(match2[1]), y = parseInt(match2[2]), z = parseInt(match2[3]);
  } else {
    var x = parseInt(match[1]), z = parseInt(match[2]), y = 100; // default safe Y
  }

  // Determine dimension from the locate command
  let dimension = 'minecraft:overworld';
  if (locateCmd.includes('the_nether')) dimension = 'minecraft:the_nether';
  if (locateCmd.includes('the_end')) dimension = 'minecraft:the_end';
  const dp = dimension !== 'minecraft:overworld' ? `execute in ${dimension} run ` : '';

  // Teleport players
  const playerList = players === 'all' || players === '@a' ? '@a' : players;
  await bisect.runCommand(`${dp}tp ${playerList} ${x} ${y} ${z}`);

  return {
    ok: true,
    target,
    coordinates: { x, y, z },
    dimension,
    teleported: playerList,
  };
}

// ============================================================================
// PLANT TREES — natural tree placement with ground prep
// ============================================================================

// Tree features — loaded from reference file
const TREE_FEATURES = REF.tree_features || {};

async function plantTrees(treeType, count, cx, cz, radius, dimension) {
  const feature = TREE_FEATURES[treeType.toLowerCase()] || `minecraft:${treeType.toLowerCase()}`;
  count = Math.min(count || 10, 200);
  radius = Math.min(radius || 50, 100);
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';

  // Teleport bot for chunk loading
  await bisect.runCommand(`tp .knightofiam1294 ${cx} 100 ${cz}`);
  await bisect.runCommand(`forceload add ${cx - radius} ${cz - radius} ${cx + radius} ${cz + radius}`);
  await new Promise(r => setTimeout(r, 3000));

  // Generate tree placement commands with ground prep at random positions
  const cmds = [];
  for (let i = 0; i < count * 2; i++) { // try 2x positions since some will fail
    const x = cx + Math.floor(Math.random() * radius * 2 - radius);
    const z = cz + Math.floor(Math.random() * radius * 2 - radius);
    // Ground prep + place feature — some will fail on bad terrain, that's OK
    cmds.push(`${dp}setblock ${x} 64 ${z} minecraft:grass_block`);
    cmds.push(`${dp}setblock ${x} 63 ${z} minecraft:dirt`);
    cmds.push(`${dp}place feature ${feature} ${x} 65 ${z}`);
  }

  const result = await bisect.executeBatch(cmds);
  await bisect.runCommand('forceload remove all');

  return {
    ok: true,
    tree_type: treeType,
    attempted: count * 2,
    center: { x: cx, z: cz },
    radius,
    note: 'Some trees may fail to place on unsuitable terrain — this is normal. More positions are attempted than requested to compensate.',
  };
}

// ============================================================================
// PLACE STRUCTURE — generate entire Minecraft structures at a location
// ============================================================================

async function placeStructure(structureType, x, y, z, dimension) {
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';

  // Normalize structure name
  let structure = structureType.toLowerCase().replace(/\s+/g, '_');
  if (!structure.startsWith('minecraft:')) structure = `minecraft:${structure}`;

  // Teleport bot and forceload for chunk loading
  await bisect.runCommand(`tp .knightofiam1294 ${x} ${Math.max(y, 60)} ${z}`);
  await bisect.runCommand(`forceload add ${x - 100} ${z - 100} ${x + 100} ${z + 100}`);
  await new Promise(r => setTimeout(r, 3000));

  const result = await bisect.runCommand(`${dp}place structure ${structure} ${x} ${y} ${z}`, { captureOutput: true, waitMs: 3000 });
  await bisect.runCommand('forceload remove all');

  const output = result.output || '';
  if (output.includes('Generated structure') || output.includes('Placed')) {
    return { ok: true, structure, coordinates: { x, y, z }, dimension: dimension || 'minecraft:overworld' };
  }
  return { ok: false, error: `Failed to place structure. Output: ${output.slice(-300)}`, structure };
}

// ============================================================================
// SCAN AREA — query what block types exist in a region
// ============================================================================

const SCAN_CACHE_FILE = path.join(__dirname, 'memory', 'scan-cache.json');
let scanCache = {};
try { scanCache = JSON.parse(fs.readFileSync(SCAN_CACHE_FILE, 'utf8')); } catch {}

function saveScanCache() {
  fs.mkdirSync(path.dirname(SCAN_CACHE_FILE), { recursive: true });
  fs.writeFileSync(SCAN_CACHE_FILE, JSON.stringify(scanCache, null, 2));
}

function getScanCacheKey(cx, cz, radius, dimension) {
  return `${dimension || 'overworld'}:${cx},${cz}:r${radius}`;
}

async function scanArea(cx, cz, radius, dimension) {
  // Check cache first
  const cacheKey = getScanCacheKey(Math.round(cx), Math.round(cz), radius || 30, dimension);
  if (scanCache[cacheKey]) {
    console.log(`[tools] scan cache hit: ${cacheKey}`);
    return { ...scanCache[cacheKey], cached: true };
  }
  radius = Math.min(radius || 30, 50);
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';

  // Teleport bot for chunk loading
  await bisect.runCommand(`tp .knightofiam1294 ${cx} 80 ${cz}`);
  await bisect.runCommand(`forceload add ${cx - radius} ${cz - radius} ${cx + radius} ${cz + radius}`);
  await new Promise(r => setTimeout(r, 3000));

  // Common blocks to test for — covers most structures and terrain
  const testBlocks = [
    // Wood types
    'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'cherry_planks', 'mangrove_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks',
    'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'cherry_log', 'mangrove_log',
    'stripped_oak_log', 'stripped_spruce_log', 'stripped_birch_log',
    // Stone types
    'stone', 'cobblestone', 'stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks',
    'granite', 'diorite', 'andesite', 'deepslate', 'tuff', 'calcite',
    'sandstone', 'red_sandstone', 'smooth_sandstone', 'smooth_stone',
    'polished_andesite', 'polished_granite', 'polished_diorite', 'polished_deepslate',
    // Terrain
    'grass_block', 'dirt', 'sand', 'red_sand', 'gravel', 'clay',
    'snow_block', 'ice', 'packed_ice', 'blue_ice',
    'netherrack', 'soul_sand', 'soul_soil', 'basalt', 'blackstone',
    'end_stone', 'purpur_block',
    // Building
    'bricks', 'nether_bricks', 'prismarine', 'dark_prismarine',
    'quartz_block', 'smooth_quartz', 'obsidian', 'crying_obsidian',
    'glass', 'glass_pane', 'tinted_glass',
    'iron_block', 'gold_block', 'diamond_block', 'emerald_block', 'copper_block',
    // Stairs/slabs
    'oak_stairs', 'spruce_stairs', 'birch_stairs', 'cobblestone_stairs', 'stone_brick_stairs',
    'oak_slab', 'spruce_slab', 'cobblestone_slab', 'stone_brick_slab',
    // Functional
    'crafting_table', 'furnace', 'chest', 'barrel', 'smoker', 'blast_furnace',
    'anvil', 'grindstone', 'stonecutter', 'loom', 'cartography_table', 'fletching_table',
    'brewing_stand', 'enchanting_table', 'lectern', 'composter', 'bell',
    'bed', 'lantern', 'torch', 'campfire', 'hay_block',
    // Decorative
    'flower_pot', 'bookshelf',
    // Leaves
    'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves', 'cherry_leaves', 'mangrove_leaves', 'azalea_leaves',
    // Doors/fences
    'oak_door', 'spruce_door', 'oak_fence', 'spruce_fence', 'oak_fence_gate',
    'oak_trapdoor', 'iron_door', 'iron_bars',
    // Water/lava
    'water', 'lava',
  ];

  // Generate test commands — use /execute if block to check existence
  // We use /fill with count 0 (dry run) — actually fill doesn't have a dry run mode
  // Instead: for each block type, try to fill a 1x1x1 area replacing that block with itself
  // If "No blocks were filled" → block not present. If "Successfully filled N" → present with count.
  // But that modifies nothing since we're replacing with the same block.
  const cmds = [];
  const minY = 50, maxY = 90;
  for (const block of testBlocks) {
    cmds.push(`fill ${cx-radius} ${minY} ${cz-radius} ${cx+radius} ${maxY} ${cz+radius} minecraft:${block} replace minecraft:${block}`);
  }

  // Execute all test fills via console (not mcfunction) so we get logged results.
  // Fire them in rapid batches of 10, then read the log once for all results.
  const BATCH_SIZE = 10;
  for (let i = 0; i < cmds.length; i += BATCH_SIZE) {
    const batch = cmds.slice(i, i + BATCH_SIZE);
    for (const cmd of batch) {
      await bisect.runCommand(cmd);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  // Wait for all results to land in the log
  await new Promise(r => setTimeout(r, 1500));

  // Parse results from log
  const tail = await bisect.readLogTail(200);
  const found = {};
  for (const block of testBlocks) {
    // Look for "Successfully filled N block(s)" lines — each fill targets one block type
    // The fill command replaces block with itself, so "Successfully filled" means it exists
    const re = new RegExp(`fill.*replace minecraft:${block}`, 'i');
    // Actually, the log doesn't show the command — just "Successfully filled N block(s)"
    // We need to match by ORDER: commands were sent sequentially, results appear sequentially
  }
  // Simpler approach: just count all "Successfully filled" lines and match by position
  const lines = tail.split('\n');
  const fillResults = lines.filter(l => l.includes('Successfully filled') || l.includes('No blocks were filled'));
  // Map results back to block types by order
  let resultIdx = fillResults.length - cmds.length; // align to our commands
  if (resultIdx < 0) resultIdx = 0;
  for (let i = 0; i < testBlocks.length && (resultIdx + i) < fillResults.length; i++) {
    const line = fillResults[resultIdx + i];
    const m = line.match(/Successfully filled (\d+)/);
    if (m) {
      found[`minecraft:${testBlocks[i]}`] = parseInt(m[1]);
    }
  }

  await bisect.runCommand('forceload remove all');

  // Sort by count descending
  const sorted = Object.entries(found).sort((a, b) => b[1] - a[1]);

  return {
    ok: true,
    center: { x: cx, z: cz },
    radius,
    blocks_found: Object.fromEntries(sorted),
    total_types: sorted.length,
    total_blocks: sorted.reduce((sum, [, count]) => sum + count, 0),
    note: `Scanned ${testBlocks.length} common block types. Counts are approximate (fill-replace-self technique).`,
  };

  // Cache the result
  scanCache[cacheKey] = result;
  saveScanCache();
  console.log(`[tools] scan cached: ${cacheKey}`);

  return result;
}

// ============================================================================
// VALIDATE BLOCK NAME — check if a block name is valid
// ============================================================================

function isValidBlock(name) {
  const id = name.startsWith('minecraft:') ? name : `minecraft:${name}`;
  return REF.blocks && REF.blocks.includes(id);
}

function isValidEntity(name) {
  const id = name.startsWith('minecraft:') ? name : `minecraft:${name}`;
  return REF.entities && REF.entities.includes(id);
}

module.exports = { equipPlayer, replaceBlocksInArea, locateAndTeleport, plantTrees, placeStructure, scanArea, isValidBlock, isValidEntity, BLOCK_GROUPS, LOCATE_MAP };
