const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BUFFS, DEBUFFS } = require('../tools/buffs');

describe('buff definitions', () => {
  it('has levels 1-5', () => {
    for (let i = 1; i <= 5; i++) {
      assert.ok(BUFFS[i], `Missing buff level ${i}`);
      assert.ok(DEBUFFS[i], `Missing debuff level ${i}`);
    }
  });

  it('all buffs have descriptions', () => {
    for (const [level, buff] of Object.entries(BUFFS)) {
      assert.ok(buff.description, `Buff ${level} missing description`);
    }
  });

  it('all debuffs have descriptions', () => {
    for (const [level, debuff] of Object.entries(DEBUFFS)) {
      assert.ok(debuff.description, `Debuff ${level} missing description`);
    }
  });

  it('max buff has resistance and regen', () => {
    const effects = BUFFS[5].effects.map(e => e.effect);
    assert.ok(effects.includes('resistance'));
    assert.ok(effects.includes('regeneration'));
    assert.ok(effects.includes('fire_resistance'));
  });

  it('max debuff has mining fatigue and low health', () => {
    const effects = DEBUFFS[5].effects.map(e => e.effect);
    assert.ok(effects.includes('mining_fatigue'));
    assert.ok(effects.includes('weakness'));
    assert.ok(effects.includes('blindness'));
    assert.equal(DEBUFFS[5].maxHealth, 1);
  });

  it('buff levels increase in intensity', () => {
    // Max health should increase or stay the same with buff level
    assert.ok(BUFFS[5].maxHealth >= BUFFS[1].maxHealth);
    // Debuff max health should decrease with level
    assert.ok(DEBUFFS[5].maxHealth <= DEBUFFS[1].maxHealth);
  });

  it('effect names are valid snake_case', () => {
    for (const buff of Object.values(BUFFS)) {
      for (const e of buff.effects) {
        assert.ok(/^[a-z_]+$/.test(e.effect), `Invalid effect name: ${e.effect}`);
      }
    }
    for (const debuff of Object.values(DEBUFFS)) {
      for (const e of debuff.effects) {
        assert.ok(/^[a-z_]+$/.test(e.effect), `Invalid effect name: ${e.effect}`);
      }
    }
  });
});
