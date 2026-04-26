// Scatter random blocks — for decorative chaos effects only.
// NOT for building structures. Use batch_commands with fill/setblock for construction.

'use strict';

const server = require('../server');

const schema = {
  name: 'scatter_blocks',
  description: 'Scatter random blocks on the GROUND at random positions in an area. For decorative chaos effects (debris fields, random decorations, block clouds). NOT for building structures — use batch_commands with fill/setblock for that. Blocks are placed at ground level by default. Set floating=true to scatter in the air instead. Max 5000 blocks per call.',
  input_schema: {
    type: 'object',
    properties: {
      block: { type: 'string', description: 'Block ID like minecraft:amethyst_block, minecraft:obsidian, minecraft:glowstone' },
      count: { type: 'integer', description: 'How many blocks to scatter (max 5000)' },
      center_x: { type: 'number' },
      center_z: { type: 'number' },
      radius: { type: 'integer', description: 'Horizontal radius to scatter within' },
      min_y: { type: 'integer', description: 'Minimum Y height. Default 63 (ground level).' },
      max_y: { type: 'integer', description: 'Maximum Y height. Default 66 (just above ground). Set higher for floating blocks.' },
      floating: { type: 'boolean', description: 'If true, scatter blocks at random heights in the air. Default false (ground level).' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
    },
    required: ['block', 'count', 'center_x', 'center_z', 'radius'],
  },
};

async function execute(input) {
  const floating = input.floating || false;
  const minY = input.min_y || (floating ? 80 : 63);
  const maxY = input.max_y || (floating ? 200 : 66);

  return server.scatterBlocks(
    input.block, input.count, input.center_x, input.center_z,
    input.radius, minY, maxY, input.dimension,
  );
}

module.exports = { schema, execute };
