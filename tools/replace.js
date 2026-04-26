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
      radius: { type: 'integer', description: 'Radius in blocks (default 500 for large-scale). Automatically runs multiple passes for areas larger than 150 blocks.' },
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
  const totalRadius = input.radius || 500; // default large-scale
  const minY = input.min_y || 50;
  const maxY = input.max_y || 120;
  const dimension = input.dimension;
  const dp = chunkLoader.dimPrefix(dimension);

  const fromBlocks = BLOCK_GROUPS[input.from_block] ||
    [input.from_block.startsWith('#') || input.from_block.includes(':') ? input.from_block : `minecraft:${input.from_block}`];
  const toBlockId = input.to_block.includes(':') ? input.to_block : `minecraft:${input.to_block}`;

  // For large areas, run multiple passes in 150-block strips
  const PASS_RADIUS = 150;
  let totalCommands = 0;

  if (totalRadius <= PASS_RADIUS) {
    // Single pass — fits within one chunk-load
    await chunkLoader.ensureLoadedRadius(cx, cz, Math.min(totalRadius, 100), dimension);
    const cmds = [];
    for (const from of fromBlocks) {
      cmds.push(`${dp}fill ${cx - totalRadius} ${minY} ${cz - totalRadius} ${cx + totalRadius} ${maxY} ${cz + totalRadius} ${toBlockId} replace ${from}`);
    }
    const result = await server.executeBatch(cmds);
    totalCommands = result.commands_executed;
    await chunkLoader.cleanup(dimension);
  } else {
    // Multi-pass — sweep in strips from -totalRadius to +totalRadius
    for (let offX = -totalRadius; offX < totalRadius; offX += PASS_RADIUS * 2) {
      for (let offZ = -totalRadius; offZ < totalRadius; offZ += PASS_RADIUS * 2) {
        const px = cx + offX + PASS_RADIUS;
        const pz = cz + offZ + PASS_RADIUS;
        const x1 = Math.max(cx - totalRadius, cx + offX);
        const z1 = Math.max(cz - totalRadius, cz + offZ);
        const x2 = Math.min(cx + totalRadius, cx + offX + PASS_RADIUS * 2 - 1);
        const z2 = Math.min(cz + totalRadius, cz + offZ + PASS_RADIUS * 2 - 1);

        await chunkLoader.ensureLoadedRadius(px, pz, PASS_RADIUS, dimension, { waitMs: 2000 });
        const cmds = [];
        for (const from of fromBlocks) {
          cmds.push(`${dp}fill ${x1} ${minY} ${z1} ${x2} ${maxY} ${z2} ${toBlockId} replace ${from}`);
        }
        const result = await server.executeBatch(cmds);
        totalCommands += result.commands_executed;
        await chunkLoader.cleanup(dimension);
      }
    }
  }

  return {
    ok: true,
    area: { from: { x: cx - totalRadius, z: cz - totalRadius }, to: { x: cx + totalRadius, z: cz + totalRadius }, y: { min: minY, max: maxY } },
    center: { x: cx, z: cz },
    radius: totalRadius,
    block_types_replaced: fromBlocks,
    replaced_with: toBlockId,
    commands: totalCommands,
  };
}

module.exports = { schema, execute, BLOCK_GROUPS };
