const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { KITS, resolveKit } = require('../tools/kits');

describe('kit resolution', () => {
  it('resolves level numbers', () => {
    assert.ok(resolveKit('1'));
    assert.ok(resolveKit('5'));
    assert.ok(resolveKit(3));
  });

  it('resolves named kits', () => {
    assert.ok(resolveKit('max'));
    assert.ok(resolveKit('overworld_pvp'));
    assert.ok(resolveKit('underwater'));
    assert.ok(resolveKit('lava'));
    assert.ok(resolveKit('elytra'));
    assert.ok(resolveKit('nether'));
  });

  it('resolves aliases', () => {
    assert.equal(resolveKit('min'), resolveKit('1'));
    assert.equal(resolveKit('minimum'), resolveKit('1'));
    assert.equal(resolveKit('worst'), resolveKit('1'));
    assert.equal(resolveKit('best'), resolveKit('max'));
    assert.equal(resolveKit('pvp'), resolveKit('overworld_pvp'));
    assert.equal(resolveKit('water'), resolveKit('underwater'));
    assert.equal(resolveKit('fire'), resolveKit('lava'));
    assert.equal(resolveKit('fly'), resolveKit('elytra'));
    assert.equal(resolveKit('level 3'), resolveKit('3'));
  });

  it('returns null for unknown kits', () => {
    assert.equal(resolveKit('nonexistent_kit'), null);
  });
});

describe('kit structure', () => {
  it('max kit has elytra in chest slot', () => {
    const max = resolveKit('max');
    assert.ok(max.slots['armor.chest'].includes('elytra'));
  });

  it('max kit has golden apples', () => {
    const max = resolveKit('max');
    assert.ok(max.slots['hotbar.5'].includes('golden_apple'));
  });

  it('level 1 has leather armor', () => {
    const kit = resolveKit('1');
    assert.ok(kit.slots['armor.head'].includes('leather_helmet'));
    assert.ok(kit.slots['weapon.mainhand'].includes('wooden_sword'));
  });

  it('level 5 has netherite armor', () => {
    const kit = resolveKit('5');
    assert.ok(kit.slots['armor.head'].includes('netherite_helmet'));
  });

  it('all kits have descriptions', () => {
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.alias) continue;
      assert.ok(kit.description, `Kit ${name} missing description`);
    }
  });

  it('all kits have valid slot names', () => {
    const VALID_SLOTS = new Set([
      'armor.head', 'armor.chest', 'armor.legs', 'armor.feet',
      'weapon.mainhand', 'weapon.offhand',
      'hotbar.0', 'hotbar.1', 'hotbar.2', 'hotbar.3', 'hotbar.4',
      'hotbar.5', 'hotbar.6', 'hotbar.7', 'hotbar.8',
    ]);
    for (const [name, kit] of Object.entries(KITS)) {
      if (kit.alias) continue;
      for (const slot of Object.keys(kit.slots || {})) {
        assert.ok(VALID_SLOTS.has(slot), `Kit ${name} has invalid slot: ${slot}`);
      }
    }
  });

  it('enchantment format uses minecraft: prefix', () => {
    const max = resolveKit('max');
    // All enchanted items should have minecraft: prefixed enchant names
    for (const [slot, item] of Object.entries(max.slots)) {
      if (item.includes('enchantments')) {
        assert.ok(item.includes('"minecraft:'), `Kit max slot ${slot} missing minecraft: prefix in enchantments`);
      }
    }
  });
});

describe('scenario kits', () => {
  it('underwater kit has depth strider and trident', () => {
    const kit = resolveKit('underwater');
    assert.ok(kit.slots['armor.feet'].includes('depth_strider'));
    assert.ok(kit.slots['weapon.mainhand'].includes('trident'));
  });

  it('lava kit has fire protection', () => {
    const kit = resolveKit('lava');
    assert.ok(kit.slots['armor.head'].includes('fire_protection'));
  });

  it('elytra kit has elytra and fireworks', () => {
    const kit = resolveKit('elytra');
    assert.ok(kit.slots['armor.chest'].includes('elytra'));
    assert.ok(kit.slots['hotbar.1'].includes('firework_rocket'));
  });
});
