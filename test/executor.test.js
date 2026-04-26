const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classify, isBatchSafe, extractFillBounds } = require('../minecraft/command');
const { normalizeCommands } = require('../minecraft/normalize');

// Test the executor's logic without needing a live server connection.
// We test command routing, normalization integration, and auto-tiling.

describe('executor command routing', () => {
  // Simulate the executor's routing logic
  function routeCommands(commands) {
    const { commands: normalized, rejected } = normalizeCommands(commands);
    const batch = [];
    const individual = [];
    for (const raw of normalized) {
      const cmd = classify(raw);
      if (isBatchSafe(cmd)) {
        batch.push(cmd);
      } else {
        individual.push(cmd);
      }
    }
    return { batch, individual, rejected };
  }

  it('routes fill commands to batch', () => {
    const { batch, individual } = routeCommands([
      'fill 0 64 0 10 68 10 minecraft:stone',
    ]);
    assert.equal(batch.length, 1);
    assert.equal(individual.length, 0);
  });

  it('routes effect commands to individual', () => {
    const { batch, individual } = routeCommands([
      'effect give .player minecraft:resistance infinite 4 true',
    ]);
    assert.equal(batch.length, 0);
    assert.equal(individual.length, 1);
  });

  it('routes item replace to individual', () => {
    const { batch, individual } = routeCommands([
      'item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:thorns":3}]',
    ]);
    assert.equal(batch.length, 0);
    assert.equal(individual.length, 1);
    // Verify thorns was NOT mangled
    assert.ok(individual[0].raw.includes('minecraft:thorns'));
  });

  it('routes mixed commands correctly', () => {
    const { batch, individual } = routeCommands([
      'fill 0 64 0 10 68 10 minecraft:obsidian hollow',
      'effect give .p minecraft:fire_resistance infinite 1 true',
      'summon minecraft:cow 0 64 0',
      'attribute .p minecraft:max_health base set 1024',
      'setblock 5 66 5 minecraft:lightning_rod',
      'give .p minecraft:diamond 64',
      'kill @e[type=minecraft:item]',
      'tp .p 100 65 200',
    ]);
    // fill, summon, setblock, kill → batch (4)
    assert.equal(batch.length, 4);
    assert.deepEqual(batch.map(c => c.type), ['fill', 'summon', 'setblock', 'kill']);
    // effect, attribute, give, tp → individual (4)
    assert.equal(individual.length, 4);
    assert.deepEqual(individual.map(c => c.type), ['effect', 'attribute', 'give', 'tp']);
  });

  it('normalizes block names only in batch commands', () => {
    const { batch, individual } = routeCommands([
      'fill 0 64 0 10 68 10 minecraft:grass',        // block → should normalize
      'effect give .p minecraft:resistance infinite',  // player → should NOT normalize
    ]);
    assert.ok(batch[0].raw.includes('minecraft:short_grass'), 'grass should be corrected to short_grass');
    assert.ok(individual[0].raw.includes('minecraft:resistance'), 'resistance should NOT be touched');
  });

  it('routes forceload and say to batch', () => {
    const { batch } = routeCommands([
      'forceload add 0 0 100 100',
      'say hello world',
    ]);
    assert.equal(batch.length, 2);
  });

  it('rejects invalid block tags', () => {
    const { rejected } = routeCommands([
      'fill 0 64 0 10 68 10 #minecraft:not_a_real_tag replace minecraft:stone',
    ]);
    assert.equal(rejected.length, 1);
  });
});

describe('auto-tiling integration', () => {
  it('leaves small fills untouched', () => {
    const cmds = [classify('fill 0 0 0 10 10 10 minecraft:stone')];
    const bounds = extractFillBounds(cmds);
    assert.ok(bounds);
    assert.equal(bounds.minX, 0);
    assert.equal(bounds.maxX, 10);
  });

  it('extractFillBounds works with dimension prefix', () => {
    const cmds = [classify('execute in minecraft:the_nether run fill -100 0 -100 100 128 100 minecraft:netherrack')];
    const bounds = extractFillBounds(cmds);
    assert.equal(bounds.dimension, 'minecraft:the_nether');
    assert.equal(bounds.minX, -100);
    assert.equal(bounds.maxX, 100);
  });
});

describe('enchantment preservation', () => {
  it('preserves all enchantment names in item replace commands', () => {
    const enchantedItems = [
      'item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
      'item replace entity .p weapon.mainhand with minecraft:netherite_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:looting":3,"minecraft:fire_aspect":2,"minecraft:sweeping_edge":3}]',
    ];
    const { commands: normalized } = normalizeCommands(enchantedItems);
    // Every command should be unchanged
    assert.equal(normalized.length, 2);
    assert.equal(normalized[0], enchantedItems[0]);
    assert.equal(normalized[1], enchantedItems[1]);
  });

  it('preserves effect names in effect commands', () => {
    const effectCmds = [
      'effect give .p minecraft:resistance infinite 4 true',
      'effect give .p minecraft:fire_resistance infinite 1 true',
      'effect give .p minecraft:regeneration infinite 4 true',
      'effect give .p minecraft:strength infinite 4 true',
    ];
    const { commands: normalized } = normalizeCommands(effectCmds);
    assert.equal(normalized.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(normalized[i], effectCmds[i]);
    }
  });

  it('preserves attribute names', () => {
    const cmd = 'attribute .p minecraft:max_health base set 1024';
    const { commands: normalized } = normalizeCommands([cmd]);
    assert.equal(normalized[0], cmd);
  });
});
