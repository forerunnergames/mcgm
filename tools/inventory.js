// General inventory management — read, write, fill, clear individual slots.
// No special cases. One system that handles all inventory operations.

'use strict';

const server = require('../server');

// ============================================================================
// Slot mapping — Minecraft SNBT slot numbers ↔ named slots
// ============================================================================

// SNBT Inventory data uses numeric slot IDs:
//   0-8 = hotbar, 9-35 = main inventory, 100=feet, 101=legs, 102=chest, 103=head, -106=offhand
const SNBT_TO_NAMED = {};
for (let i = 0; i <= 8; i++) SNBT_TO_NAMED[i] = `hotbar.${i}`;
for (let i = 9; i <= 35; i++) SNBT_TO_NAMED[i] = `inventory.${i - 9}`;
SNBT_TO_NAMED[100] = 'armor.feet';
SNBT_TO_NAMED[101] = 'armor.legs';
SNBT_TO_NAMED[102] = 'armor.chest';
SNBT_TO_NAMED[103] = 'armor.head';
SNBT_TO_NAMED[-106] = 'weapon.offhand';

// All manageable slots in order
const ALL_SLOTS = [
  'armor.head', 'armor.chest', 'armor.legs', 'armor.feet',
  'weapon.mainhand', 'weapon.offhand',
  ...Array.from({ length: 9 }, (_, i) => `hotbar.${i}`),
  ...Array.from({ length: 27 }, (_, i) => `inventory.${i}`),
];

// Slot groups for convenience
const SLOT_GROUPS = {
  armor: ['armor.head', 'armor.chest', 'armor.legs', 'armor.feet'],
  hotbar: Array.from({ length: 9 }, (_, i) => `hotbar.${i}`),
  inventory: Array.from({ length: 27 }, (_, i) => `inventory.${i}`),
  weapons: ['weapon.mainhand', 'weapon.offhand'],
  all: ALL_SLOTS,
};

// ============================================================================
// Read inventory
// ============================================================================

/**
 * Read a player's full inventory. Returns a map of slot → item ID.
 */
async function readInventory(player) {
  const result = await server.runCommand(
    `data get entity ${player} Inventory`,
    { captureOutput: true, waitMs: 1000 },
  );
  if (!result.ok) return { ok: false, error: result.error };

  const output = result.output || '';
  // Parse SNBT inventory data: [{Slot: 0b, count: 1, id: "minecraft:diamond_sword"}, ...]
  const occupied = {};
  // Match each item entry — handles various SNBT formats
  const itemRe = /Slot:\s*(-?\d+)b[^}]*?id:\s*"([^"]+)"/g;
  let m;
  while ((m = itemRe.exec(output)) !== null) {
    const slotNum = parseInt(m[1]);
    const itemId = m[2];
    const namedSlot = SNBT_TO_NAMED[slotNum];
    if (namedSlot) {
      occupied[namedSlot] = itemId;
    }
  }

  // Also check mainhand via a separate query since it's not in Inventory[]
  // Actually mainhand IS hotbar.0 selected — but SelectedItem is separate.
  // For our purposes, Inventory covers everything.

  return { ok: true, player, slots: occupied, empty: ALL_SLOTS.filter(s => !occupied[s]) };
}

// ============================================================================
// Inventory operations
// ============================================================================

/**
 * Set specific slots to specific items. Overwrites whatever is there.
 */
async function setSlots(player, slotItems) {
  const cmds = [];
  for (const [slot, item] of Object.entries(slotItems)) {
    const parts = item.split(' ');
    if (parts.length > 1) {
      cmds.push(`item replace entity ${player} ${slot} with ${parts[0]} ${parts[1]}`);
    } else {
      cmds.push(`item replace entity ${player} ${slot} with ${item}`);
    }
  }
  return server.executeBatch(cmds);
}

/**
 * Clear specific slots (set to air).
 */
async function clearSlots(player, slots) {
  const cmds = slots.map(slot => `item replace entity ${player} ${slot} with minecraft:air`);
  return server.executeBatch(cmds);
}

/**
 * Fill ONLY empty slots with items. Reads inventory first, skips occupied slots.
 * @param {string} player
 * @param {string|string[]} items — single item ID for all slots, or array to cycle through
 * @param {string[]} targetSlots — which slots to consider (default: hotbar + inventory)
 */
async function fillEmpty(player, items, targetSlots) {
  const inv = await readInventory(player);
  if (!inv.ok) return inv;

  const slots = targetSlots || [...SLOT_GROUPS.hotbar, ...SLOT_GROUPS.inventory];
  const emptySlots = slots.filter(s => !inv.slots[s]);

  if (emptySlots.length === 0) {
    return { ok: true, player, filled: 0, note: 'No empty slots' };
  }

  const itemList = Array.isArray(items) ? items : [items];
  const cmds = [];
  for (let i = 0; i < emptySlots.length; i++) {
    const item = itemList[i % itemList.length];
    const parts = item.split(' ');
    if (parts.length > 1) {
      cmds.push(`item replace entity ${player} ${emptySlots[i]} with ${parts[0]} ${parts[1]}`);
    } else {
      cmds.push(`item replace entity ${player} ${emptySlots[i]} with ${item}`);
    }
  }

  const result = await server.executeBatch(cmds);
  return { ok: result.ok, player, filled: emptySlots.length, slots_filled: emptySlots, errors: result.errors };
}

/**
 * Remove specific items from inventory (by item ID). Uses /clear.
 */
async function removeItems(player, itemId, count) {
  const qualified = itemId.includes(':') ? itemId : `minecraft:${itemId}`;
  const countStr = count ? ` ${count}` : '';
  return server.runCommand(`clear ${player} ${qualified}${countStr}`);
}

/**
 * Clear ALL inventory and equipment.
 */
async function clearAll(player) {
  const cmds = ALL_SLOTS.map(slot => `item replace entity ${player} ${slot} with minecraft:air`);
  cmds.push(`clear ${player}`);
  return server.executeBatch(cmds);
}

// ============================================================================
// Junk items — random useless items for filling inventory
// ============================================================================

const JUNK_ITEMS = [
  'minecraft:poisonous_potato', 'minecraft:rotten_flesh', 'minecraft:spider_eye',
  'minecraft:fermented_spider_eye', 'minecraft:dead_bush', 'minecraft:cobweb',
  'minecraft:bone', 'minecraft:string', 'minecraft:gunpowder', 'minecraft:slime_ball',
  'minecraft:ink_sac', 'minecraft:feather', 'minecraft:flint', 'minecraft:clay_ball',
  'minecraft:snowball', 'minecraft:leather', 'minecraft:rabbit_foot',
  'minecraft:chorus_fruit', 'minecraft:beetroot_seeds', 'minecraft:pumpkin_seeds',
  'minecraft:nautilus_shell', 'minecraft:phantom_membrane', 'minecraft:kelp',
  'minecraft:gravel', 'minecraft:dirt', 'minecraft:sand', 'minecraft:diorite',
  'minecraft:andesite', 'minecraft:granite', 'minecraft:cobblestone',
];

function randomJunk() {
  return JUNK_ITEMS[Math.floor(Math.random() * JUNK_ITEMS.length)];
}

// ============================================================================
// Tool schema
// ============================================================================

const schema = {
  name: 'inventory',
  description: `Manage player inventory — read contents, fill empty slots, set specific slots, clear slots, or remove items. Actions:
- "read" — see what's in a player's inventory
- "fill_empty" — fill only empty slots with items (doesn't overwrite existing gear). Use items=["minecraft:poisonous_potato"] for junk, or any item list.
- "fill_junk" — fill empty slots with random junk items
- "set" — set specific named slots to items (overwrites)
- "clear_slots" — clear specific slots to air
- "clear_all" — wipe entire inventory
- "remove" — remove specific item type by ID (uses /clear)
Slots: armor.head/chest/legs/feet, weapon.mainhand/offhand, hotbar.0-8, inventory.0-26. Groups: "armor", "hotbar", "inventory", "weapons", "all".`,
  input_schema: {
    type: 'object',
    properties: {
      player: { type: 'string', description: 'Player name' },
      action: {
        type: 'string',
        enum: ['read', 'fill_empty', 'fill_junk', 'set', 'clear_slots', 'clear_all', 'remove'],
        description: 'What to do',
      },
      items: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'For fill_empty: item ID(s) to fill with. For remove: item ID to remove.',
      },
      slots: {
        oneOf: [
          { type: 'string', description: 'Slot group name: "armor", "hotbar", "inventory", "weapons", "all"' },
          { type: 'array', items: { type: 'string' }, description: 'Specific slot names' },
        ],
        description: 'Target slots. For set: object of {slot: item}. For clear_slots: array of slots. For fill_empty: which slots to fill.',
      },
      slot_items: {
        type: 'object',
        description: 'For "set" action: map of slot name → item ID. Example: {"hotbar.0": "minecraft:diamond_sword", "armor.head": "minecraft:leather_helmet"}',
      },
      count: { type: 'integer', description: 'For "remove": how many to remove' },
    },
    required: ['player', 'action'],
  },
};

async function execute(input) {
  const { player, action } = input;

  // Resolve slot list from string group name or array
  function resolveSlots(s) {
    if (!s) return null;
    if (typeof s === 'string') return SLOT_GROUPS[s] || [s];
    return s;
  }

  switch (action) {
    case 'read':
      return readInventory(player);

    case 'fill_empty': {
      const items = input.items || ['minecraft:cobblestone'];
      const itemList = Array.isArray(items) ? items : [items];
      return fillEmpty(player, itemList, resolveSlots(input.slots));
    }

    case 'fill_junk': {
      // Generate a unique random junk item per slot
      const inv = await readInventory(player);
      if (!inv.ok) return inv;
      const slots = resolveSlots(input.slots) || [...SLOT_GROUPS.hotbar, ...SLOT_GROUPS.inventory];
      const emptySlots = slots.filter(s => !inv.slots[s]);
      if (emptySlots.length === 0) return { ok: true, player, filled: 0, note: 'No empty slots' };
      const junkItems = emptySlots.map(() => randomJunk());
      return fillEmpty(player, junkItems, slots);
    }

    case 'set':
      if (!input.slot_items) return { ok: false, error: 'slot_items required for set action' };
      return setSlots(player, input.slot_items);

    case 'clear_slots': {
      const slots = resolveSlots(input.slots);
      if (!slots) return { ok: false, error: 'slots required for clear_slots action' };
      return clearSlots(player, slots);
    }

    case 'clear_all':
      return clearAll(player);

    case 'remove': {
      const item = Array.isArray(input.items) ? input.items[0] : input.items;
      if (!item) return { ok: false, error: 'items required for remove action' };
      return removeItems(player, item, input.count);
    }

    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

module.exports = {
  schema, execute,
  readInventory, setSlots, clearSlots, fillEmpty, removeItems, clearAll,
  ALL_SLOTS, SLOT_GROUPS, JUNK_ITEMS,
};
