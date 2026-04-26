// Tools index — auto-discovers all tool files and exports them.
// Each tool file exports { schema, execute }.

'use strict';

const fs = require('fs');
const path = require('path');

const toolFiles = fs.readdirSync(__dirname)
  .filter(f => f !== 'index.js' && f.endsWith('.js'));

const tools = {};
const schemas = [];

for (const file of toolFiles) {
  const tool = require(path.join(__dirname, file));
  if (tool.schema && tool.execute) {
    tools[tool.schema.name] = tool;
    schemas.push(tool.schema);
  }
}

const eventLog = require('../server/event-log');

// Tools that should be recorded in the event log with their metadata extractors
const EVENT_EXTRACTORS = {
  kit: (input, result) => ({
    type: 'equip', description: `${input.action || 'apply'} ${input.kit || 'max'} kit on ${input.player}`,
    players: [input.player],
  }),
  equip_player: (input, result) => ({
    type: 'equip', description: `equipped ${input.tier || 'netherite'} gear on ${input.player}`,
    players: [input.player],
  }),
  buff_debuff: (input, result) => ({
    type: input.type || 'buff', description: `${input.type} level ${input.level || 5} on ${input.player}`,
    players: [input.player],
  }),
  replace_blocks_in_area: (input, result) => ({
    type: 'fill', description: `replaced ${input.from_block} with ${input.to_block} radius ${input.radius || 500}`,
    coordinates: { x: input.center_x, y: 64, z: input.center_z },
    boundingBox: result.area ? { x1: result.area.from.x, y1: result.area.y.min, z1: result.area.from.z, x2: result.area.to.x, y2: result.area.y.max, z2: result.area.to.z } : null,
    dimension: input.dimension,
  }),
  locate_and_teleport: (input, result) => ({
    type: 'teleport', description: `teleported ${result.teleported || 'players'} to ${input.target}`,
    coordinates: result.coordinates, dimension: result.dimension,
  }),
  place_structure: (input, result) => ({
    type: 'build', description: `placed ${input.structure} at (${input.x}, ${input.y}, ${input.z})`,
    coordinates: { x: input.x, y: input.y, z: input.z },
    boundingBox: { x1: input.x - 50, y1: input.y - 20, z1: input.z - 50, x2: input.x + 50, y2: input.y + 40, z2: input.z + 50 },
    dimension: input.dimension,
  }),
  scatter_blocks: (input, result) => ({
    type: 'build', description: `scattered ${input.count} ${input.block}`,
    coordinates: { x: input.center_x, y: 64, z: input.center_z },
    boundingBox: result.bounding_box ? { x1: result.bounding_box.from.x, y1: result.bounding_box.from.y, z1: result.bounding_box.from.z, x2: result.bounding_box.to.x, y2: result.bounding_box.to.y, z2: result.bounding_box.to.z } : null,
  }),
  plant_trees: (input, result) => ({
    type: 'build', description: `planted ${input.count} ${input.tree_type} trees`,
    coordinates: { x: input.center_x, y: 64, z: input.center_z },
  }),
  start_session: (input, result) => ({
    type: 'session', description: `relocated game to ${input.location}`,
    coordinates: result.location ? { x: result.location.x, y: 64, z: result.location.z } : null,
    dimension: result.dimension,
  }),
  inventory: (input, result) => ({
    type: 'inventory', description: `${input.action} on ${input.player}`,
    players: [input.player],
  }),
};

/**
 * Execute a tool by name. Records the action in the event log.
 * @param {string} name - Tool name (e.g. 'equip_player')
 * @param {object} input - Tool input parameters
 * @returns {Promise<object>}
 */
async function executeTool(name, input) {
  const tool = tools[name];
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  const result = await tool.execute(input);

  // Record in event log if the tool has an extractor and succeeded
  if (result.ok && EVENT_EXTRACTORS[name]) {
    try {
      const meta = EVENT_EXTRACTORS[name](input, result);
      eventLog.record(meta.type, meta.description, meta);
    } catch (e) {
      // Don't let logging failures break tool execution
      console.warn(`[tools] event log failed for ${name}:`, e.message);
    }
  }

  return result;
}

// Backwards-compatible exports (matches old tools.js interface)
const equip = require('./equip');
const locate = require('./locate');
const replace = require('./replace');

module.exports = {
  // New interface
  tools, schemas, executeTool,
  // Backwards-compatible named exports
  equipPlayer: equip.execute,
  locateAndTeleport: locate.execute,
  replaceBlocksInArea: replace.execute,
  plantTrees: require('./trees').execute,
  placeStructure: require('./structure').execute,
  scanArea: require('./scan').execute,
  getDeathLocation: require('./death').execute,
  // Constants
  BLOCK_GROUPS: replace.BLOCK_GROUPS,
  LOCATE_MAP: locate.LOCATE_MAP,
};
