// Chunk loading for remote Minecraft operations.
// Teleports the bot and forceloads chunks to ensure commands work in unloaded areas.

'use strict';

const api = require('./api');

const BOT_NAME = process.env.BOT_NAME || '.bot';

/**
 * Ensure chunks are loaded around a bounding box.
 * Teleports the bot to the center and forceloads a region.
 *
 * @param {{ minX: number, minZ: number, maxX: number, maxZ: number }} bounds
 * @param {string|null} dimension - e.g. 'minecraft:the_nether', or null for overworld
 * @param {object} opts - { waitMs: number }
 */
async function ensureLoaded(bounds, dimension, opts = {}) {
  const waitMs = opts.waitMs || 3000;
  const dp = dimPrefix(dimension);
  const cx = Math.floor((bounds.minX + bounds.maxX) / 2);
  const cz = Math.floor((bounds.minZ + bounds.maxZ) / 2);

  // Teleport bot to center
  await api.sendCommand(`${dp}tp ${BOT_NAME} ${cx} 100 ${cz}`);

  // Forceload (capped at ±100 from center to stay within server limits)
  const fMinX = Math.max(bounds.minX, cx - 100);
  const fMaxX = Math.min(bounds.maxX, cx + 100);
  const fMinZ = Math.max(bounds.minZ, cz - 100);
  const fMaxZ = Math.min(bounds.maxZ, cz + 100);
  await api.sendCommand(`${dp}forceload add ${fMinX} ${fMinZ} ${fMaxX} ${fMaxZ}`);

  // Wait for chunks to load
  await new Promise(r => setTimeout(r, waitMs));
}

/**
 * Ensure chunks are loaded around a center point with a given radius.
 */
async function ensureLoadedRadius(cx, cz, radius, dimension, opts = {}) {
  return ensureLoaded({
    minX: cx - radius, maxX: cx + radius,
    minZ: cz - radius, maxZ: cz + radius,
  }, dimension, opts);
}

/**
 * Remove all forceloaded chunks.
 * @param {string|null} dimension
 */
async function cleanup(dimension) {
  const dp = dimPrefix(dimension);
  await api.sendCommand(`${dp}forceload remove all`);
}

/**
 * Generate the "execute in <dimension> run " prefix for non-overworld dimensions.
 */
function dimPrefix(dimension) {
  if (dimension && dimension !== 'minecraft:overworld') {
    return `execute in ${dimension} run `;
  }
  return '';
}

module.exports = { ensureLoaded, ensureLoadedRadius, cleanup, dimPrefix, BOT_NAME };
