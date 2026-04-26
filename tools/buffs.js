// Buff and debuff system �� predefined effect combos with levels 1-5.
// "max buff Player1" = hard to kill. "max debuff Player2" = mining fatigue, 1/2 heart.

'use strict';

const server = require('../server');

// ============================================================================
// Buff/debuff definitions
// ============================================================================

// Each entry: array of { effect, duration, amplifier, hideParticles }
// Duration "infinite" = infinite, number = seconds
// Amplifier: 0 = level 1, 4 = level 5

const BUFFS = {
  5: {
    description: 'Max buff — near-invincible',
    effects: [
      { effect: 'resistance', amplifier: 3, duration: 'infinite' },         // 80% damage reduction
      { effect: 'fire_resistance', amplifier: 0, duration: 'infinite' },
      { effect: 'regeneration', amplifier: 3, duration: 'infinite' },       // rapid regen
      { effect: 'strength', amplifier: 1, duration: 'infinite' },           // +6 attack damage
      { effect: 'speed', amplifier: 1, duration: 'infinite' },              // +40% speed
      { effect: 'absorption', amplifier: 4, duration: 'infinite' },         // 20 extra hearts
      { effect: 'saturation', amplifier: 0, duration: 'infinite' },         // never hungry
      { effect: 'night_vision', amplifier: 0, duration: 'infinite' },
    ],
    maxHealth: 40, // 20 hearts
  },
  4: {
    description: 'Strong buff — very tanky',
    effects: [
      { effect: 'resistance', amplifier: 2, duration: 'infinite' },         // 60% damage reduction
      { effect: 'fire_resistance', amplifier: 0, duration: 'infinite' },
      { effect: 'regeneration', amplifier: 1, duration: 'infinite' },
      { effect: 'strength', amplifier: 0, duration: 'infinite' },
      { effect: 'speed', amplifier: 0, duration: 'infinite' },
      { effect: 'absorption', amplifier: 2, duration: 'infinite' },
    ],
    maxHealth: 30,
  },
  3: {
    description: 'Medium buff — solid advantage',
    effects: [
      { effect: 'resistance', amplifier: 1, duration: 'infinite' },
      { effect: 'regeneration', amplifier: 0, duration: 'infinite' },
      { effect: 'strength', amplifier: 0, duration: 'infinite' },
      { effect: 'speed', amplifier: 0, duration: 'infinite' },
    ],
    maxHealth: 20,
  },
  2: {
    description: 'Light buff — minor advantage',
    effects: [
      { effect: 'resistance', amplifier: 0, duration: 'infinite' },
      { effect: 'regeneration', amplifier: 0, duration: 300 },
      { effect: 'speed', amplifier: 0, duration: 'infinite' },
    ],
    maxHealth: 20,
  },
  1: {
    description: 'Minimal buff — barely noticeable',
    effects: [
      { effect: 'speed', amplifier: 0, duration: 300 },
      { effect: 'regeneration', amplifier: 0, duration: 120 },
    ],
    maxHealth: 20,
  },
};

const DEBUFFS = {
  5: {
    description: 'Max debuff — practically helpless',
    effects: [
      { effect: 'mining_fatigue', amplifier: 4, duration: 'infinite' },     // can barely break blocks
      { effect: 'slowness', amplifier: 3, duration: 'infinite' },           // crawling speed
      { effect: 'weakness', amplifier: 4, duration: 'infinite' },           // no attack damage
      { effect: 'hunger', amplifier: 4, duration: 'infinite' },             // starving fast
      { effect: 'poison', amplifier: 0, duration: 'infinite' },             // constant damage
      { effect: 'blindness', amplifier: 0, duration: 'infinite' },          // can't see
      { effect: 'darkness', amplifier: 0, duration: 'infinite' },
    ],
    maxHealth: 1, // half a heart
  },
  4: {
    description: 'Strong debuff — very weak',
    effects: [
      { effect: 'mining_fatigue', amplifier: 3, duration: 'infinite' },
      { effect: 'slowness', amplifier: 2, duration: 'infinite' },
      { effect: 'weakness', amplifier: 2, duration: 'infinite' },
      { effect: 'hunger', amplifier: 2, duration: 'infinite' },
      { effect: 'poison', amplifier: 0, duration: 300 },
    ],
    maxHealth: 4, // 2 hearts
  },
  3: {
    description: 'Medium debuff — significant disadvantage',
    effects: [
      { effect: 'mining_fatigue', amplifier: 1, duration: 'infinite' },
      { effect: 'slowness', amplifier: 1, duration: 'infinite' },
      { effect: 'weakness', amplifier: 1, duration: 'infinite' },
      { effect: 'hunger', amplifier: 1, duration: 'infinite' },
    ],
    maxHealth: 10, // 5 hearts
  },
  2: {
    description: 'Light debuff — minor disadvantage',
    effects: [
      { effect: 'mining_fatigue', amplifier: 0, duration: 'infinite' },
      { effect: 'slowness', amplifier: 0, duration: 'infinite' },
      { effect: 'weakness', amplifier: 0, duration: 300 },
    ],
    maxHealth: 14,
  },
  1: {
    description: 'Minimal debuff — annoying',
    effects: [
      { effect: 'slowness', amplifier: 0, duration: 300 },
      { effect: 'mining_fatigue', amplifier: 0, duration: 300 },
    ],
    maxHealth: 20,
  },
};

// ============================================================================
// Apply / Clear
// ============================================================================

async function applyBuff(player, level = 5) {
  const buff = BUFFS[level] || BUFFS[5];
  return applyEffectSet(player, buff, `buff_${level}`);
}

async function applyDebuff(player, level = 5) {
  const debuff = DEBUFFS[level] || DEBUFFS[5];
  return applyEffectSet(player, debuff, `debuff_${level}`);
}

async function applyEffectSet(player, set, label) {
  const cmds = [];

  for (const e of set.effects) {
    const dur = e.duration === 'infinite' ? 'infinite' : e.duration;
    cmds.push(`effect give ${player} minecraft:${e.effect} ${dur} ${e.amplifier} true`);
  }

  if (set.maxHealth && set.maxHealth !== 20) {
    cmds.push(`attribute ${player} minecraft:max_health base set ${set.maxHealth}`);
  }

  const result = await server.executeBatch(cmds);
  return {
    ok: result.ok,
    label,
    description: set.description,
    effects_applied: set.effects.length,
    max_health: set.maxHealth || 20,
    player,
    errors: result.errors,
  };
}

async function clearEffects(player) {
  const cmds = [
    `effect clear ${player}`,
    `attribute ${player} minecraft:max_health base set 20`,
  ];
  const result = await server.executeBatch(cmds);
  return { ok: result.ok, player, cleared: true };
}

// ============================================================================
// Tool schema
// ============================================================================

const schema = {
  name: 'buff_debuff',
  description: 'Apply predefined buff or debuff combos to players. Buffs make players tanky (resistance, regen, strength). Debuffs make players weak (mining fatigue, slowness, low HP). Levels 1-5, where 5 is maximum. "clear" removes all effects and resets HP. Use when asked to buff, debuff, make invincible, make weak, nerf, or boost a player.',
  input_schema: {
    type: 'object',
    properties: {
      player: { type: 'string', description: 'Player name' },
      type: { type: 'string', enum: ['buff', 'debuff', 'clear'], description: 'buff, debuff, or clear all effects' },
      level: { type: 'integer', description: 'Intensity 1-5 (5=max). Default 5.' },
    },
    required: ['player', 'type'],
  },
};

async function execute(input) {
  const { player, type, level = 5 } = input;
  switch (type) {
    case 'buff': return applyBuff(player, level);
    case 'debuff': return applyDebuff(player, level);
    case 'clear': return clearEffects(player);
    default: return { ok: false, error: `Unknown type: ${type}` };
  }
}

module.exports = { schema, execute, BUFFS, DEBUFFS, applyBuff, applyDebuff, clearEffects };
