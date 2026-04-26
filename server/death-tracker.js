// Death tracker — monitors the server log for player deaths and records them.
// Persists to disk so death history survives bot restarts.

'use strict';

const fs = require('fs');
const path = require('path');
const api = require('./api');

const DEATHS_FILE = path.join(__dirname, '..', 'memory', 'deaths.json');
const MAX_DEATHS_PER_PLAYER = 50;

// ============================================================================
// State
// ============================================================================

let deaths = {}; // { "PlayerName": [{ x, y, z, dimension, cause, timestamp }, ...] }

function load() {
  try {
    deaths = JSON.parse(fs.readFileSync(DEATHS_FILE, 'utf8'));
  } catch {}
}

function save() {
  fs.mkdirSync(path.dirname(DEATHS_FILE), { recursive: true });
  fs.writeFileSync(DEATHS_FILE, JSON.stringify(deaths, null, 2));
}

load();

// ============================================================================
// Death message parsing
// ============================================================================

// Minecraft death messages always start with the player name followed by a verb.
// Examples:
//   "ThePro261 was slain by Iron Golem"
//   "_FlameFrags__ drowned"
//   ".knightofiam85 was blown up by Creeper"
//   "ThePro261 fell from a high place"
//   ".player1 tried to swim in lava"
//   "ThePro261 was shot by Skeleton"
//   "ThePro261 was killed by [Intentional Game Design]"
//   "ThePro261 hit the ground too hard"
//   "ThePro261 burned to death"
//   "ThePro261 suffocated in a wall"
//   "ThePro261 starved to death"
//   "ThePro261 withered away"

const DEATH_VERBS = [
  'was slain by', 'was shot by', 'was blown up by', 'was killed by',
  'was pummeled by', 'was fireballed by', 'was stung by',
  'was squished by', 'was squashed by',
  'drowned', 'suffocated', 'starved', 'burned', 'froze',
  'fell from', 'fell off', 'fell out', 'fell while', 'hit the ground',
  'tried to swim in lava', 'walked into fire', 'went up in flames',
  'discovered the floor was lava', 'walked into danger zone',
  'was impaled by', 'was pricked to death', 'was skewered by',
  'withered away', 'experienced kinetic energy', 'died',
  'was doomed to fall', 'was struck by lightning',
  'didn\'t want to live', 'was obliterated',
];

const DEATH_RE = new RegExp(
  `^(\\S+) (${DEATH_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
);

/**
 * Try to parse a death message from a log line.
 * @returns {{ player: string, cause: string } | null}
 */
function parseDeathMessage(logLine) {
  // Strip timestamp: "[HH:MM:SS] [Server thread/INFO]: PlayerName was slain..."
  const stripped = logLine.replace(/^\[.*?\]\s*(\[.*?\]\s*:?\s*)?/, '');
  const m = stripped.match(DEATH_RE);
  if (!m) return null;
  // Filter out non-player entities (villagers, mobs have UUIDs or long names)
  const player = m[1];
  if (player.includes("'") || player.includes('/') || player.length > 30) return null;
  return { player, cause: stripped.slice(player.length + 1).trim() };
}

// ============================================================================
// Record a death
// ============================================================================

/**
 * Record a death for a player. Queries LastDeathLocation for coordinates.
 */
async function recordDeath(player, cause) {
  // Query the player's LastDeathLocation NBT
  let x = null, y = null, z = null, dimension = 'minecraft:overworld';

  await new Promise(r => setTimeout(r, 500)); // brief delay for server to update NBT
  const result = await api.sendCommand(`data get entity ${player} LastDeathLocation`);
  await new Promise(r => setTimeout(r, 800));
  const tail = await api.readLogTail(20);

  const posMatch = tail.match(/pos:\s*\[I;\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/);
  const dimMatch = tail.match(/dimension:\s*"([^"]+)"/);
  if (posMatch) {
    x = parseInt(posMatch[1]);
    y = parseInt(posMatch[2]);
    z = parseInt(posMatch[3]);
  }
  if (dimMatch) {
    dimension = dimMatch[1];
  }

  const entry = {
    x, y, z, dimension, cause,
    timestamp: new Date().toISOString(),
  };

  if (!deaths[player]) deaths[player] = [];
  deaths[player].unshift(entry); // newest first
  if (deaths[player].length > MAX_DEATHS_PER_PLAYER) {
    deaths[player] = deaths[player].slice(0, MAX_DEATHS_PER_PLAYER);
  }

  save();
  console.log(`[deaths] recorded: ${player} ${cause} at (${x}, ${y}, ${z}) ${dimension}`);
  return entry;
}

// ============================================================================
// Query deaths
// ============================================================================

function getDeaths(player, count = 10) {
  return (deaths[player] || []).slice(0, count);
}

function getLastDeath(player) {
  return (deaths[player] || [])[0] || null;
}

function getAllDeaths() {
  return deaths;
}

// ============================================================================
// Log watcher — polls the server log for death messages
// ============================================================================

let watchInterval = null;
let lastProcessedLog = '';

function startWatching() {
  if (watchInterval) return;
  watchInterval = setInterval(async () => {
    try {
      const tail = await api.readLogTail(20);
      if (tail === lastProcessedLog) return;

      // Find new lines
      const oldLines = new Set(lastProcessedLog.split('\n'));
      const newLines = tail.split('\n').filter(l => !oldLines.has(l));
      lastProcessedLog = tail;

      for (const line of newLines) {
        const death = parseDeathMessage(line);
        if (death) {
          await recordDeath(death.player, death.cause);
        }
      }
    } catch (e) {
      // Silently ignore polling errors
    }
  }, 3000);
  console.log('[deaths] watching for player deaths');
}

function stopWatching() {
  if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
}

module.exports = {
  recordDeath, getDeaths, getLastDeath, getAllDeaths,
  parseDeathMessage, startWatching, stopWatching,
  load, save,
};
