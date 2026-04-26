// Replace one block type with another in an area.
// Uses chunk-loader instead of duplicating chunk loading logic.

'use strict';

const server = require('../server');
const chunkLoader = require('../server/chunk-loader');
const { getBlockGroups } = require('../minecraft/registry');

const BLOCK_GROUPS = getBlockGroups();

const schema = {
  name: 'replace_blocks_in_area',
  description: 'Replace one block type with another in an area. Handles chunk loading, bot teleporting, forceloading, tiling, and block tags ALL automatically. Use block group names for convenience: "wood" (all planks/logs/stairs/slabs/fences/doors), "trees" (logs+leaves), "stone", "ores", "flowers", "ice", "sand", "dirt", "water", "lava", "wool", "glass". Or use specific block IDs or #tags.',
  input_schema: {
    type: 'object',
    properties: {
      center_x: { type: 'number', description: 'Center X coordinate of the area' },
      center_z: { type: 'number', description: 'Center Z coordinate of the area' },
      radius: { type: 'integer', description: 'Radius in blocks (max 150, default 80)' },
      from_block: { type: 'string', description: 'Block to replace. Use group names (wood, trees, stone, ores, flowers, ice, sand, dirt, water, lava) or specific IDs (minecraft:oak_log) or tags (#minecraft:logs)' },
      to_block: { type: 'string', description: 'Block to replace with (e.g. minecraft:glass, minecraft:lava, minecraft:air)' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
      min_y: { type: 'integer', description: 'Minimum Y (default 50)' },
      max_y: { type: 'integer', description: 'Maximum Y (default 120)' },
    },
    required: ['center_x', 'center_z', 'from_block', 'to_block'],
  },
};

async function execute(input) {
  const cx = input.center_x;
  const cz = input.center_z;
  const radius = Math.min(input.radius || 80, 150);
  const minY = input.min_y || 50;
  const maxY = input.max_y || 120;
  const dimension = input.dimension;
  const dp = chunkLoader.dimPrefix(dimension);

  const fromBlocks = BLOCK_GROUPS[input.from_block] ||
    [input.from_block.startsWith('#') || input.from_block.includes(':') ? input.from_block : `minecraft:${input.from_block}`];
  const toBlockId = input.to_block.includes(':') ? input.to_block : `minecraft:${input.to_block}`;

  // Use chunk-loader (deduplicated)
  await chunkLoader.ensureLoadedRadius(cx, cz, Math.min(radius, 100), dimension);

  const cmds = [];
  for (const from of fromBlocks) {
    cmds.push(`${dp}fill ${cx - radius} ${minY} ${cz - radius} ${cx + radius} ${maxY} ${cz + radius} ${toBlockId} replace ${from}`);
  }

  const result = await server.executeBatch(cmds);
  await chunkLoader.cleanup(dimension);

  return {
    ok: true,
    area: { from: { x: cx - radius, z: cz - radius }, to: { x: cx + radius, z: cz + radius }, y: { min: minY, max: maxY } },
    center: { x: cx, z: cz },
    block_types_replaced: fromBlocks,
    replaced_with: toBlockId,
    commands: result.commands_executed,
  };
}

module.exports = { schema, execute, BLOCK_GROUPS };
