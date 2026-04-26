// Single-load Minecraft reference data registry.
// Wraps minecraft-reference.json with validation and lookup functions.
// Loaded once at startup — no per-call require() overhead.

'use strict';

const fs = require('fs');
const path = require('path');

const REF_FILE = path.join(__dirname, '..', 'minecraft-reference.json');
const REF = JSON.parse(fs.readFileSync(REF_FILE, 'utf8'));

// Build Sets for O(1) lookups
const blocks       = new Set(REF.blocks || []);
const items        = new Set(REF.items || []);
const entities     = new Set(REF.entities || []);
// Effects in the reference use CamelCase (minecraft:FireResistance) but commands
// use snake_case (minecraft:fire_resistance). Build a lowercase lookup set.
const effects      = new Set((REF.effects || []).map(e => e.toLowerCase()));
const enchantments = new Set(REF.enchantments || []);

// Array form for iteration (fuzzy matching)
const blockList = [...blocks];

// ============================================================================
// Validation
// ============================================================================

function isValidBlock(id) {
  const q = qualify(id);
  return blocks.has(q) || q === 'minecraft:air';
}

function isValidItem(id) {
  return items.has(qualify(id));
}

function isValidEntity(id) {
  return entities.has(qualify(id));
}

function isValidEffect(id) {
  // Normalize: command form is snake_case, reference uses CamelCase
  const q = qualify(id).toLowerCase();
  // Try exact match, then try converting snake_case to lowercase camel
  if (effects.has(q)) return true;
  // "minecraft:fire_resistance" → "minecraft:fireresistance"
  const noPunct = q.replace(/_/g, '');
  return effects.has(noPunct);
}

function isValidEnchantment(id) {
  return enchantments.has(qualify(id));
}

function qualify(id) {
  return id && !id.includes(':') ? `minecraft:${id}` : id;
}

// ============================================================================
// Lookups
// ============================================================================

function getLocateTargets() {
  return REF.locate_targets || {};
}

function getTreeFeatures() {
  return REF.tree_features || {};
}

function getBlockGroups() {
  return REF.block_groups || {};
}

function getStructures() {
  return REF.structures || {};
}

function getBlockRenames() {
  return REF.block_renames || {};
}

// ============================================================================
// Fuzzy block name matching
// ============================================================================

// Official Mojang renames — blocks whose minecraft: ID actually changed between versions.
const OFFICIAL_RENAMES = {
  'grass': 'short_grass',
  'grass_path': 'dirt_path',
  'chain': 'iron_chain',
  'sign': 'oak_sign',
  'boat': 'oak_boat',
  'planks': 'oak_planks',
  'log': 'oak_log',
  'slab': 'oak_slab',
  'fence': 'oak_fence',
  'door': 'oak_door',
  'button': 'oak_button',
  'pressure_plate': 'oak_pressure_plate',
  'stairs': 'oak_stairs',
  'trapdoor': 'oak_trapdoor',
};

/**
 * Find the closest valid block name for an invalid one.
 * Uses: official renames → exact match → plural stripping → _block suffix →
 * suffix match → prefix match → Levenshtein (≤3 edits).
 * @returns {string|null} Corrected block ID or null if no match
 */
function findClosestBlock(invalid) {
  const name = invalid.replace('minecraft:', '');

  // 1. Official renames
  if (OFFICIAL_RENAMES[name]) {
    const renamed = `minecraft:${OFFICIAL_RENAMES[name]}`;
    if (blocks.has(renamed)) return renamed;
  }

  // 2. Exact match
  if (blocks.has(invalid)) return invalid;

  // 3. Plural stripping (poppys→poppy, torches→torch)
  for (const suffix of [/s$/, /es$/]) {
    const stripped = `minecraft:${name.replace(suffix, '')}`;
    if (blocks.has(stripped)) return stripped;
  }

  // 4. _block suffix add/remove
  const withoutBlock = `minecraft:${name.replace(/_block$/, '')}`;
  if (blocks.has(withoutBlock)) return withoutBlock;
  const withBlock = `minecraft:${name}_block`;
  if (blocks.has(withBlock)) return withBlock;

  // 5. Suffix match (e.g. "chain" → "iron_chain")
  const suffixMatch = blockList.find(c => {
    const cn = c.replace('minecraft:', '');
    return cn.endsWith('_' + name) || cn.endsWith(name);
  });
  if (suffixMatch) return suffixMatch;

  // 6. Prefix match
  const prefixMatch = blockList.find(c => {
    const cn = c.replace('minecraft:', '');
    return cn.startsWith(name + '_') || cn.startsWith(name);
  });
  if (prefixMatch && prefixMatch !== `minecraft:${name}`) return prefixMatch;

  // 7. Levenshtein fuzzy match (≤3 edits)
  let best = null;
  let bestScore = Infinity;
  for (const candidate of blockList) {
    const dist = levenshtein(name, candidate.replace('minecraft:', ''));
    if (dist < bestScore) { bestScore = dist; best = candidate; }
  }
  return bestScore <= 3 ? best : null;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Known valid block tags
const VALID_BLOCK_TAGS = new Set([
  '#minecraft:planks', '#minecraft:logs', '#minecraft:leaves', '#minecraft:stairs',
  '#minecraft:slabs', '#minecraft:fences', '#minecraft:doors', '#minecraft:wool',
  '#minecraft:flowers', '#minecraft:tall_flowers', '#minecraft:saplings',
  '#minecraft:crops', '#minecraft:signs', '#minecraft:beds', '#minecraft:banners',
  '#minecraft:candles', '#minecraft:buttons', '#minecraft:pressure_plates',
  '#minecraft:ice', '#minecraft:sand', '#minecraft:dirt',
  '#minecraft:base_stone_overworld', '#minecraft:base_stone_nether',
  '#minecraft:gold_ores', '#minecraft:iron_ores', '#minecraft:diamond_ores',
  '#minecraft:coal_ores', '#minecraft:copper_ores', '#minecraft:emerald_ores',
  '#minecraft:lapis_ores', '#minecraft:redstone_ores', '#minecraft:stone_bricks',
  '#minecraft:walls', '#minecraft:trapdoors', '#minecraft:coral_blocks',
  '#minecraft:fire',
]);

function isValidBlockTag(tag) {
  return VALID_BLOCK_TAGS.has(tag);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Validation
  isValidBlock, isValidItem, isValidEntity, isValidEffect, isValidEnchantment,
  isValidBlockTag, qualify,
  // Fuzzy matching
  findClosestBlock, levenshtein,
  // Lookups
  getLocateTargets, getTreeFeatures, getBlockGroups, getStructures, getBlockRenames,
  // Raw sets (for advanced use)
  blocks, items, entities, effects, enchantments,
  // Raw reference (escape hatch)
  REF,
  // Constants
  OFFICIAL_RENAMES, VALID_BLOCK_TAGS,
};
