// Scan an area to discover what block types are present.
// Fixed: unreachable cache save code that was after the return statement.

'use strict';

const fs = require('fs');
const path = require('path');
const server = require('../server');
const chunkLoader = require('../server/chunk-loader');

const SCAN_CACHE_FILE = path.join(__dirname, '..', 'memory', 'scan-cache.json');
let scanCache = {};
try { scanCache = JSON.parse(fs.readFileSync(SCAN_CACHE_FILE, 'utf8')); } catch {}

function saveScanCache() {
  fs.mkdirSync(path.dirname(SCAN_CACHE_FILE), { recursive: true });
  fs.writeFileSync(SCAN_CACHE_FILE, JSON.stringify(scanCache, null, 2));
}

const TEST_BLOCKS = [
  // Wood
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'cherry_planks', 'mangrove_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks',
  'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'cherry_log', 'mangrove_log',
  'stripped_oak_log', 'stripped_spruce_log', 'stripped_birch_log',
  // Stone
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

const schema = {
  name: 'scan_area',
  description: 'Scan an area to discover what block types are present. ONLY use this for CONVERSION/REPLACEMENT tasks ("convert village to desert", "replace all wood with glass"). Do NOT use for BUILDING tasks. Takes 30-60 seconds.',
  input_schema: {
    type: 'object',
    properties: {
      center_x: { type: 'number' },
      center_z: { type: 'number' },
      radius: { type: 'integer', description: 'Scan radius (max 50, default 30)' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
    },
    required: ['center_x', 'center_z'],
  },
};

async function execute(input) {
  const cx = input.center_x;
  const cz = input.center_z;
  const dimension = input.dimension;

  const cacheKey = `${dimension || 'overworld'}:${Math.round(cx)},${Math.round(cz)}:r${input.radius || 30}`;
  if (scanCache[cacheKey]) {
    return { ...scanCache[cacheKey], cached: true };
  }

  const radius = Math.min(input.radius || 30, 50);
  await chunkLoader.ensureLoadedRadius(cx, cz, radius, dimension);

  const cmds = [];
  const minY = 50, maxY = 90;
  for (const block of TEST_BLOCKS) {
    cmds.push(`fill ${cx - radius} ${minY} ${cz - radius} ${cx + radius} ${maxY} ${cz + radius} minecraft:${block} replace minecraft:${block}`);
  }

  // Fire fills individually (not via mcfunction) so results appear in log
  const BATCH_SIZE = 10;
  for (let i = 0; i < cmds.length; i += BATCH_SIZE) {
    const batch = cmds.slice(i, i + BATCH_SIZE);
    for (const cmd of batch) {
      await server.runCommand(cmd);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  await new Promise(r => setTimeout(r, 1500));

  const tail = await server.readLogTail(200);
  const found = {};
  const lines = tail.split('\n');
  const fillResults = lines.filter(l => l.includes('Successfully filled') || l.includes('No blocks were filled'));
  let resultIdx = fillResults.length - cmds.length;
  if (resultIdx < 0) resultIdx = 0;
  for (let i = 0; i < TEST_BLOCKS.length && (resultIdx + i) < fillResults.length; i++) {
    const line = fillResults[resultIdx + i];
    const m = line.match(/Successfully filled (\d+)/);
    if (m) {
      found[`minecraft:${TEST_BLOCKS[i]}`] = parseInt(m[1]);
    }
  }

  await chunkLoader.cleanup(dimension);

  const sorted = Object.entries(found).sort((a, b) => b[1] - a[1]);
  const result = {
    ok: true,
    center: { x: cx, z: cz },
    radius,
    blocks_found: Object.fromEntries(sorted),
    total_types: sorted.length,
    total_blocks: sorted.reduce((sum, [, count]) => sum + count, 0),
    note: `Scanned ${TEST_BLOCKS.length} common block types. Counts are approximate.`,
  };

  // Cache the result (was unreachable in the old code — fixed)
  scanCache[cacheKey] = result;
  saveScanCache();

  return result;
}

module.exports = { schema, execute };
