const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classify, needsBlockNormalization, isBatchSafe, extractFillBounds } = require('../minecraft/command');

describe('classify', () => {
  it('classifies fill as block', () => {
    const cmd = classify('fill 0 64 0 10 68 10 minecraft:obsidian hollow');
    assert.equal(cmd.type, 'fill');
    assert.equal(cmd.category, 'block');
    assert.equal(cmd.dimension, null);
  });

  it('classifies setblock as block', () => {
    const cmd = classify('setblock 5 66 5 minecraft:lightning_rod');
    assert.equal(cmd.type, 'setblock');
    assert.equal(cmd.category, 'block');
  });

  it('classifies place as block', () => {
    const cmd = classify('place feature minecraft:oak 10 65 10');
    assert.equal(cmd.type, 'place');
    assert.equal(cmd.category, 'block');
  });

  it('classifies effect as player', () => {
    const cmd = classify('effect give .knightofiam85 minecraft:resistance infinite 4 true');
    assert.equal(cmd.type, 'effect');
    assert.equal(cmd.category, 'player');
  });

  it('classifies attribute as player', () => {
    const cmd = classify('attribute .knightofiam85 minecraft:max_health base set 1024');
    assert.equal(cmd.type, 'attribute');
    assert.equal(cmd.category, 'player');
  });

  it('classifies item replace as player', () => {
    const cmd = classify('item replace entity .knightofiam85 armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:protection":4}]');
    assert.equal(cmd.type, 'item');
    assert.equal(cmd.category, 'player');
  });

  it('classifies give as player', () => {
    const cmd = classify('give .knightofiam85 minecraft:diamond 64');
    assert.equal(cmd.type, 'give');
    assert.equal(cmd.category, 'player');
  });

  it('classifies tp as player', () => {
    const cmd = classify('tp .knightofiam85 100 65 200');
    assert.equal(cmd.type, 'tp');
    assert.equal(cmd.category, 'player');
  });

  it('classifies summon as entity', () => {
    const cmd = classify('summon minecraft:chicken 100 64 200');
    assert.equal(cmd.type, 'summon');
    assert.equal(cmd.category, 'entity');
  });

  it('classifies kill as entity', () => {
    const cmd = classify('kill @e[type=minecraft:tnt]');
    assert.equal(cmd.type, 'kill');
    assert.equal(cmd.category, 'entity');
  });

  it('classifies forceload as world', () => {
    const cmd = classify('forceload add 0 0 100 100');
    assert.equal(cmd.type, 'forceload');
    assert.equal(cmd.category, 'world');
  });

  it('extracts dimension from execute in wrapper', () => {
    const cmd = classify('execute in minecraft:the_nether run fill 0 64 0 10 68 10 minecraft:netherrack');
    assert.equal(cmd.type, 'fill');
    assert.equal(cmd.category, 'block');
    assert.equal(cmd.dimension, 'minecraft:the_nether');
    assert.equal(cmd.inner, 'fill 0 64 0 10 68 10 minecraft:netherrack');
  });

  it('handles execute in for non-block commands', () => {
    const cmd = classify('execute in minecraft:the_end run tp .player 0 64 0');
    assert.equal(cmd.type, 'tp');
    assert.equal(cmd.category, 'player');
    assert.equal(cmd.dimension, 'minecraft:the_end');
  });

  it('strips leading slash', () => {
    const cmd = classify('/gamemode creative .player');
    assert.equal(cmd.type, 'gamemode');
    assert.equal(cmd.category, 'player');
    assert.equal(cmd.raw, 'gamemode creative .player');
  });

  it('classifies unknown commands as raw', () => {
    const cmd = classify('spark health');
    assert.equal(cmd.type, 'spark');
    assert.equal(cmd.category, 'raw');
  });
});

describe('needsBlockNormalization', () => {
  it('true for fill', () => {
    assert.equal(needsBlockNormalization(classify('fill 0 0 0 1 1 1 minecraft:stone')), true);
  });

  it('true for setblock', () => {
    assert.equal(needsBlockNormalization(classify('setblock 0 0 0 minecraft:stone')), true);
  });

  it('false for effect', () => {
    assert.equal(needsBlockNormalization(classify('effect give .p minecraft:resistance 100')), false);
  });

  it('false for item replace', () => {
    assert.equal(needsBlockNormalization(classify('item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:thorns":3}]')), false);
  });

  it('false for give', () => {
    assert.equal(needsBlockNormalization(classify('give .p minecraft:diamond 64')), false);
  });

  it('false for attribute', () => {
    assert.equal(needsBlockNormalization(classify('attribute .p minecraft:max_health base set 100')), false);
  });

  it('false for summon', () => {
    assert.equal(needsBlockNormalization(classify('summon minecraft:lightning_bolt 0 65 0')), false);
  });
});

describe('isBatchSafe', () => {
  it('true for fill (block)', () => {
    assert.equal(isBatchSafe(classify('fill 0 0 0 1 1 1 minecraft:stone')), true);
  });

  it('true for summon (entity)', () => {
    assert.equal(isBatchSafe(classify('summon minecraft:cow 0 64 0')), true);
  });

  it('true for forceload (world)', () => {
    assert.equal(isBatchSafe(classify('forceload add 0 0 100 100')), true);
  });

  it('true for kill (entity)', () => {
    assert.equal(isBatchSafe(classify('kill @e[type=minecraft:item]')), true);
  });

  it('false for effect (player)', () => {
    assert.equal(isBatchSafe(classify('effect give .p minecraft:resistance 100')), false);
  });

  it('false for item (player)', () => {
    assert.equal(isBatchSafe(classify('item replace entity .p armor.head with minecraft:diamond_helmet')), false);
  });

  it('false for attribute (player)', () => {
    assert.equal(isBatchSafe(classify('attribute .p minecraft:max_health base set 100')), false);
  });

  it('false for give (player)', () => {
    assert.equal(isBatchSafe(classify('give .p minecraft:diamond 64')), false);
  });

  it('false for tp (player)', () => {
    assert.equal(isBatchSafe(classify('tp .p 0 64 0')), false);
  });
});

describe('extractFillBounds', () => {
  it('extracts bounds from fill commands', () => {
    const cmds = [
      classify('fill -10 50 -10 10 70 10 minecraft:stone'),
      classify('fill 20 50 20 30 70 30 minecraft:dirt'),
    ];
    const bounds = extractFillBounds(cmds);
    assert.deepEqual(bounds, { minX: -10, minZ: -10, maxX: 30, maxZ: 30, dimension: null });
  });

  it('extracts dimension from execute in fills', () => {
    const cmds = [
      classify('execute in minecraft:the_nether run fill 0 30 0 50 60 50 minecraft:netherrack'),
    ];
    const bounds = extractFillBounds(cmds);
    assert.equal(bounds.dimension, 'minecraft:the_nether');
  });

  it('returns null when no fill commands', () => {
    const cmds = [classify('summon minecraft:cow 0 64 0')];
    assert.equal(extractFillBounds(cmds), null);
  });

  it('ignores non-fill commands', () => {
    const cmds = [
      classify('effect give .p minecraft:resistance 100'),
      classify('fill 0 0 0 10 10 10 minecraft:stone'),
    ];
    const bounds = extractFillBounds(cmds);
    assert.deepEqual(bounds, { minX: 0, minZ: 0, maxX: 10, maxZ: 10, dimension: null });
  });
});
