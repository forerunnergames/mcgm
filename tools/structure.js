// Generate entire Minecraft structures at a location.

'use strict';

const server = require('../server');
const chunkLoader = require('../server/chunk-loader');

const schema = {
  name: 'place_structure',
  description: 'Generate an entire Minecraft structure at a location. Places REAL procedurally-generated structures — trial chambers, villages, ocean monuments, fortresses, mansions, etc. Handles chunk loading automatically. Available structures: trial_chambers, village_plains, village_desert, village_savanna, village_snowy, village_taiga, ocean_monument, fortress, bastion_remnant, end_city, woodland_mansion, ancient_city, pillager_outpost, desert_pyramid, jungle_pyramid, swamp_hut, igloo, shipwreck, mineshaft, stronghold, ruined_portal.',
  input_schema: {
    type: 'object',
    properties: {
      structure: { type: 'string', description: 'Structure type (e.g. "trial_chambers", "village_plains", "ocean_monument")' },
      x: { type: 'integer' }, y: { type: 'integer' }, z: { type: 'integer' },
      dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
    },
    required: ['structure', 'x', 'y', 'z'],
  },
};

async function execute(input) {
  const { x, y, z, dimension } = input;
  const dp = chunkLoader.dimPrefix(dimension);

  let structure = input.structure.toLowerCase().replace(/\s+/g, '_');
  if (!structure.startsWith('minecraft:')) structure = `minecraft:${structure}`;

  await chunkLoader.ensureLoadedRadius(x, z, 100, dimension);

  const result = await server.runCommand(`${dp}place structure ${structure} ${x} ${y} ${z}`, { captureOutput: true, waitMs: 3000 });
  await chunkLoader.cleanup(dimension);

  const output = result.output || '';
  if (output.includes('Generated structure') || output.includes('Placed')) {
    return { ok: true, structure, coordinates: { x, y, z }, dimension: dimension || 'minecraft:overworld' };
  }
  return { ok: false, error: `Failed to place structure. Output: ${output.slice(-300)}`, structure };
}

module.exports = { schema, execute };
