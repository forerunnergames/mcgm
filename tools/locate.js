// Find a structure or biome and teleport players there.
// Handles /locate, coordinate parsing, dimension detection, safe Y finding, and /tp.

'use strict';

const server = require('../server');
const { parseLocateOutput } = require('../server/log-reader');
const { getLocateTargets } = require('../minecraft/registry');

const LOCATE_MAP = getLocateTargets();

// Structures/biomes that are underground — need air pocket carving
const UNDERGROUND_TARGETS = [
  'trial_chambers', 'ancient_city', 'mineshaft', 'stronghold',
  'deep_dark', 'lush_cave', 'dripstone_caves',
];

const schema = {
  name: 'locate_and_teleport',
  description: 'Find a structure or biome and teleport players there. Handles /locate, coordinate parsing, dimension detection, and /tp automatically. Works for: village, ocean monument, fortress, bastion, end city, mineshaft, stronghold, trial chambers, mansion, witch hut, pyramid, jungle temple, igloo, shipwreck, ancient city, pillager outpost, deep dark, lush cave, mushroom, cherry grove, desert, jungle, forest, plains, snowy plains, ice spikes, ocean, badlands, meadow, flower forest, taiga, savanna, soul sand valley, crimson forest, warped forest, basalt deltas, and more.',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'What to find (natural language, e.g. "village", "ocean monument", "deep dark", "cherry grove", "nether fortress")' },
      players: { type: 'string', description: 'Who to teleport. Use "@a" for everyone, or one or more player names separated by commas (e.g. "_FlameFrags__,ThePro261"). All players land at the SAME spot. Default "@a".' },
    },
    required: ['target'],
  },
};

async function execute(input) {
  const target = input.target;
  const players = input.players || '@a';
  const lowerTarget = target.toLowerCase().trim();

  // Resolve to a /locate command
  let locateCmd = LOCATE_MAP[lowerTarget];
  if (!locateCmd) {
    for (const [key, cmd] of Object.entries(LOCATE_MAP)) {
      if (key === '_note') continue;
      if (lowerTarget.includes(key) || key.includes(lowerTarget)) {
        locateCmd = cmd;
        break;
      }
    }
  }
  if (!locateCmd) {
    locateCmd = `locate biome minecraft:${lowerTarget.replace(/\s+/g, '_')}`;
  }

  // Execute locate
  const locResult = await server.runCommand(locateCmd, { captureOutput: true, waitMs: 2000 });
  if (!locResult.ok) return { ok: false, error: 'locate command failed' };

  const parsed = parseLocateOutput(locResult.output || '');
  if (!parsed) {
    return { ok: false, error: `Could not parse coordinates from locate output. Raw: ${(locResult.output || '').slice(-200)}` };
  }

  let { x, y, z, hasExactY } = parsed;
  const isUnderground = UNDERGROUND_TARGETS.some(t => lowerTarget.includes(t) || (locateCmd && locateCmd.includes(t)));

  // Determine dimension
  let dimension = 'minecraft:overworld';
  if (locateCmd.includes('the_nether')) dimension = 'minecraft:the_nether';
  if (locateCmd.includes('the_end')) dimension = 'minecraft:the_end';
  const dp = dimension !== 'minecraft:overworld' ? `execute in ${dimension} run ` : '';

  // Parse players into array
  let playerNames;
  if (players === 'all' || players === '@a') {
    playerNames = ['@a'];
  } else {
    playerNames = players.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  }

  if (!hasExactY && !isUnderground) {
    // SURFACE: use spreadplayers on bot to find safe Y, then tp everyone there
    await server.runCommand(`${dp}spreadplayers ${x} ${z} 0 1 false .knightofiam1294`);
    await new Promise(r => setTimeout(r, 500));
    const botPos = await server.getPlayerPositionAndDimension('.knightofiam1294');
    let safeY = 100;
    if (botPos.ok && botPos.position) {
      const coords = botPos.position.match(/-?\d+\.\d+/g);
      if (coords && coords.length >= 2) safeY = Math.floor(parseFloat(coords[1]));
    }
    y = safeY;
    for (const p of playerNames) {
      await server.runCommand(`${dp}tp ${p} ${x} ${y} ${z}`);
    }
  } else {
    // UNDERGROUND or exact Y: tp directly with air pocket
    if (!hasExactY) y = isUnderground ? -20 : 100;
    // Carve air pocket before teleporting
    await server.runCommand(`${dp}tp .knightofiam1294 ${x} ${y} ${z}`);
    await new Promise(r => setTimeout(r, 1000));
    // Single unconditional air fill — no need for per-block-type fills
    await server.runCommand(`${dp}fill ${x - 1} ${y} ${z - 1} ${x + 1} ${y + 2} ${z + 1} minecraft:air`);
    await server.runCommand(`${dp}setblock ${x} ${y + 2} ${z} minecraft:torch`);
    for (const p of playerNames) {
      await server.runCommand(`${dp}tp ${p} ${x} ${y} ${z}`);
    }
  }

  return {
    ok: true,
    target,
    coordinates: { x, y, z },
    dimension,
    teleported: playerNames.join(', '),
  };
}

module.exports = { schema, execute, LOCATE_MAP, UNDERGROUND_TARGETS };
