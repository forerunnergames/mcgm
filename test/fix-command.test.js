const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fixCommand } = require('../minecraft/fix-command');

describe('fixCommand', () => {
  describe('attribute renames', () => {
    it('fixes generic.max_health → max_health', () => {
      const fixed = fixCommand('attribute .player minecraft:generic.max_health base set 1024');
      assert.equal(fixed, 'attribute .player minecraft:max_health base set 1024');
    });

    it('fixes generic.movement_speed', () => {
      const fixed = fixCommand('attribute .player minecraft:generic.movement_speed base set 0.1');
      assert.equal(fixed, 'attribute .player minecraft:movement_speed base set 0.1');
    });

    it('fixes generic.attack_damage', () => {
      const fixed = fixCommand('attribute .player minecraft:generic.attack_damage base set 10');
      assert.equal(fixed, 'attribute .player minecraft:attack_damage base set 10');
    });

    it('fixes unqualified generic.max_health', () => {
      const fixed = fixCommand('attribute .player generic.max_health base set 100');
      assert.equal(fixed, 'attribute .player minecraft:max_health base set 100');
    });
  });

  describe('effect commands', () => {
    it('adds minecraft: prefix to bare effect names', () => {
      const fixed = fixCommand('effect give .player resistance infinite 4 true');
      assert.equal(fixed, 'effect give .player minecraft:resistance infinite 4 true');
    });

    it('leaves qualified effect names alone', () => {
      const fixed = fixCommand('effect give .player minecraft:resistance infinite 4 true');
      assert.equal(fixed, 'effect give .player minecraft:resistance infinite 4 true');
    });
  });

  describe('passthrough', () => {
    it('does not modify valid commands', () => {
      const cmds = [
        'tp .player 0 64 0',
        'fill 0 64 0 10 68 10 minecraft:stone',
        'summon minecraft:cow 0 64 0',
        'effect give .p minecraft:speed 100 2 true',
        'give .p minecraft:diamond 64',
      ];
      for (const cmd of cmds) {
        assert.equal(fixCommand(cmd), cmd, `Modified valid command: ${cmd}`);
      }
    });

    it('does not modify item replace with enchantments', () => {
      const cmd = 'item replace entity .p armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:thorns":3}]';
      assert.equal(fixCommand(cmd), cmd);
    });
  });
});
