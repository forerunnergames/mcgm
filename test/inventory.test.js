const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ALL_SLOTS, SLOT_GROUPS, JUNK_ITEMS } = require('../tools/inventory');

describe('inventory slot mapping', () => {
  it('ALL_SLOTS has 42 slots', () => {
    // 4 armor + 2 weapon + 9 hotbar + 27 inventory = 42
    assert.equal(ALL_SLOTS.length, 42);
  });

  it('slot groups cover all slots', () => {
    const grouped = new Set([
      ...SLOT_GROUPS.armor,
      ...SLOT_GROUPS.weapons,
      ...SLOT_GROUPS.hotbar,
      ...SLOT_GROUPS.inventory,
    ]);
    assert.equal(grouped.size, 42);
  });

  it('armor group has 4 slots', () => {
    assert.equal(SLOT_GROUPS.armor.length, 4);
    assert.ok(SLOT_GROUPS.armor.includes('armor.head'));
    assert.ok(SLOT_GROUPS.armor.includes('armor.feet'));
  });

  it('hotbar group has 9 slots', () => {
    assert.equal(SLOT_GROUPS.hotbar.length, 9);
    assert.ok(SLOT_GROUPS.hotbar.includes('hotbar.0'));
    assert.ok(SLOT_GROUPS.hotbar.includes('hotbar.8'));
  });

  it('inventory group has 27 slots', () => {
    assert.equal(SLOT_GROUPS.inventory.length, 27);
  });
});

describe('junk items', () => {
  it('has enough variety', () => {
    assert.ok(JUNK_ITEMS.length >= 20);
  });

  it('all items have minecraft: prefix', () => {
    for (const item of JUNK_ITEMS) {
      assert.ok(item.startsWith('minecraft:'), `Missing prefix: ${item}`);
    }
  });
});

describe('inventory tool schema', () => {
  const { schema } = require('../tools/inventory');

  it('has correct name', () => {
    assert.equal(schema.name, 'inventory');
  });

  it('lists all actions', () => {
    const actions = schema.input_schema.properties.action.enum;
    assert.ok(actions.includes('read'));
    assert.ok(actions.includes('fill_empty'));
    assert.ok(actions.includes('fill_junk'));
    assert.ok(actions.includes('set'));
    assert.ok(actions.includes('clear_slots'));
    assert.ok(actions.includes('clear_all'));
    assert.ok(actions.includes('remove'));
  });
});
