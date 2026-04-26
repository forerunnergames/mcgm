const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseLocateOutput } = require('../server/log-reader');

describe('parseLocateOutput', () => {
  it('parses "at [x, ~, z]" format', () => {
    const result = parseLocateOutput('The nearest minecraft:trial_chambers is at [192, ~, 176] (200 blocks away)');
    assert.deepEqual(result, { x: 192, z: 176, y: null, hasExactY: false });
  });

  it('parses "at [x, y, z]" format', () => {
    const result = parseLocateOutput('The nearest minecraft:village_plains is at [-480, 75, 64] (500 blocks away)');
    assert.deepEqual(result, { x: -480, y: 75, z: 64, hasExactY: true });
  });

  it('parses negative coordinates', () => {
    const result = parseLocateOutput('The nearest minecraft:ancient_city is at [-1200, ~, -800] (1440 blocks away)');
    assert.deepEqual(result, { x: -1200, z: -800, y: null, hasExactY: false });
  });

  it('returns null for unparseable output', () => {
    assert.equal(parseLocateOutput('Could not find structure'), null);
    assert.equal(parseLocateOutput(''), null);
    assert.equal(parseLocateOutput('some random server log line'), null);
  });

  it('parses from multi-line log output', () => {
    const multiLine = `[Server thread/INFO]: Reloading!
[Server thread/INFO]: Loaded 1515 recipes
[Server thread/INFO]: The nearest minecraft:trial_chambers is at [192, ~, 176] (200 blocks away)
[Server thread/INFO]: Locating element took 6 ms`;
    const result = parseLocateOutput(multiLine);
    assert.deepEqual(result, { x: 192, z: 176, y: null, hasExactY: false });
  });
});
