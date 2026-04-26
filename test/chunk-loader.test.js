const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { dimPrefix } = require('../server/chunk-loader');

describe('dimPrefix', () => {
  it('returns empty string for overworld', () => {
    assert.equal(dimPrefix('minecraft:overworld'), '');
    assert.equal(dimPrefix(null), '');
    assert.equal(dimPrefix(undefined), '');
  });

  it('returns execute in prefix for nether', () => {
    assert.equal(dimPrefix('minecraft:the_nether'), 'execute in minecraft:the_nether run ');
  });

  it('returns execute in prefix for end', () => {
    assert.equal(dimPrefix('minecraft:the_end'), 'execute in minecraft:the_end run ');
  });
});
