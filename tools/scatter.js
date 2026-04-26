// Scatter random individual blocks in the air at random positions.

'use strict';

const server = require('../server');

const schema = {
  name: 'scatter_blocks',
  description: 'Scatter random individual blocks in the air at random positions. Coordinates are generated SERVER-SIDE (instant) so this is much faster than generating setblock commands yourself. Max 5000 blocks per call.',
  input_schema: {
    type: 'object',
    properties: {
      block: { type: 'string', description: 'Block ID like minecraft:bedrock, minecraft:obsidian, minecraft:glowstone' },
      count: { type: 'integer', description: 'How many blocks to scatter (max 5000)' },
      center_x: { type: 'number' },
      center_z: { type: 'number' },
      radius: { type: 'integer', description: 'Horizontal radius to scatter within' },
      min_y: { type: 'integer', description: 'Minimum Y height' },
      max_y: { type: 'integer', description: 'Maximum Y height' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
    },
    required: ['block', 'count', 'center_x', 'center_z', 'radius', 'min_y', 'max_y'],
  },
};

async function execute(input) {
  return server.scatterBlocks(
    input.block, input.count, input.center_x, input.center_z,
    input.radius, input.min_y, input.max_y, input.dimension,
  );
}

module.exports = { schema, execute };
