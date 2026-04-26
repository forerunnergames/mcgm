// Block name normalization for Minecraft commands.
// Only operates on block-category commands (fill, setblock, place).
// Uses the registry for validation and fuzzy matching.

'use strict';

const { classify, needsBlockNormalization } = require('./command');
const registry = require('./registry');

/**
 * Normalize block names in a raw command string.
 * Only modifies block-category commands. All other commands pass through untouched.
 *
 * @param {string} raw - Raw command string
 * @returns {{ normalized: string, corrections: string[], invalid: boolean }}
 */
function normalizeCommand(raw) {
  const cmd = classify(raw);
  const corrections = [];

  // Only normalize block-category commands
  if (!needsBlockNormalization(cmd)) {
    return { normalized: raw, corrections, invalid: false };
  }

  let invalid = false;
  let result = raw;

  // Fix block tags (e.g. #minecraft:poppys → #minecraft:flowers)
  result = result.replace(/#minecraft:[a-z_0-9]+/g, (match) => {
    if (registry.isValidBlockTag(match)) return match;
    // Try plural stripping
    const stripped = match.replace(/s$/, '').replace(/es$/, '');
    if (registry.isValidBlockTag(stripped)) {
      corrections.push(`tag ${match} → ${stripped}`);
      return stripped;
    }
    corrections.push(`invalid tag ${match}`);
    invalid = true;
    return match;
  });

  // Fix block IDs (not tags)
  result = result.replace(/(?<!#)minecraft:[a-z_0-9]+/g, (match) => {
    if (registry.isValidBlock(match)) return match;
    if (match === 'minecraft:air') return match;
    const corrected = registry.findClosestBlock(match);
    if (corrected) {
      corrections.push(`${match} → ${corrected}`);
      return corrected;
    }
    return match;
  });

  return { normalized: result, corrections, invalid };
}

/**
 * Normalize an array of command strings.
 * Returns normalized commands with a summary of corrections and rejections.
 *
 * @param {string[]} commands
 * @returns {{ commands: string[], corrections: string[], rejected: Array<{cmd: string, reason: string}> }}
 */
function normalizeCommands(commands) {
  const result = [];
  const allCorrections = [];
  const rejected = [];

  for (const raw of commands) {
    const { normalized, corrections, invalid } = normalizeCommand(raw);
    if (invalid) {
      rejected.push({ cmd: raw.slice(0, 80), reason: 'invalid block tag' });
      continue;
    }
    result.push(normalized);
    allCorrections.push(...corrections);
  }

  if (allCorrections.length > 0) {
    console.log(`[normalize] corrections: ${allCorrections.join(', ')}`);
  }

  return { commands: result, corrections: allCorrections, rejected };
}

module.exports = { normalizeCommand, normalizeCommands };
