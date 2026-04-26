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

/**
 * Execute a tool by name.
 * @param {string} name - Tool name (e.g. 'equip_player')
 * @param {object} input - Tool input parameters
 * @returns {Promise<object>}
 */
async function executeTool(name, input) {
  const tool = tools[name];
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  return tool.execute(input);
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
