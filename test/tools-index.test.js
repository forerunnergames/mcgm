const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Use tools/index directly (not through facade) to avoid the tools.js→tools/ resolution
const toolsIndex = require('../tools/index');

describe('tools index', () => {
  it('auto-discovers all 8 tools', () => {
    assert.equal(toolsIndex.schemas.length, 8);
  });

  it('has all expected tool names', () => {
    const names = toolsIndex.schemas.map(s => s.name).sort();
    assert.deepEqual(names, [
      'equip_player',
      'get_death_location',
      'locate_and_teleport',
      'place_structure',
      'plant_trees',
      'replace_blocks_in_area',
      'scan_area',
      'scatter_blocks',
    ]);
  });

  it('every schema has required fields', () => {
    for (const schema of toolsIndex.schemas) {
      assert.ok(schema.name, `schema missing name`);
      assert.ok(schema.description, `${schema.name} missing description`);
      assert.ok(schema.input_schema, `${schema.name} missing input_schema`);
    }
  });

  it('executeTool dispatches correctly', async () => {
    // Test with an unknown tool
    const result = await toolsIndex.executeTool('nonexistent_tool', {});
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('unknown tool'));
  });

  it('backwards-compatible exports work', () => {
    assert.equal(typeof toolsIndex.equipPlayer, 'function');
    assert.equal(typeof toolsIndex.locateAndTeleport, 'function');
    assert.equal(typeof toolsIndex.replaceBlocksInArea, 'function');
    assert.equal(typeof toolsIndex.plantTrees, 'function');
    assert.equal(typeof toolsIndex.placeStructure, 'function');
    assert.equal(typeof toolsIndex.scanArea, 'function');
    assert.equal(typeof toolsIndex.getDeathLocation, 'function');
  });

  it('BLOCK_GROUPS has expected groups', () => {
    assert.ok(toolsIndex.BLOCK_GROUPS.wood);
    assert.ok(toolsIndex.BLOCK_GROUPS.stone);
    assert.ok(toolsIndex.BLOCK_GROUPS.trees);
  });

  it('LOCATE_MAP has expected targets', () => {
    assert.ok(toolsIndex.LOCATE_MAP.village);
    assert.ok(toolsIndex.LOCATE_MAP['trial chambers']);
  });
});

describe('equip tool', () => {
  const equip = require('../tools/equip');

  it('has all 4 tiers', () => {
    assert.ok(equip.ENCHANTMENT_PRESETS.netherite);
    assert.ok(equip.ENCHANTMENT_PRESETS.diamond);
    assert.ok(equip.ENCHANTMENT_PRESETS.iron);
    assert.ok(equip.ENCHANTMENT_PRESETS.leather);
  });

  it('netherite tier has full gear', () => {
    const preset = equip.ENCHANTMENT_PRESETS.netherite;
    assert.ok(preset.helmet);
    assert.ok(preset.chestplate);
    assert.ok(preset.leggings);
    assert.ok(preset.boots);
    assert.ok(preset.sword);
    assert.ok(preset.pickaxe);
    assert.ok(preset.bow);
    assert.ok(preset.shield);
    assert.ok(preset.elytra);
    assert.ok(preset.trident);
  });

  it('slot map covers all equipment', () => {
    assert.equal(equip.SLOT_MAP.helmet, 'armor.head');
    assert.equal(equip.SLOT_MAP.boots, 'armor.feet');
    assert.equal(equip.SLOT_MAP.sword, 'weapon.mainhand');
    assert.equal(equip.SLOT_MAP.shield, 'weapon.offhand');
  });
});

describe('locate tool', () => {
  const locate = require('../tools/locate');

  it('classifies underground targets', () => {
    assert.ok(locate.UNDERGROUND_TARGETS.includes('trial_chambers'));
    assert.ok(locate.UNDERGROUND_TARGETS.includes('ancient_city'));
    assert.ok(locate.UNDERGROUND_TARGETS.includes('deep_dark'));
  });
});
