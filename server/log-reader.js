// Log reading and result parsing for Minecraft server commands.
// Extracts structured data from the server log after running commands.

'use strict';

const api = require('./api');

/**
 * Run a command and capture its output from the server log.
 * Waits for the output to appear, then returns the relevant lines.
 */
async function runAndCapture(command, opts = {}) {
  const result = await api.sendCommand(command);
  if (!result.ok) return result;

  const waitMs = opts.waitMs || 1200;
  await new Promise(r => setTimeout(r, waitMs));
  const log = await api.readLogTail(60);
  const lines = log.split('\n');
  // Take the most recent lines (likely our command's output)
  const output = lines.slice(Math.max(0, lines.length - 20)).join('\n');
  return { ok: true, command: result.command, output };
}

/**
 * Get player NBT data by path (Pos, Dimension, LastDeathLocation, etc.)
 */
async function getPlayerData(player, path = 'Pos') {
  await api.sendCommand(`data get entity ${player} ${path}`);
  await new Promise(r => setTimeout(r, 700));
  const tail = await api.readLogTail(40);
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped} has the following entity data: (.+)$`);
  const lines = tail.split('\n').reverse();
  for (const line of lines) {
    const m = line.match(re);
    if (m) return { ok: true, data: m[1] };
  }
  return { ok: false, error: 'no data found in recent log (player offline?)' };
}

/**
 * Get a player's position AND dimension in one call.
 */
async function getPlayerPositionAndDimension(player) {
  await api.sendCommand(`data get entity ${player} Pos`);
  await new Promise(r => setTimeout(r, 600));
  await api.sendCommand(`data get entity ${player} Dimension`);
  await new Promise(r => setTimeout(r, 600));

  const tail = await api.readLogTail(40);
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let pos = null;
  let dim = null;
  const lines = tail.split('\n').reverse();
  for (const line of lines) {
    const m = line.match(new RegExp(`${escaped} has the following entity data: (.+)$`));
    if (m) {
      const val = m[1].trim();
      if (val.startsWith('[') && !pos) {
        pos = val;
      } else if (val.startsWith('"') && !dim) {
        dim = val.replace(/"/g, '');
      }
    }
    if (pos && dim) break;
  }

  if (!pos) {
    return {
      ok: false,
      error: `Could not find player "${player}". The name must be the EXACT in-game name (case-sensitive, including dots and underscores). Use list_online_players to see exact names. Common mistake: using a nickname like "Andrew" instead of the in-game name like "_FlameFrags__".`,
    };
  }
  return { ok: true, position: pos, dimension: dim || 'minecraft:overworld' };
}

/**
 * Get the list of online players.
 */
async function listPlayers() {
  await api.sendCommand('list');
  await new Promise(r => setTimeout(r, 600));
  const tail = await api.readLogTail(20);
  const m = tail.match(/There are \d+ of a max of \d+ players online:\s*(.*)$/m);
  if (!m) return { ok: false, error: 'list output not found' };
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  return { ok: true, players: names };
}

/**
 * Parse coordinates from /locate output.
 * Returns { x, y, z, hasExactY } or null.
 */
function parseLocateOutput(output) {
  // Format 1: "at [x, ~, z]" (no Y given)
  const match1 = output.match(/at \[(-?\d+),\s*~?,?\s*(-?\d+)\]/);
  if (match1) {
    return { x: parseInt(match1[1]), z: parseInt(match1[2]), y: null, hasExactY: false };
  }
  // Format 2: "at [x, y, z]" (all three given)
  const match2 = output.match(/at \[(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/);
  if (match2) {
    return { x: parseInt(match2[1]), y: parseInt(match2[2]), z: parseInt(match2[3]), hasExactY: true };
  }
  return null;
}

module.exports = {
  runAndCapture, getPlayerData, getPlayerPositionAndDimension,
  listPlayers, parseLocateOutput,
};
