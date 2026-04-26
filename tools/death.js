// Get where a player last died.

'use strict';

const server = require('../server');

const schema = {
  name: 'get_death_location',
  description: 'Get where a player last died. Returns coordinates and dimension. Use when someone says "where did I die", "take me to my death", etc.',
  input_schema: {
    type: 'object',
    properties: {
      player: { type: 'string', description: 'Player name' },
    },
    required: ['player'],
  },
};

async function execute(input) {
  const result = await server.runCommand(`data get entity ${input.player} LastDeathLocation`, { captureOutput: true, waitMs: 1500 });
  const output = result.output || '';
  const posMatch = output.match(/pos:\s*\[I;\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/);
  const dimMatch = output.match(/dimension:\s*"([^"]+)"/);
  if (!posMatch) {
    return { ok: false, error: 'No death location found — player may not have died yet.' };
  }
  return {
    ok: true,
    player: input.player,
    coordinates: { x: parseInt(posMatch[1]), y: parseInt(posMatch[2]), z: parseInt(posMatch[3]) },
    dimension: dimMatch ? dimMatch[1] : 'minecraft:overworld',
  };
}

module.exports = { schema, execute };
