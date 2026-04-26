// Event log — records every bot action with coordinates and metadata.
// Enables "undo the prison", "teleport back to the lava", "what did you do last".
// Persists to disk so history survives bot restarts.

'use strict';

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '..', 'memory', 'events.json');
const MAX_EVENTS = 200;

// ============================================================================
// State
// ============================================================================

let events = []; // newest first
let nextId = 1;

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    events = data.events || [];
    nextId = data.nextId || (events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1);
  } catch {}
}

function save() {
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ nextId, events }, null, 2));
}

load();

// ============================================================================
// Record events
// ============================================================================

/**
 * Record a bot action.
 *
 * @param {string} type — e.g. 'build', 'fill', 'spawn', 'teleport', 'equip', 'buff', 'session'
 * @param {string} description — human-readable summary ("built obsidian prison around Player1")
 * @param {object} data — structured data for undo/reference:
 *   { coordinates: {x,y,z}, boundingBox: {x1,y1,z1,x2,y2,z2}, dimension,
 *     players: [], entities: [], block: string, commands: [] }
 */
function record(type, description, data = {}) {
  const event = {
    id: nextId++,
    type,
    description,
    timestamp: new Date().toISOString(),
    ...data,
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(0, MAX_EVENTS);
  }

  save();
  console.log(`[events] #${event.id}: ${type} — ${description}`);
  return event;
}

// ============================================================================
// Query events
// ============================================================================

function getRecent(count = 10) {
  return events.slice(0, count);
}

function getById(id) {
  return events.find(e => e.id === id) || null;
}

/**
 * Search events by keyword in description or type.
 */
function search(query) {
  const lower = query.toLowerCase();
  return events.filter(e =>
    e.description.toLowerCase().includes(lower) ||
    e.type.toLowerCase().includes(lower) ||
    (e.players || []).some(p => p.toLowerCase().includes(lower))
  );
}

/**
 * Get the most recent event matching a query.
 */
function findLast(query) {
  const results = search(query);
  return results.length > 0 ? results[0] : null;
}

/**
 * Get all events with a bounding box (for undo operations).
 */
function getUndoable() {
  return events.filter(e => e.boundingBox || e.entities);
}

// ============================================================================
// Generate undo commands for an event
// ============================================================================

/**
 * Generate commands to undo/cleanup an event.
 * Returns an array of raw Minecraft commands.
 */
function getUndoCommands(event) {
  const cmds = [];
  const dp = event.dimension && event.dimension !== 'minecraft:overworld'
    ? `execute in ${event.dimension} run ` : '';

  // Fill bounding box with air
  if (event.boundingBox) {
    const b = event.boundingBox;
    cmds.push(`${dp}fill ${b.x1} ${b.y1} ${b.z1} ${b.x2} ${b.y2} ${b.z2} minecraft:air`);
  }

  // Kill spawned entities
  if (event.entities && event.coordinates) {
    const { x, y, z } = event.coordinates;
    for (const entity of event.entities) {
      cmds.push(`${dp}kill @e[type=minecraft:${entity},x=${x},y=${y},z=${z},distance=..50]`);
    }
  }

  // Clear effects from players
  if (event.type === 'buff' || event.type === 'debuff') {
    for (const player of (event.players || [])) {
      cmds.push(`effect clear ${player}`);
      cmds.push(`attribute ${player} minecraft:max_health base set 20`);
    }
  }

  return cmds;
}

module.exports = {
  record, getRecent, getById, search, findLast, getUndoable, getUndoCommands,
  getAll: () => events,
  load, save,
};
