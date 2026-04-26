const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseDeathMessage } = require('../server/death-tracker');

describe('parseDeathMessage', () => {
  it('parses "was slain by"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: ThePro261 was slain by Iron Golem');
    assert.equal(r.player, 'ThePro261');
    assert.equal(r.cause, 'was slain by Iron Golem');
  });

  it('parses "was shot by"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: .player1 was shot by Skeleton');
    assert.equal(r.player, '.player1');
    assert.ok(r.cause.includes('was shot by'));
  });

  it('parses "drowned"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: _FlameTag__ drowned');
    assert.equal(r.player, '_FlameTag__');
    assert.equal(r.cause, 'drowned');
  });

  it('parses "tried to swim in lava"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: .player1 tried to swim in lava');
    assert.equal(r.player, '.player1');
    assert.ok(r.cause.includes('lava'));
  });

  it('parses "fell from a high place"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: ThePro261 fell from a high place');
    assert.equal(r.player, 'ThePro261');
    assert.ok(r.cause.includes('fell from'));
  });

  it('parses "was blown up by"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: ThePro261 was blown up by Creeper');
    assert.ok(r);
    assert.ok(r.cause.includes('blown up'));
  });

  it('parses "hit the ground too hard"', () => {
    const r = parseDeathMessage('[12:00:00] [Server thread/INFO]: ThePro261 hit the ground too hard');
    assert.ok(r);
    assert.ok(r.cause.includes('hit the ground'));
  });

  it('ignores villager/mob death messages', () => {
    const r = parseDeathMessage("[12:00:00] [Server thread/INFO]: Villager Villager['Villager'/182899, uuid='e71cb129'] died, message: 'Villager tried to swim in lava'");
    assert.equal(r, null);
  });

  it('ignores non-death log lines', () => {
    assert.equal(parseDeathMessage('[12:00:00] [Server thread/INFO]: ThePro261 joined the game'), null);
    assert.equal(parseDeathMessage('[12:00:00] [Server thread/INFO]: Successfully filled 100 block(s)'), null);
  });
});
