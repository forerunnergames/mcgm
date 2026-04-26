const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommand, normalizeCommands } = require('../minecraft/normalize');

describe('normalizeCommand', () => {
  describe('block commands (should normalize)', () => {
    it('corrects renamed blocks in fill', () => {
      const result = normalizeCommand('fill 0 64 0 10 68 10 minecraft:grass');
      assert.ok(result.normalized.includes('minecraft:short_grass'), `Expected short_grass, got: ${result.normalized}`);
      assert.ok(result.corrections.length > 0);
    });

    it('corrects renamed blocks in setblock', () => {
      const result = normalizeCommand('setblock 5 66 5 minecraft:grass');
      assert.ok(result.normalized.includes('minecraft:short_grass'));
    });

    it('leaves valid blocks untouched', () => {
      const result = normalizeCommand('fill 0 64 0 10 68 10 minecraft:obsidian');
      assert.equal(result.normalized, 'fill 0 64 0 10 68 10 minecraft:obsidian');
      assert.equal(result.corrections.length, 0);
    });

    it('handles execute in wrapper for block commands', () => {
      const result = normalizeCommand('execute in minecraft:the_nether run fill 0 30 0 50 60 50 minecraft:grass');
      assert.ok(result.normalized.includes('minecraft:short_grass'));
    });
  });

  describe('non-block commands (should NOT normalize)', () => {
    it('does not touch effect commands', () => {
      const raw = 'effect give .knightofiam85 minecraft:resistance infinite 4 true';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
      assert.equal(result.corrections.length, 0);
    });

    it('does not touch attribute commands', () => {
      const raw = 'attribute .knightofiam85 minecraft:max_health base set 1024';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
    });

    it('does not touch item replace with enchantments', () => {
      const raw = 'item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:thorns":3,"minecraft:protection":4}]';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
      // The critical test: minecraft:thorns must NOT become minecraft:torch
      assert.ok(result.normalized.includes('minecraft:thorns'));
      assert.ok(!result.normalized.includes('minecraft:torch'));
    });

    it('does not touch give commands', () => {
      const raw = 'give .knightofiam85 minecraft:diamond 64';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
    });

    it('does not touch summon commands', () => {
      const raw = 'summon minecraft:lightning_bolt 0 65 0';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
    });

    it('does not touch tp commands', () => {
      const raw = 'tp .knightofiam85 100 65 200';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
    });

    it('does not touch execute in + effect', () => {
      const raw = 'execute in minecraft:the_nether run effect give .p minecraft:fire_resistance 100';
      const result = normalizeCommand(raw);
      assert.equal(result.normalized, raw);
    });
  });
});

describe('normalizeCommands', () => {
  it('normalizes a mixed batch correctly', () => {
    const input = [
      'fill 0 64 0 10 68 10 minecraft:grass',
      'effect give .p minecraft:resistance infinite 4 true',
      'item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:thorns":3}]',
      'setblock 5 66 5 minecraft:chain',
    ];
    const result = normalizeCommands(input);

    // fill should be corrected (grass → short_grass)
    assert.ok(result.commands[0].includes('minecraft:short_grass'));

    // effect should be untouched
    assert.ok(result.commands[1].includes('minecraft:resistance'));

    // item replace should be untouched — thorns must not become torch
    assert.ok(result.commands[2].includes('minecraft:thorns'));
    assert.ok(!result.commands[2].includes('minecraft:torch'));

    // setblock should be corrected (chain → iron_chain)
    assert.ok(result.commands[3].includes('minecraft:iron_chain'));

    assert.equal(result.rejected.length, 0);
  });

  it('rejects commands with invalid block tags', () => {
    const input = [
      'fill 0 64 0 10 68 10 #minecraft:definitely_not_a_tag replace minecraft:stone',
    ];
    const result = normalizeCommands(input);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.commands.length, 0);
  });
});
