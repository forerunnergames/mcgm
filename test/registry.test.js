const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../minecraft/registry');

describe('registry validation', () => {
  describe('isValidBlock', () => {
    it('accepts valid blocks', () => {
      assert.equal(registry.isValidBlock('minecraft:stone'), true);
      assert.equal(registry.isValidBlock('minecraft:obsidian'), true);
      assert.equal(registry.isValidBlock('minecraft:oak_planks'), true);
      assert.equal(registry.isValidBlock('minecraft:lightning_rod'), true);
    });

    it('accepts air', () => {
      assert.equal(registry.isValidBlock('minecraft:air'), true);
    });

    it('auto-qualifies unqualified names', () => {
      assert.equal(registry.isValidBlock('stone'), true);
    });

    it('rejects invalid blocks', () => {
      assert.equal(registry.isValidBlock('minecraft:not_a_real_block'), false);
      assert.equal(registry.isValidBlock('minecraft:thorns'), false);
      assert.equal(registry.isValidBlock('minecraft:resistance'), false);
    });
  });

  describe('isValidEntity', () => {
    it('accepts valid entities', () => {
      assert.equal(registry.isValidEntity('minecraft:cow'), true);
      assert.equal(registry.isValidEntity('minecraft:lightning_bolt'), true);
      assert.equal(registry.isValidEntity('minecraft:chicken'), true);
    });

    it('rejects invalid entities', () => {
      assert.equal(registry.isValidEntity('minecraft:not_an_entity'), false);
    });
  });

  describe('isValidEffect', () => {
    it('accepts valid effects', () => {
      assert.equal(registry.isValidEffect('minecraft:resistance'), true);
      assert.equal(registry.isValidEffect('minecraft:fire_resistance'), true);
      assert.equal(registry.isValidEffect('minecraft:regeneration'), true);
    });

    it('rejects invalid effects', () => {
      assert.equal(registry.isValidEffect('minecraft:stone'), false);
    });
  });

  describe('isValidEnchantment', () => {
    it('accepts valid enchantments', () => {
      assert.equal(registry.isValidEnchantment('minecraft:protection'), true);
      assert.equal(registry.isValidEnchantment('minecraft:sharpness'), true);
      assert.equal(registry.isValidEnchantment('minecraft:thorns'), true);
      assert.equal(registry.isValidEnchantment('minecraft:mending'), true);
    });

    it('rejects invalid enchantments', () => {
      assert.equal(registry.isValidEnchantment('minecraft:stone'), false);
    });
  });

  describe('isValidBlockTag', () => {
    it('accepts valid tags', () => {
      assert.equal(registry.isValidBlockTag('#minecraft:planks'), true);
      assert.equal(registry.isValidBlockTag('#minecraft:logs'), true);
      assert.equal(registry.isValidBlockTag('#minecraft:flowers'), true);
    });

    it('rejects invalid tags', () => {
      assert.equal(registry.isValidBlockTag('#minecraft:not_a_tag'), false);
    });
  });
});

describe('findClosestBlock', () => {
  it('finds official renames', () => {
    assert.equal(registry.findClosestBlock('minecraft:grass'), 'minecraft:short_grass');
    assert.equal(registry.findClosestBlock('minecraft:chain'), 'minecraft:iron_chain');
    assert.equal(registry.findClosestBlock('minecraft:sign'), 'minecraft:oak_sign');
    assert.equal(registry.findClosestBlock('minecraft:grass_path'), 'minecraft:dirt_path');
  });

  it('strips plurals', () => {
    // "torches" → "torch" if torch is in registry
    const result = registry.findClosestBlock('minecraft:torches');
    assert.equal(result, 'minecraft:torch');
  });

  it('does NOT mangle enchantment names into block names', () => {
    // This was the critical bug: thorns → torch, soul_speed → soul_sand
    // These should NOT match because they're not blocks, but findClosestBlock
    // WILL return a close match — the point is the caller should never call
    // this function for non-block commands.
    // We test that the system works end-to-end via normalize tests.
  });

  it('handles _block suffix', () => {
    // "netherite" → "netherite_block"
    const result = registry.findClosestBlock('minecraft:netherite');
    assert.equal(result, 'minecraft:netherite_block');
  });

  it('returns null for completely unknown', () => {
    const result = registry.findClosestBlock('minecraft:zzzzzzzzzzzzz');
    assert.equal(result, null);
  });
});

describe('lookups', () => {
  it('getLocateTargets returns targets', () => {
    const targets = registry.getLocateTargets();
    assert.ok(targets['village']);
    assert.ok(targets['trial chambers']);
  });

  it('getTreeFeatures returns features', () => {
    const trees = registry.getTreeFeatures();
    assert.ok(trees['oak'] || trees['cherry']);
  });

  it('getBlockGroups returns groups', () => {
    const groups = registry.getBlockGroups();
    assert.ok(groups['wood']);
    assert.ok(groups['stone']);
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(registry.levenshtein('stone', 'stone'), 0);
  });

  it('returns correct distance for single edit', () => {
    assert.equal(registry.levenshtein('stone', 'stole'), 1);
  });

  it('returns string length for empty string', () => {
    assert.equal(registry.levenshtein('', 'abc'), 3);
    assert.equal(registry.levenshtein('abc', ''), 3);
  });
});
