// Gamemaster platform and spawn management.
// Builds a glass platform at height limit for the gamemaster on server start.
// Auto-teleports the GM there on join. Used as the Switch-safe position
// during large block operations.

'use strict';

const api = require('./api');

const GM_PLAYER = process.env.AUTHORIZED_OP || '.knightofiam85';

// Platform config — centered at spawn, at build height limit
const PLATFORM = {
  cx: 0,
  cz: 0,
  y: 310,         // just below 319 height limit, leaves room above
  radius: 15,     // 31x31 glass platform
  block: 'minecraft:glass',
};

// The exact tp destination (center of platform, 1 block above surface)
const GM_SPAWN = {
  x: PLATFORM.cx,
  y: PLATFORM.y + 1,
  z: PLATFORM.cz,
};

let platformBuilt = false;

/**
 * Build the gamemaster's glass platform. Idempotent — safe to call multiple times.
 */
async function buildPlatform() {
  const { cx, cz, y, radius, block } = PLATFORM;

  // Tp bot to platform area first for chunk loading
  await api.sendCommand(`tp .knightofiam1294 ${cx} ${y} ${cz}`);
  await api.sendCommand(`forceload add ${cx - radius} ${cz - radius} ${cx + radius} ${cz + radius}`);
  await new Promise(r => setTimeout(r, 2000));

  // Build the platform (single layer of glass)
  await api.sendCommand(`fill ${cx - radius} ${y} ${cz - radius} ${cx + radius} ${y} ${cz + radius} ${block}`);

  // Add glass walls (2 blocks high) around the edge so GM doesn't walk off
  await api.sendCommand(`fill ${cx - radius} ${y + 1} ${cz - radius} ${cx + radius} ${y + 2} ${cz - radius} ${block}`); // north wall
  await api.sendCommand(`fill ${cx - radius} ${y + 1} ${cz + radius} ${cx + radius} ${y + 2} ${cz + radius} ${block}`); // south wall
  await api.sendCommand(`fill ${cx - radius} ${y + 1} ${cz - radius} ${cx - radius} ${y + 2} ${cz + radius} ${block}`); // west wall
  await api.sendCommand(`fill ${cx + radius} ${y + 1} ${cz - radius} ${cx + radius} ${y + 2} ${cz + radius} ${block}`); // east wall

  await api.sendCommand('forceload remove all');
  platformBuilt = true;
  console.log(`[gamemaster] platform built at (${cx}, ${y}, ${cz}) radius ${radius}`);
}

/**
 * Teleport the gamemaster to the platform.
 */
async function teleportGMToPlatform() {
  await api.sendCommand(`tp ${GM_PLAYER} ${GM_SPAWN.x} ${GM_SPAWN.y} ${GM_SPAWN.z}`);
  console.log(`[gamemaster] teleported ${GM_PLAYER} to platform`);
}

/**
 * Check the server log for the GM joining, and tp them to the platform.
 * Call this periodically or after detecting a join event.
 */
async function onPlayerJoin(playerName) {
  if (playerName === GM_PLAYER || playerName === GM_PLAYER.replace(/^\./, '')) {
    if (!platformBuilt) await buildPlatform();
    // Small delay so the player fully loads in
    await new Promise(r => setTimeout(r, 1500));
    await teleportGMToPlatform();
    // Also give creative mode + resistance for safety
    await api.sendCommand(`gamemode creative ${GM_PLAYER}`);
    await api.sendCommand(`effect give ${GM_PLAYER} minecraft:resistance infinite 4 true`);
  }
}

/**
 * Start watching the server log for player join events.
 * Polls every 5 seconds.
 */
let watchInterval = null;
let lastLogCheck = '';

function startWatching() {
  if (watchInterval) return;
  watchInterval = setInterval(async () => {
    try {
      const tail = await api.readLogTail(15);
      if (tail === lastLogCheck) return;
      lastLogCheck = tail;

      // Look for join messages: ".knightofiam85 joined the game"
      const joinRe = /(\S+) joined the game/g;
      let m;
      while ((m = joinRe.exec(tail)) !== null) {
        const player = m[1];
        // Only trigger once per join (check if this is a new line)
        if (player === GM_PLAYER || player === GM_PLAYER.replace(/^\./, '')) {
          await onPlayerJoin(player);
        }
      }
    } catch (e) {
      // Silently ignore polling errors
    }
  }, 5000);
  console.log(`[gamemaster] watching for ${GM_PLAYER} joins`);
}

function stopWatching() {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
}

module.exports = {
  buildPlatform, teleportGMToPlatform, onPlayerJoin,
  startWatching, stopWatching,
  GM_PLAYER, GM_SPAWN, PLATFORM,
  isPlatformBuilt: () => platformBuilt,
};
