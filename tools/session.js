// Game session management — relocate all players to a new area.
// "start new game at world boundary", "start new game in an end city", etc.

'use strict';

const server = require('../server');
const gamemaster = require('../server/gamemaster');
const { parseLocateOutput } = require('../server/log-reader');
const { getLocateTargets } = require('../minecraft/registry');

const LOCATE_MAP = getLocateTargets();

const schema = {
  name: 'start_session',
  description: 'Relocate the entire game to a new location. Builds a GM glass platform at height limit, sets player spawn at ground level, teleports everyone. Use when the operator says "start new game", "move everyone to", "new session at", etc. Preset locations: world_boundary, north/south/east/west_boundary, random, nether, spawn. Or specify any structure/biome name (village, end city, deep dark, etc.) and it will /locate it first. Or give exact coordinates.',
  input_schema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'Where to relocate. Presets: "world_boundary", "random", "nether", "spawn". Or a structure/biome: "village", "end city", "trial chambers", "deep dark", etc. Or "x,z" coordinates like "5000,3000".' },
      players: {
        type: 'array', items: { type: 'string' },
        description: 'Player names to teleport. Default: all online players.',
      },
    },
    required: ['location'],
  },
};

async function execute(input) {
  const location = input.location.toLowerCase().trim();

  // Get all online players if not specified
  let players = input.players;
  if (!players || players.length === 0) {
    const list = await server.listPlayers();
    players = list.ok ? list.players : [];
  }

  // Resolve location
  let x, z, dimension = 'minecraft:overworld';

  // 1. Check presets
  const presetKey = Object.keys(gamemaster.SESSION_PRESETS).find(k =>
    location.includes(k) || k.includes(location)
  );
  if (presetKey) {
    const preset = gamemaster.SESSION_PRESETS[presetKey]();
    x = preset.x;
    z = preset.z;
    dimension = preset.dimension;
  }

  // 2. Check for explicit coordinates "x,z" or "x z"
  if (x === undefined) {
    const coordMatch = location.match(/(-?\d+)[,\s]+(-?\d+)/);
    if (coordMatch) {
      x = parseInt(coordMatch[1]);
      z = parseInt(coordMatch[2]);
    }
  }

  // 3. Try to /locate a structure or biome
  if (x === undefined) {
    let locateCmd = LOCATE_MAP[location];
    if (!locateCmd) {
      for (const [key, cmd] of Object.entries(LOCATE_MAP)) {
        if (key === '_note') continue;
        if (location.includes(key) || key.includes(location)) {
          locateCmd = cmd;
          break;
        }
      }
    }
    if (!locateCmd) {
      // Try as raw structure or biome
      locateCmd = `locate structure minecraft:${location.replace(/\s+/g, '_')}`;
    }

    const locResult = await server.runCommand(locateCmd, { captureOutput: true, waitMs: 3000 });
    if (locResult.ok) {
      const parsed = parseLocateOutput(locResult.output || '');
      if (parsed) {
        x = parsed.x;
        z = parsed.z;
        if (locateCmd.includes('the_nether')) dimension = 'minecraft:the_nether';
        if (locateCmd.includes('the_end')) dimension = 'minecraft:the_end';
      }
    }
  }

  if (x === undefined || z === undefined) {
    return { ok: false, error: `Could not resolve location "${input.location}". Try a preset (world_boundary, random, spawn), coordinates (5000,3000), or a structure/biome name.` };
  }

  // Relocate the session
  const result = await gamemaster.relocateSession(x, z, dimension, players);
  result.location_name = input.location;
  return result;
}

module.exports = { schema, execute };
