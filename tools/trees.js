// Plant natural-looking trees at a location.

'use strict';

const server = require('../server');
const chunkLoader = require('../server/chunk-loader');
const { getTreeFeatures } = require('../minecraft/registry');

const TREE_FEATURES = getTreeFeatures();

const schema = {
  name: 'plant_trees',
  description: 'Plant natural-looking trees at a location. Handles ground prep and /place feature automatically. Some trees may fail on unsuitable terrain — the tool compensates by attempting 2x the requested count.',
  input_schema: {
    type: 'object',
    properties: {
      tree_type: { type: 'string', enum: ['cherry', 'oak', 'birch', 'spruce', 'jungle', 'dark oak', 'acacia'], description: 'Type of tree' },
      count: { type: 'integer', description: 'How many trees (max 200). ~50% will succeed on natural terrain.' },
      center_x: { type: 'number' },
      center_z: { type: 'number' },
      radius: { type: 'integer', description: 'Radius to scatter trees in (max 100, default 50)' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
    },
    required: ['tree_type', 'count', 'center_x', 'center_z'],
  },
};

async function execute(input) {
  const treeType = input.tree_type;
  const feature = TREE_FEATURES[treeType.toLowerCase()] || `minecraft:${treeType.toLowerCase()}`;
  const count = Math.min(input.count || 10, 200);
  const radius = Math.min(input.radius || 50, 100);
  const cx = input.center_x;
  const cz = input.center_z;
  const dimension = input.dimension;
  const dp = chunkLoader.dimPrefix(dimension);

  await chunkLoader.ensureLoadedRadius(cx, cz, radius, dimension);

  const cmds = [];
  for (let i = 0; i < count * 2; i++) {
    const x = cx + Math.floor(Math.random() * radius * 2 - radius);
    const z = cz + Math.floor(Math.random() * radius * 2 - radius);
    cmds.push(`${dp}setblock ${x} 64 ${z} minecraft:grass_block`);
    cmds.push(`${dp}setblock ${x} 63 ${z} minecraft:dirt`);
    cmds.push(`${dp}place feature ${feature} ${x} 65 ${z}`);
  }

  const result = await server.executeBatch(cmds);
  await chunkLoader.cleanup(dimension);

  return {
    ok: true,
    tree_type: treeType,
    attempted: count * 2,
    center: { x: cx, z: cz },
    radius,
    note: 'Some trees may fail to place on unsuitable terrain — this is normal.',
  };
}

module.exports = { schema, execute };
