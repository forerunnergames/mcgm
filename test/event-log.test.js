const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const eventLog = require('../server/event-log');

describe('event log', () => {
  it('records and retrieves events', () => {
    const event = eventLog.record('build', 'built obsidian prison', {
      coordinates: { x: 100, y: 64, z: 200 },
      boundingBox: { x1: 96, y1: 63, z1: 196, x2: 104, y2: 70, z2: 204 },
    });
    assert.ok(event.id);
    assert.equal(event.type, 'build');
    assert.equal(event.description, 'built obsidian prison');
    assert.ok(event.timestamp);
  });

  it('getRecent returns newest first', () => {
    eventLog.record('test', 'event A');
    eventLog.record('test', 'event B');
    const recent = eventLog.getRecent(2);
    assert.equal(recent[0].description, 'event B');
    assert.equal(recent[1].description, 'event A');
  });

  it('search finds by keyword', () => {
    eventLog.record('build', 'built obsidian prison around player');
    const results = eventLog.search('prison');
    assert.ok(results.length > 0);
    assert.ok(results[0].description.includes('prison'));
  });

  it('findLast returns most recent match', () => {
    eventLog.record('fill', 'replaced stone with lava');
    eventLog.record('fill', 'replaced grass with sand');
    const result = eventLog.findLast('lava');
    assert.ok(result);
    assert.ok(result.description.includes('lava'));
  });

  it('getUndoCommands generates fill air for bounding box', () => {
    const event = eventLog.record('build', 'test build', {
      boundingBox: { x1: 0, y1: 60, z1: 0, x2: 10, y2: 70, z2: 10 },
    });
    const cmds = eventLog.getUndoCommands(event);
    assert.ok(cmds.length > 0);
    assert.ok(cmds[0].includes('fill'));
    assert.ok(cmds[0].includes('minecraft:air'));
  });

  it('getUndoCommands generates kill for entities', () => {
    const event = eventLog.record('spawn', 'spawned zombies', {
      coordinates: { x: 100, y: 64, z: 200 },
      entities: ['zombie', 'skeleton'],
    });
    const cmds = eventLog.getUndoCommands(event);
    assert.ok(cmds.length >= 2);
    assert.ok(cmds[0].includes('kill'));
    assert.ok(cmds[0].includes('zombie'));
  });

  it('getUndoCommands handles dimension prefix', () => {
    const event = eventLog.record('build', 'nether build', {
      boundingBox: { x1: 0, y1: 60, z1: 0, x2: 10, y2: 70, z2: 10 },
      dimension: 'minecraft:the_nether',
    });
    const cmds = eventLog.getUndoCommands(event);
    assert.ok(cmds[0].includes('execute in minecraft:the_nether'));
  });

  it('getUndoCommands clears effects for buff events', () => {
    const event = eventLog.record('buff', 'max buff on player', {
      players: ['ThePro261'],
    });
    const cmds = eventLog.getUndoCommands(event);
    assert.ok(cmds.some(c => c.includes('effect clear ThePro261')));
    assert.ok(cmds.some(c => c.includes('max_health base set 20')));
  });
});
