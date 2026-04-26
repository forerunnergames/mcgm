// Gamemaster platform and spawn management.
// Builds a glass platform at height limit for the gamemaster.
// Supports relocating the entire game session to a new location.

'use strict';

const fs = require('fs');
const path = require('path');
const api = require('./api');
const { BOT_NAME } = require('./chunk-loader');

const GM_PLAYER = process.env.AUTHORIZED_OP || '.operator';
const STATE_FILE = path.join(__dirname, '..', 'memory', 'gm-state.json');

// ============================================================================
// State — persisted to disk so it survives bot restarts
// ============================================================================

let state = {
  platform: { cx: 0, cz: 0, y: 310, radius: 15 },
  dimension: 'minecraft:overworld',
  playerSpawn: { x: 0, y: 64, z: 0 },
};

function loadState() {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

loadState();

// ============================================================================
// Platform building
// ============================================================================

const PLATFORM_BLOCK = 'minecraft:glass';

function getGMSpawn() {
  return { x: state.platform.cx, y: state.platform.y + 1, z: state.platform.cz };
}

async function buildPlatformAt(cx, cz, y, dimension) {
  const radius = state.platform.radius;
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';

  // Chunk loading
  await api.sendCommand(`${dp}tp ${BOT_NAME} ${cx} ${y} ${cz}`);
  await api.sendCommand(`${dp}forceload add ${cx - radius} ${cz - radius} ${cx + radius} ${cz + radius}`);
  await new Promise(r => setTimeout(r, 2000));

  // Platform floor
  await api.sendCommand(`${dp}fill ${cx - radius} ${y} ${cz - radius} ${cx + radius} ${y} ${cz + radius} ${PLATFORM_BLOCK}`);

  // Glass walls (2 high)
  await api.sendCommand(`${dp}fill ${cx - radius} ${y + 1} ${cz - radius} ${cx + radius} ${y + 2} ${cz - radius} ${PLATFORM_BLOCK}`);
  await api.sendCommand(`${dp}fill ${cx - radius} ${y + 1} ${cz + radius} ${cx + radius} ${y + 2} ${cz + radius} ${PLATFORM_BLOCK}`);
  await api.sendCommand(`${dp}fill ${cx - radius} ${y + 1} ${cz - radius} ${cx - radius} ${y + 2} ${cz + radius} ${PLATFORM_BLOCK}`);
  await api.sendCommand(`${dp}fill ${cx + radius} ${y + 1} ${cz - radius} ${cx + radius} ${y + 2} ${cz + radius} ${PLATFORM_BLOCK}`);

  await api.sendCommand(`${dp}forceload remove all`);

  // Update state
  state.platform = { cx, cz, y, radius };
  state.dimension = dimension || 'minecraft:overworld';
  saveState();

  console.log(`[gamemaster] platform built at (${cx}, ${y}, ${cz})`);
}

async function buildPlatform() {
  const { cx, cz, y } = state.platform;
  await buildPlatformAt(cx, cz, y, state.dimension);
}

// ============================================================================
// Session relocation — "start new game at <location>"
// ============================================================================

/**
 * Relocate the entire game session to a new location.
 * - Builds GM platform at height limit above the location
 * - Sets player spawn at ground level
 * - Sets GM spawn on the platform
 * - Teleports everyone
 *
 * @param {number} x - Center X
 * @param {number} z - Center Z
 * @param {string} dimension - e.g. 'minecraft:overworld'
 * @param {string[]} players - All player names to teleport
 * @param {object} opts - { groundY: number }
 */
async function relocateSession(x, z, dimension, players, opts = {}) {
  const dp = dimension && dimension !== 'minecraft:overworld'
    ? `execute in ${dimension} run ` : '';
  const groundY = opts.groundY || 64;
  const platformY = 310;

  // 1. Build GM platform at new location
  await buildPlatformAt(x, z, platformY, dimension);

  // 2. Find safe ground Y using spreadplayers on the bot
  await api.sendCommand(`${dp}spreadplayers ${x} ${z} 0 1 false ${BOT_NAME}`);
  await new Promise(r => setTimeout(r, 1000));
  const { getPlayerPositionAndDimension } = require('./log-reader');
  const botPos = await getPlayerPositionAndDimension(BOT_NAME);
  let safeGroundY = groundY;
  if (botPos.ok && botPos.position) {
    const coords = botPos.position.match(/-?\d+\.\d+/g);
    if (coords && coords.length >= 2) safeGroundY = Math.floor(parseFloat(coords[1]));
  }

  // 3. Set spawn point for all non-GM players at ground level
  state.playerSpawn = { x, y: safeGroundY, z };
  state.dimension = dimension || 'minecraft:overworld';
  saveState();

  for (const player of players) {
    if (player === GM_PLAYER) continue;
    await api.sendCommand(`${dp}spawnpoint ${player} ${x} ${safeGroundY} ${z}`);
  }

  // 4. Set GM spawn on platform
  await api.sendCommand(`${dp}spawnpoint ${GM_PLAYER} ${x} ${platformY + 1} ${z}`);

  // 5. Teleport GM to platform
  await api.sendCommand(`${dp}tp ${GM_PLAYER} ${x} ${platformY + 1} ${z}`);

  // 6. Teleport all other players to ground level
  for (const player of players) {
    if (player === GM_PLAYER) continue;
    await api.sendCommand(`${dp}tp ${player} ${x} ${safeGroundY} ${z}`);
  }

  console.log(`[gamemaster] session relocated to (${x}, ${z}) dim=${dimension}`);

  return {
    ok: true,
    location: { x, z },
    dimension: dimension || 'minecraft:overworld',
    gm_platform: { x, y: platformY, z },
    player_spawn: { x, y: safeGroundY, z },
    players_teleported: players.length,
  };
}

// ============================================================================
// Predefined session locations
// ============================================================================

const SESSION_PRESETS = {
  // World boundary — random direction, 25000 blocks out
  'world boundary': () => {
    const angle = Math.random() * 2 * Math.PI;
    const dist = 25000;
    return { x: Math.floor(Math.cos(angle) * dist), z: Math.floor(Math.sin(angle) * dist), dimension: 'minecraft:overworld' };
  },
  'north boundary': () => ({ x: 0, z: -25000, dimension: 'minecraft:overworld' }),
  'south boundary': () => ({ x: 0, z: 25000, dimension: 'minecraft:overworld' }),
  'east boundary': () => ({ x: 25000, z: 0, dimension: 'minecraft:overworld' }),
  'west boundary': () => ({ x: -25000, z: 0, dimension: 'minecraft:overworld' }),
  // Random far location
  'random': () => {
    const x = Math.floor((Math.random() - 0.5) * 40000);
    const z = Math.floor((Math.random() - 0.5) * 40000);
    return { x, z, dimension: 'minecraft:overworld' };
  },
  // Nether
  'nether': () => ({ x: 0, z: 0, dimension: 'minecraft:the_nether' }),
  'nether random': () => {
    const x = Math.floor((Math.random() - 0.5) * 10000);
    const z = Math.floor((Math.random() - 0.5) * 10000);
    return { x, z, dimension: 'minecraft:the_nether' };
  },
  // Spawn
  'spawn': () => ({ x: 0, z: 0, dimension: 'minecraft:overworld' }),
};

// ============================================================================
// Auto-tp on join
// ============================================================================

async function teleportGMToPlatform() {
  const spawn = getGMSpawn();
  const dp = state.dimension !== 'minecraft:overworld'
    ? `execute in ${state.dimension} run ` : '';
  await api.sendCommand(`${dp}tp ${GM_PLAYER} ${spawn.x} ${spawn.y} ${spawn.z}`);
}

async function onPlayerJoin(playerName) {
  if (playerName === GM_PLAYER || playerName === GM_PLAYER.replace(/^\./, '')) {
    await new Promise(r => setTimeout(r, 1500));
    await teleportGMToPlatform();
    await api.sendCommand(`gamemode creative ${GM_PLAYER}`);
    await api.sendCommand(`effect give ${GM_PLAYER} minecraft:resistance infinite 4 true`);
  }
}

let watchInterval = null;
let lastLogCheck = '';
let lastJoinTime = 0;

function startWatching() {
  if (watchInterval) return;
  watchInterval = setInterval(async () => {
    try {
      const tail = await api.readLogTail(15);
      if (tail === lastLogCheck) return;
      lastLogCheck = tail;

      const joinRe = /(\S+) joined the game/g;
      let m;
      while ((m = joinRe.exec(tail)) !== null) {
        const player = m[1];
        if (player === GM_PLAYER || player === GM_PLAYER.replace(/^\./, '')) {
          // Debounce — don't re-trigger within 30 seconds
          const now = Date.now();
          if (now - lastJoinTime > 30000) {
            lastJoinTime = now;
            await onPlayerJoin(player);
          }
        }
      }
    } catch (e) { /* ignore polling errors */ }
  }, 5000);
  console.log(`[gamemaster] watching for ${GM_PLAYER} joins`);
}

function stopWatching() {
  if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  buildPlatform, buildPlatformAt, relocateSession,
  teleportGMToPlatform, onPlayerJoin,
  startWatching, stopWatching,
  getGMSpawn, getState: () => state,
  GM_PLAYER, PLATFORM: state.platform, GM_SPAWN: getGMSpawn(),
  SESSION_PRESETS,
  isPlatformBuilt: () => true,
};
