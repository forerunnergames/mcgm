// General command fixer — corrects common mistakes in ANY Minecraft command.
// Runs on all commands (including run_command fallback) before they hit the server.
// Separate from normalize.js which only handles block names in fill/setblock.

'use strict';

// Paper 26.1.1 attribute renames — "generic." prefix was dropped
const ATTRIBUTE_RENAMES = {
  'minecraft:generic.max_health': 'minecraft:max_health',
  'minecraft:generic.follow_range': 'minecraft:follow_range',
  'minecraft:generic.knockback_resistance': 'minecraft:knockback_resistance',
  'minecraft:generic.movement_speed': 'minecraft:movement_speed',
  'minecraft:generic.flying_speed': 'minecraft:flying_speed',
  'minecraft:generic.attack_damage': 'minecraft:attack_damage',
  'minecraft:generic.attack_knockback': 'minecraft:attack_knockback',
  'minecraft:generic.attack_speed': 'minecraft:attack_speed',
  'minecraft:generic.armor': 'minecraft:armor',
  'minecraft:generic.armor_toughness': 'minecraft:armor_toughness',
  'minecraft:generic.luck': 'minecraft:luck',
  'generic.max_health': 'minecraft:max_health',
  'generic.movement_speed': 'minecraft:movement_speed',
  'generic.attack_damage': 'minecraft:attack_damage',
  'generic.armor': 'minecraft:armor',
};

// Common entity name mistakes
const ENTITY_FIXES = {
  'minecraft:lightning': 'minecraft:lightning_bolt',
  'minecraft:xp_orb': 'minecraft:experience_orb',
  'minecraft:ender_dragon': 'minecraft:ender_dragon', // correct, just ensuring
  'minecraft:iron_golem': 'minecraft:iron_golem',
  'minecraft:snow_golem': 'minecraft:snow_golem',
};

// Common effect name mistakes (mostly pre-1.20 names)
const EFFECT_FIXES = {
  'minecraft:health_boost': 'minecraft:health_boost',
  'minecraft:instant_damage': 'minecraft:instant_damage',
  'minecraft:instant_health': 'minecraft:instant_health',
  'minecraft:jump_boost': 'minecraft:jump_boost',
  'minecraft:nausea': 'minecraft:nausea',
};

/**
 * Fix common mistakes in any Minecraft command.
 * This is lightweight and runs on every command — it only does string replacements
 * for known renames, not fuzzy matching.
 *
 * @param {string} cmd - Raw command string
 * @returns {string} Fixed command string
 */
function fixCommand(cmd) {
  let fixed = cmd;

  // Fix old attribute names (generic.xxx → xxx)
  for (const [old, replacement] of Object.entries(ATTRIBUTE_RENAMES)) {
    if (fixed.includes(old)) {
      fixed = fixed.replace(old, replacement);
    }
  }

  // Fix entity names in summon commands
  if (/^(execute .+ run )?summon /.test(fixed)) {
    for (const [old, replacement] of Object.entries(ENTITY_FIXES)) {
      if (fixed.includes(old)) {
        fixed = fixed.replace(old, replacement);
      }
    }
  }

  // Auto-upgrade plain firework_rocket to distance 3 (nobody wants distance 1 with elytra)
  if (fixed.includes('minecraft:firework_rocket') && !fixed.includes('flight_duration')) {
    fixed = fixed.replace(
      /minecraft:firework_rocket(?!\[)/g,
      'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}]',
    );
  }

  // Ensure minecraft: prefix on effect names in effect commands
  const effectMatch = fixed.match(/^((?:execute .+ run )?effect (?:give|clear) \S+ )([a-z_]+)(\s|$)/);
  if (effectMatch && !effectMatch[2].includes(':')) {
    fixed = fixed.replace(effectMatch[2], `minecraft:${effectMatch[2]}`);
  }

  return fixed;
}

module.exports = { fixCommand, ATTRIBUTE_RENAMES, ENTITY_FIXES };
