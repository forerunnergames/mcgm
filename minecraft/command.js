// Command type system for Minecraft commands.
// Classifies raw command strings into typed objects so downstream code can
// make decisions based on cmd.category instead of scattered regex checks.

'use strict';

// Command types and their categories.
// 'block'  = commands that reference block IDs (fill, setblock, place)
// 'entity' = commands that reference entity IDs (summon, kill)
// 'player' = commands that target players with non-block IDs (effect, attribute, item, give, tp, gamemode, clear)
// 'world'  = server/world management (forceload, time, weather, gamerule, reload, say, title, tellraw)
// 'data'   = data queries (data get, scoreboard, tag)
// 'raw'    = anything we can't classify
const TYPE_MAP = {
  fill:         'block',
  setblock:     'block',
  place:        'block',
  clone:        'block',
  summon:       'entity',
  kill:         'entity',
  effect:       'player',
  attribute:    'player',
  item:         'player',
  give:         'player',
  tp:           'player',
  teleport:     'player',
  gamemode:     'player',
  clear:        'player',
  enchant:      'player',
  experience:   'player',
  xp:           'player',
  spreadplayers:'player',
  data:         'data',
  scoreboard:   'data',
  tag:          'data',
  forceload:    'world',
  time:         'world',
  weather:      'world',
  gamerule:     'world',
  reload:       'world',
  say:          'world',
  title:        'world',
  tellraw:      'world',
  function:     'world',
  difficulty:   'world',
  worldborder:  'world',
  schedule:     'world',
  list:         'world',
};

/**
 * Classify a raw command string into a typed command object.
 * Handles "execute in <dimension> run <cmd>" prefixes.
 *
 * @param {string} raw - Raw command string (with or without leading /)
 * @returns {{ type: string, category: string, dimension: string|null, raw: string, inner: string }}
 */
function classify(raw) {
  const cleaned = raw.startsWith('/') ? raw.slice(1) : raw;

  // Extract "execute in <dimension> run ..." wrapper
  let dimension = null;
  let inner = cleaned;
  const execMatch = cleaned.match(/^execute in (minecraft:\S+) run (.+)$/);
  if (execMatch) {
    dimension = execMatch[1];
    inner = execMatch[2];
  }

  // Get the first word (the command name)
  const firstWord = inner.split(/\s+/)[0].toLowerCase();
  const category = TYPE_MAP[firstWord] || 'raw';

  return {
    type: firstWord,
    category,
    dimension,
    raw: cleaned,
    inner,
  };
}

/**
 * Does this command need block name normalization?
 * Only block-category commands have minecraft: IDs that are block names.
 */
function needsBlockNormalization(cmd) {
  return cmd.category === 'block';
}

/**
 * Is this command safe to put in a .mcfunction file?
 * Block, entity, data, and world commands are safe.
 * Player commands (effect, attribute, give, item, tp) should run individually
 * because one parse error kills the entire .mcfunction file, and these commands
 * use non-block minecraft: IDs that the server validates strictly.
 */
function isBatchSafe(cmd) {
  return cmd.category === 'block' ||
         cmd.category === 'entity' ||
         cmd.category === 'data' ||
         cmd.category === 'world';
}

/**
 * Extract the bounding box of all fill commands for chunk-loading decisions.
 * @param {Array} cmds - Array of classified command objects
 * @returns {{ minX, minZ, maxX, maxZ, dimension }|null}
 */
function extractFillBounds(cmds) {
  const fillRe = /^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  let found = false;
  let dimension = null;

  for (const cmd of cmds) {
    if (cmd.type !== 'fill') continue;
    const m = cmd.inner.match(fillRe);
    if (!m) continue;
    found = true;
    if (cmd.dimension) dimension = cmd.dimension;
    const [, sx1, , sz1, sx2, , sz2] = m;
    minX = Math.min(minX, +sx1, +sx2);
    maxX = Math.max(maxX, +sx1, +sx2);
    minZ = Math.min(minZ, +sz1, +sz2);
    maxZ = Math.max(maxZ, +sz1, +sz2);
  }

  return found ? { minX, minZ, maxX, maxZ, dimension } : null;
}

module.exports = { classify, needsBlockNormalization, isBatchSafe, extractFillBounds, TYPE_MAP };
