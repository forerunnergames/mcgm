const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tryMatch } = require('../llm/pattern-match');

const resolve = (name) => name; // identity for testing

describe('pattern matching', () => {
  describe('kits', () => {
    it('matches "give me max gear"', () => {
      const r = tryMatch('.player1', 'give me max gear', resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'kit');
      assert.equal(r.input.kit, 'max');
      assert.equal(r.input.player, '.player1');
    });

    it('matches "max kit"', () => {
      const r = tryMatch('.p', 'max kit', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.kit, 'max');
    });

    it('matches "gear me up"', () => {
      const r = tryMatch('.p', 'gear me up', resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'kit');
      assert.equal(r.input.kit, 'max');
    });

    it('matches "level 3 kit"', () => {
      const r = tryMatch('.p', 'give me level 3 kit', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.kit, '3');
    });

    it('matches "strip my gear"', () => {
      const r = tryMatch('.p', 'strip my gear', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.action, 'strip_all');
    });

    it('matches "clear my inventory"', () => {
      const r = tryMatch('.p', 'clear my inventory', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.action, 'strip_all');
    });
  });

  describe('buffs', () => {
    it('matches "make me invincible"', () => {
      const r = tryMatch('.p', 'make me invincible', resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'buff_debuff');
      assert.equal(r.input.type, 'buff');
      assert.equal(r.input.level, 5);
    });

    it('matches "buff me"', () => {
      const r = tryMatch('.p', 'buff me', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.type, 'buff');
    });

    it('matches "debuff andrew"', () => {
      const r = tryMatch('.p', 'debuff andrew', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.type, 'debuff');
      assert.equal(r.input.player, 'andrew');
    });

    it('matches "clear effects"', () => {
      const r = tryMatch('.p', 'clear my effects', resolve);
      assert.ok(r.matched);
      assert.equal(r.input.type, 'clear');
    });
  });

  describe('sleep', () => {
    it('matches "sleep"', () => {
      const r = tryMatch('.p', 'sleep', resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'leave_for_sleep');
    });

    it('matches "let me sleep"', () => {
      const r = tryMatch('.p', 'let me sleep', resolve);
      assert.ok(r.matched);
    });
  });

  describe('server', () => {
    it('matches "server stats"', () => {
      const r = tryMatch('.p', 'server stats', resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'get_server_stats');
    });

    it('matches "who\'s online"', () => {
      const r = tryMatch('.p', "who's online", resolve);
      assert.ok(r.matched);
      assert.equal(r.tool, 'list_online_players');
    });
  });

  describe('no match', () => {
    it('does not match complex requests', () => {
      assert.ok(!tryMatch('.p', 'build a castle at spawn', resolve).matched);
      assert.ok(!tryMatch('.p', 'teleport everyone to a coral reef', resolve).matched);
      assert.ok(!tryMatch('.p', 'convert the village to desert', resolve).matched);
      assert.ok(!tryMatch('.p', 'place trial chambers near me', resolve).matched);
    });
  });
});
