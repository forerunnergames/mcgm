// Kit system — predefined gear loadouts with levels 1-5 and scenario variants.
// Kits are data-driven: define items per slot, apply/strip/replace cleanly.
// Only touches slots defined in the kit — doesn't clear entire inventory.

'use strict';

const server = require('../server');

// ============================================================================
// Slot definitions
// ============================================================================

// All equipment slots the kit system manages
const ALL_SLOTS = [
  'armor.head', 'armor.chest', 'armor.legs', 'armor.feet',
  'weapon.mainhand', 'weapon.offhand',
  'hotbar.0', 'hotbar.1', 'hotbar.2', 'hotbar.3', 'hotbar.4',
  'hotbar.5', 'hotbar.6', 'hotbar.7', 'hotbar.8',
];

// ============================================================================
// Helper: enchantment string builder
// ============================================================================

function ench(base, enchants) {
  if (!enchants || Object.keys(enchants).length === 0) return base;
  const pairs = Object.entries(enchants).map(([k, v]) => `"minecraft:${k}":${v}`);
  return `${base}[minecraft:enchantments={${pairs.join(',')}}]`;
}

// Max enchant sets for reuse
const MAX_ARMOR_ENCH = { protection: 4, unbreaking: 3, mending: 1, thorns: 3 };
const MAX_HELMET_ENCH = { ...MAX_ARMOR_ENCH, respiration: 3, aqua_affinity: 1 };
const MAX_BOOTS_ENCH = { ...MAX_ARMOR_ENCH, feather_falling: 4, depth_strider: 3, soul_speed: 3 };
const MAX_LEGGINGS_ENCH = { ...MAX_ARMOR_ENCH, swift_sneak: 3 };
const MAX_SWORD_ENCH = { sharpness: 5, unbreaking: 3, mending: 1, looting: 3, fire_aspect: 2, knockback: 2, sweeping_edge: 3 };
const MAX_PICK_ENCH = { efficiency: 5, unbreaking: 3, mending: 1, fortune: 3 };
const MAX_AXE_ENCH = { efficiency: 5, unbreaking: 3, mending: 1, sharpness: 5 };
const MAX_BOW_ENCH = { power: 5, punch: 2, flame: 1, infinity: 1, unbreaking: 3 };
const MAX_TRIDENT_ENCH = { loyalty: 3, unbreaking: 3, mending: 1, channeling: 1 };

// ============================================================================
// Kit definitions
// ============================================================================

const KITS = {
  // === MAX KIT — everything maxed ===
  max: {
    description: 'Maximum everything — full netherite, elytra, weapons, consumables',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', MAX_HELMET_ENCH),
      'armor.chest':    ench('minecraft:elytra', { unbreaking: 3, mending: 1 }),
      'armor.legs':     ench('minecraft:netherite_leggings', MAX_LEGGINGS_ENCH),
      'armor.feet':     ench('minecraft:netherite_boots', MAX_BOOTS_ENCH),
      'weapon.mainhand': ench('minecraft:netherite_sword', MAX_SWORD_ENCH),
      'weapon.offhand': ench('minecraft:shield', { unbreaking: 3, mending: 1 }),
      'hotbar.1':       ench('minecraft:netherite_pickaxe', MAX_PICK_ENCH),
      'hotbar.2':       ench('minecraft:netherite_axe', MAX_AXE_ENCH),
      'hotbar.3':       ench('minecraft:bow', MAX_BOW_ENCH),
      'hotbar.4':       ench('minecraft:trident', MAX_TRIDENT_ENCH),
      'hotbar.5':       'minecraft:golden_apple 64',
      'hotbar.6':       'minecraft:golden_apple 64',
      'hotbar.7':       'minecraft:ender_pearl 16',
      'hotbar.8':       'minecraft:totem_of_undying',
    },
    // Extra items given via /give (overflow that doesn't fit in slots)
    give: [
      'minecraft:totem_of_undying 7',
      'minecraft:tnt 128',
      'minecraft:end_crystal 128',
      'minecraft:obsidian 64',
      'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 128',
      'minecraft:enchanted_golden_apple 16',
    ],
  },

  // === LEVEL 5 — full netherite, max enchants ===
  5: {
    description: 'Level 5 — full max netherite gear',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', MAX_HELMET_ENCH),
      'armor.chest':    ench('minecraft:netherite_chestplate', MAX_ARMOR_ENCH),
      'armor.legs':     ench('minecraft:netherite_leggings', MAX_LEGGINGS_ENCH),
      'armor.feet':     ench('minecraft:netherite_boots', MAX_BOOTS_ENCH),
      'weapon.mainhand': ench('minecraft:netherite_sword', MAX_SWORD_ENCH),
      'weapon.offhand': ench('minecraft:shield', { unbreaking: 3, mending: 1 }),
      'hotbar.1':       ench('minecraft:netherite_pickaxe', MAX_PICK_ENCH),
      'hotbar.2':       ench('minecraft:bow', MAX_BOW_ENCH),
    },
    give: ['minecraft:golden_apple 16', 'minecraft:totem_of_undying 2'],
  },

  // === LEVEL 4 — diamond, good enchants ===
  4: {
    description: 'Level 4 — enchanted diamond gear',
    slots: {
      'armor.head':     ench('minecraft:diamond_helmet', { protection: 4, unbreaking: 3 }),
      'armor.chest':    ench('minecraft:diamond_chestplate', { protection: 4, unbreaking: 3 }),
      'armor.legs':     ench('minecraft:diamond_leggings', { protection: 4, unbreaking: 3 }),
      'armor.feet':     ench('minecraft:diamond_boots', { protection: 4, unbreaking: 3, feather_falling: 4 }),
      'weapon.mainhand': ench('minecraft:diamond_sword', { sharpness: 5, unbreaking: 3, looting: 3 }),
      'weapon.offhand': 'minecraft:shield',
      'hotbar.1':       ench('minecraft:diamond_pickaxe', { efficiency: 5, unbreaking: 3, fortune: 3 }),
      'hotbar.2':       ench('minecraft:bow', { power: 5, unbreaking: 3 }),
    },
    give: ['minecraft:golden_apple 8'],
  },

  // === LEVEL 3 — iron, basic enchants ===
  3: {
    description: 'Level 3 — enchanted iron gear',
    slots: {
      'armor.head':     ench('minecraft:iron_helmet', { protection: 2, unbreaking: 2 }),
      'armor.chest':    ench('minecraft:iron_chestplate', { protection: 2, unbreaking: 2 }),
      'armor.legs':     ench('minecraft:iron_leggings', { protection: 2, unbreaking: 2 }),
      'armor.feet':     ench('minecraft:iron_boots', { protection: 2, unbreaking: 2 }),
      'weapon.mainhand': ench('minecraft:iron_sword', { sharpness: 3, unbreaking: 2 }),
      'weapon.offhand': 'minecraft:shield',
      'hotbar.1':       ench('minecraft:iron_pickaxe', { efficiency: 3, unbreaking: 2 }),
    },
    give: ['minecraft:cooked_beef 32'],
  },

  // === LEVEL 2 — plain iron ===
  2: {
    description: 'Level 2 — unenchanted iron gear',
    slots: {
      'armor.head':     'minecraft:iron_helmet',
      'armor.chest':    'minecraft:iron_chestplate',
      'armor.legs':     'minecraft:iron_leggings',
      'armor.feet':     'minecraft:iron_boots',
      'weapon.mainhand': 'minecraft:iron_sword',
      'weapon.offhand': 'minecraft:shield',
      'hotbar.1':       'minecraft:iron_pickaxe',
    },
    give: ['minecraft:bread 16'],
  },

  // === LEVEL 1 / MIN — worst gear ===
  1: {
    description: 'Level 1 (min) — leather armor, wooden tools',
    slots: {
      'armor.head':     'minecraft:leather_helmet',
      'armor.chest':    'minecraft:leather_chestplate',
      'armor.legs':     'minecraft:leather_leggings',
      'armor.feet':     'minecraft:leather_boots',
      'weapon.mainhand': 'minecraft:wooden_sword',
      'hotbar.1':       'minecraft:wooden_pickaxe',
    },
    give: ['minecraft:bread 4'],
  },
  min: { alias: '1' },

  // === SCENARIO KITS ===

  'overworld_pvp': {
    description: 'Max overworld PvP — netherite + totems + gapples + crystals',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', MAX_HELMET_ENCH),
      'armor.chest':    ench('minecraft:netherite_chestplate', MAX_ARMOR_ENCH),
      'armor.legs':     ench('minecraft:netherite_leggings', MAX_LEGGINGS_ENCH),
      'armor.feet':     ench('minecraft:netherite_boots', { ...MAX_BOOTS_ENCH, depth_strider: 0 }),
      'weapon.mainhand': ench('minecraft:netherite_sword', MAX_SWORD_ENCH),
      'weapon.offhand': 'minecraft:totem_of_undying',
      'hotbar.1':       ench('minecraft:netherite_axe', MAX_AXE_ENCH),
      'hotbar.2':       'minecraft:end_crystal 64',
      'hotbar.3':       'minecraft:obsidian 64',
      'hotbar.4':       'minecraft:enchanted_golden_apple 64',
      'hotbar.5':       'minecraft:golden_apple 64',
      'hotbar.6':       ench('minecraft:bow', MAX_BOW_ENCH),
      'hotbar.7':       'minecraft:ender_pearl 16',
      'hotbar.8':       'minecraft:totem_of_undying',
    },
    give: ['minecraft:totem_of_undying 6', 'minecraft:end_crystal 64'],
  },

  'underwater': {
    description: 'Max underwater PvP — respiration, depth strider, conduit, trident',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', { ...MAX_HELMET_ENCH, respiration: 3, aqua_affinity: 1 }),
      'armor.chest':    ench('minecraft:netherite_chestplate', MAX_ARMOR_ENCH),
      'armor.legs':     ench('minecraft:netherite_leggings', MAX_LEGGINGS_ENCH),
      'armor.feet':     ench('minecraft:netherite_boots', { ...MAX_ARMOR_ENCH, depth_strider: 3, feather_falling: 4 }),
      'weapon.mainhand': ench('minecraft:trident', { riptide: 3, unbreaking: 3, mending: 1 }),
      'weapon.offhand': 'minecraft:totem_of_undying',
      'hotbar.1':       ench('minecraft:trident', MAX_TRIDENT_ENCH),
      'hotbar.2':       'minecraft:conduit',
      'hotbar.3':       'minecraft:sponge 64',
    },
    give: [
      'minecraft:potion[minecraft:potion_contents={potion:"minecraft:long_water_breathing"}] 8',
      'minecraft:turtle_helmet 1',
      'minecraft:prismarine 64',
    ],
  },

  'lava': {
    description: 'Max lava PvP — fire resistance, netherite, fire protection',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', { fire_protection: 4, unbreaking: 3, mending: 1 }),
      'armor.chest':    ench('minecraft:netherite_chestplate', { fire_protection: 4, unbreaking: 3, mending: 1 }),
      'armor.legs':     ench('minecraft:netherite_leggings', { fire_protection: 4, unbreaking: 3, mending: 1 }),
      'armor.feet':     ench('minecraft:netherite_boots', { fire_protection: 4, unbreaking: 3, mending: 1, feather_falling: 4 }),
      'weapon.mainhand': ench('minecraft:netherite_sword', { fire_aspect: 2, sharpness: 5, unbreaking: 3, mending: 1 }),
      'weapon.offhand': 'minecraft:totem_of_undying',
      'hotbar.1':       ench('minecraft:netherite_pickaxe', MAX_PICK_ENCH),
      'hotbar.2':       'minecraft:enchanted_golden_apple 64',
    },
    give: [
      'minecraft:potion[minecraft:potion_contents={potion:"minecraft:long_fire_resistance"}] 8',
      'minecraft:totem_of_undying 4',
    ],
  },

  'elytra': {
    description: 'Elytra flight kit — elytra + fireworks + gear',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', MAX_HELMET_ENCH),
      'armor.chest':    ench('minecraft:elytra', { unbreaking: 3, mending: 1 }),
      'armor.legs':     ench('minecraft:netherite_leggings', MAX_LEGGINGS_ENCH),
      'armor.feet':     ench('minecraft:netherite_boots', MAX_BOOTS_ENCH),
      'weapon.mainhand': ench('minecraft:netherite_sword', MAX_SWORD_ENCH),
      'weapon.offhand': 'minecraft:totem_of_undying',
      'hotbar.1':       'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 64',
      'hotbar.2':       'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 64',
      'hotbar.3':       'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 64',
      'hotbar.4':       'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 64',
      'hotbar.5':       'minecraft:ender_pearl 16',
    },
  },

  'nether': {
    description: 'Nether survival — fire resistance, gold armor piece, soul speed',
    slots: {
      'armor.head':     ench('minecraft:netherite_helmet', { fire_protection: 4, unbreaking: 3, mending: 1 }),
      'armor.chest':    ench('minecraft:netherite_chestplate', { protection: 4, unbreaking: 3, mending: 1 }),
      'armor.legs':     ench('minecraft:netherite_leggings', { protection: 4, unbreaking: 3, mending: 1 }),
      'armor.feet':     ench('minecraft:netherite_boots', { fire_protection: 4, unbreaking: 3, mending: 1, soul_speed: 3 }),
      'weapon.mainhand': ench('minecraft:netherite_sword', MAX_SWORD_ENCH),
      'weapon.offhand': ench('minecraft:shield', { unbreaking: 3, mending: 1 }),
      'hotbar.1':       ench('minecraft:netherite_pickaxe', MAX_PICK_ENCH),
      'hotbar.2':       ench('minecraft:bow', MAX_BOW_ENCH),
    },
    give: [
      'minecraft:potion[minecraft:potion_contents={potion:"minecraft:long_fire_resistance"}] 4',
      'minecraft:golden_apple 16',
      'minecraft:totem_of_undying 2',
    ],
  },
};

// ============================================================================
// Resolve kit name (handles aliases, level numbers, fuzzy matching)
// ============================================================================

function resolveKit(name) {
  const lower = String(name).toLowerCase().trim();

  // Direct match
  if (KITS[lower]) {
    const kit = KITS[lower];
    if (kit.alias) return KITS[kit.alias];
    return kit;
  }

  // Number
  if (KITS[parseInt(lower)]) return KITS[parseInt(lower)];

  // Common aliases
  const ALIASES = {
    'maximum': 'max', 'minimum': 'min', 'worst': '1', 'best': 'max',
    'pvp': 'overworld_pvp', 'overworld pvp': 'overworld_pvp', 'max pvp': 'overworld_pvp',
    'water': 'underwater', 'ocean': 'underwater', 'aqua': 'underwater',
    'fire': 'lava', 'magma': 'lava', 'lava pvp': 'lava',
    'fly': 'elytra', 'flight': 'elytra', 'flying': 'elytra',
    'hell': 'nether', 'nether pvp': 'nether',
    'level 1': '1', 'level 2': '2', 'level 3': '3', 'level 4': '4', 'level 5': '5',
    'lvl 1': '1', 'lvl 2': '2', 'lvl 3': '3', 'lvl 4': '4', 'lvl 5': '5',
    'tier 1': '1', 'tier 2': '2', 'tier 3': '3', 'tier 4': '4', 'tier 5': '5',
  };
  if (ALIASES[lower]) return resolveKit(ALIASES[lower]);

  // Fuzzy — check if any kit name is contained in the input
  for (const [key, kit] of Object.entries(KITS)) {
    if (kit.alias) continue;
    if (lower.includes(key) || key.includes(lower)) return kit;
  }

  return null;
}

// ============================================================================
// Apply / Strip / Replace kit
// ============================================================================

/**
 * Apply a kit to a player. Only touches slots defined in the kit.
 */
async function applyKit(player, kitName) {
  const kit = resolveKit(kitName);
  if (!kit) {
    return { ok: false, error: `Unknown kit "${kitName}". Available: ${listKitNames().join(', ')}` };
  }

  const cmds = [];

  // Equip slot items
  for (const [slot, itemData] of Object.entries(kit.slots || {})) {
    const parts = itemData.split(' ');
    if (parts.length > 1) {
      cmds.push(`item replace entity ${player} ${slot} with ${parts[0]} ${parts[1]}`);
    } else {
      cmds.push(`item replace entity ${player} ${slot} with ${itemData}`);
    }
  }

  const result = await server.executeBatch(cmds);

  // Give overflow items
  if (kit.give) {
    for (const item of kit.give) {
      await server.runCommand(`give ${player} ${item}`);
    }
  }

  return {
    ok: result.ok,
    kit: kitName,
    description: kit.description,
    slots_equipped: Object.keys(kit.slots || {}).length,
    items_given: (kit.give || []).length,
    player,
    errors: result.errors,
  };
}

/**
 * Strip a kit from a player. Only clears slots that the kit uses.
 */
async function stripKit(player, kitName) {
  const kit = resolveKit(kitName);
  if (!kit) {
    return { ok: false, error: `Unknown kit "${kitName}".` };
  }

  const cmds = [];
  for (const slot of Object.keys(kit.slots || {})) {
    cmds.push(`item replace entity ${player} ${slot} with minecraft:air`);
  }

  const result = await server.executeBatch(cmds);
  return {
    ok: result.ok,
    kit: kitName,
    slots_cleared: Object.keys(kit.slots || {}).length,
    player,
  };
}

/**
 * Replace one kit with another. Strips the old kit's slots, then applies the new one.
 */
async function replaceKit(player, oldKitName, newKitName) {
  const stripResult = await stripKit(player, oldKitName);
  if (!stripResult.ok) return stripResult;
  return applyKit(player, newKitName);
}

/**
 * Strip ALL equipment from a player (all slots).
 */
async function stripAll(player) {
  const cmds = ALL_SLOTS.map(slot => `item replace entity ${player} ${slot} with minecraft:air`);
  cmds.push(`clear ${player}`);
  const result = await server.executeBatch(cmds);
  return { ok: result.ok, player, slots_cleared: ALL_SLOTS.length };
}

function listKitNames() {
  return Object.keys(KITS).filter(k => !KITS[k].alias);
}

// ============================================================================
// Tool schema
// ============================================================================

const schema = {
  name: 'kit',
  description: 'Apply, strip, or replace predefined gear kits on players. Kits only touch their own slots — they don\'t clear the entire inventory. Available kits: max (elytra+netherite+consumables), 5 (full netherite), 4 (diamond), 3 (iron+enchants), 2 (iron), 1/min (leather+wood), overworld_pvp, underwater, lava, elytra, nether. Use action "apply" to give, "strip" to remove, "replace" to swap, "strip_all" to clear everything.',
  input_schema: {
    type: 'object',
    properties: {
      player: { type: 'string', description: 'Player name' },
      action: { type: 'string', enum: ['apply', 'strip', 'replace', 'strip_all'], description: 'What to do. Default: apply.' },
      kit: { type: 'string', description: 'Kit name: max, 5, 4, 3, 2, 1, min, overworld_pvp, underwater, lava, elytra, nether' },
      old_kit: { type: 'string', description: 'For "replace" action: the kit currently equipped (to strip first)' },
    },
    required: ['player'],
  },
};

async function execute(input) {
  const { player, action = 'apply', kit, old_kit } = input;
  switch (action) {
    case 'strip_all': return stripAll(player);
    case 'strip': return stripKit(player, kit || 'max');
    case 'replace': return replaceKit(player, old_kit || kit || 'max', kit || 'max');
    case 'apply':
    default: return applyKit(player, kit || 'max');
  }
}

module.exports = { schema, execute, KITS, resolveKit, applyKit, stripKit, replaceKit, stripAll };
