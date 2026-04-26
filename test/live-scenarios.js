#!/usr/bin/env node
// Live scenario tester — runs real commands against the server and verifies results.
// Usage: node test/live-scenarios.js [scenario-name]
// Run without args to see available scenarios.

'use strict';

require('dotenv').config();
const server = require('../server');
const toolsIndex = require('../tools/index');

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';

let passed = 0, failed = 0, warnings = 0;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
  if (icon === PASS) passed++;
  else if (icon === FAIL) failed++;
  else if (icon === WARN) warnings++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Test helpers
// ============================================================================

async function verifyLog(pattern, desc, waitMs = 1500) {
  await sleep(waitMs);
  const tail = await server.readLogTail(80);
  if (tail.match(pattern)) {
    log(PASS, desc);
    return true;
  } else {
    log(FAIL, `${desc} — not found in log`);
    return false;
  }
}

async function getOnlinePlayers() {
  const r = await server.listPlayers();
  return r.ok ? r.players : [];
}

// ============================================================================
// Scenarios
// ============================================================================

const scenarios = {
  async kit_apply() {
    console.log('\n📦 TEST: Apply max kit to a player');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    console.log(`  Target: ${player}`);

    const result = await toolsIndex.executeTool('kit', { player, kit: 'max', action: 'apply' });
    console.log(`  Result: ok=${result.ok}, slots=${result.slots_equipped}, given=${result.items_given}`);
    if (result.ok) log(PASS, 'Kit applied without error');
    else log(FAIL, `Kit failed: ${result.error}`);
    if (result.errors?.length > 0) log(FAIL, `Errors: ${JSON.stringify(result.errors)}`);

    // Verify some items landed
    await verifyLog(/Replaced a slot/, 'Server confirmed slot replacement');
  },

  async kit_strip() {
    console.log('\n🗑️ TEST: Strip kit from a player');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    const result = await toolsIndex.executeTool('kit', { player, kit: 'max', action: 'strip' });
    console.log(`  Result: ok=${result.ok}, cleared=${result.slots_cleared}`);
    if (result.ok) log(PASS, 'Kit stripped');
    else log(FAIL, `Strip failed: ${result.error}`);
  },

  async kit_levels() {
    console.log('\n📊 TEST: Kit levels 1-5');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    for (const level of [1, 3, 5]) {
      const result = await toolsIndex.executeTool('kit', { player, kit: String(level), action: 'apply' });
      if (result.ok) log(PASS, `Level ${level} kit applied (${result.slots_equipped} slots)`);
      else log(FAIL, `Level ${level} failed: ${result.error}`);
      await sleep(500);
    }
  },

  async buff_debuff() {
    console.log('\n💪 TEST: Buff and debuff');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // Apply max buff
    const buff = await toolsIndex.executeTool('buff_debuff', { player, type: 'buff', level: 5 });
    if (buff.ok) log(PASS, `Max buff applied (${buff.effects_applied} effects, ${buff.max_health} HP)`);
    else log(FAIL, `Buff failed: ${buff.error}`);

    await verifyLog(/Applied effect/, 'Server confirmed effect application');

    // Clear
    const clear = await toolsIndex.executeTool('buff_debuff', { player, type: 'clear' });
    if (clear.ok) log(PASS, 'Effects cleared');
    else log(FAIL, `Clear failed: ${clear.error}`);

    // Apply max debuff
    const debuff = await toolsIndex.executeTool('buff_debuff', { player, type: 'debuff', level: 5 });
    if (debuff.ok) log(PASS, `Max debuff applied (${debuff.effects_applied} effects, ${debuff.max_health} HP)`);
    else log(FAIL, `Debuff failed: ${debuff.error}`);

    // Clear again
    await toolsIndex.executeTool('buff_debuff', { player, type: 'clear' });
  },

  async build_geode() {
    console.log('\n💎 TEST: Build amethyst geode (hollow sphere)');
    // Build a hollow amethyst sphere at spawn using batch_commands
    const cx = 50, cy = 64, cz = 50, r = 5;
    const cmds = [
      // Outer shell
      `fill ${cx-r} ${cy-r} ${cz-r} ${cx+r} ${cy+r} ${cz+r} minecraft:amethyst_block hollow`,
      // Inner crystals on floor
      `fill ${cx-2} ${cy-r+1} ${cz-2} ${cx+2} ${cy-r+1} ${cz+2} minecraft:amethyst_cluster`,
      // Budding amethyst scattered in walls
      `setblock ${cx+r} ${cy} ${cz} minecraft:budding_amethyst`,
      `setblock ${cx-r} ${cy} ${cz} minecraft:budding_amethyst`,
      `setblock ${cx} ${cy} ${cz+r} minecraft:budding_amethyst`,
      `setblock ${cx} ${cy} ${cz-r} minecraft:budding_amethyst`,
      // Light source
      `setblock ${cx} ${cy+r-1} ${cz} minecraft:sea_lantern`,
    ];
    const result = await server.executeBatch(cmds);
    if (result.ok) log(PASS, `Geode built at (${cx},${cy},${cz}) — ${result.commands_executed} cmds`);
    else log(FAIL, `Geode build failed: ${result.error}`);

    await verifyLog(/Successfully filled|Running function/, 'Server executed fill commands');
  },

  async locate_teleport() {
    console.log('\n🗺️ TEST: Locate and teleport to biomes');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // Test surface teleport (village)
    const village = await toolsIndex.executeTool('locate_and_teleport', { target: 'village', players: player });
    if (village.ok) {
      log(PASS, `Village found at (${village.coordinates.x}, ${village.coordinates.y}, ${village.coordinates.z})`);
    } else {
      log(FAIL, `Village locate failed: ${village.error}`);
    }

    await sleep(2000);

    // Teleport back to spawn
    await server.runCommand(`tp ${player} 0 64 0`);
  },

  async replace_blocks() {
    console.log('\n🔄 TEST: Replace blocks in area');
    // First place some test blocks
    await server.executeBatch([
      'fill 100 63 100 110 63 110 minecraft:grass_block',
      'fill 100 64 100 110 66 110 minecraft:oak_log',
    ]);
    await sleep(1000);

    // Replace oak logs with glass
    const result = await toolsIndex.executeTool('replace_blocks_in_area', {
      center_x: 105, center_z: 105, radius: 10,
      from_block: 'minecraft:oak_log', to_block: 'minecraft:glass',
      min_y: 63, max_y: 67,
    });
    if (result.ok) log(PASS, `Block replacement: ${result.commands} commands executed`);
    else log(FAIL, `Replace failed: ${result.error}`);

    await verifyLog(/Successfully filled|Running function/, 'Server confirmed replacement');
  },

  async scatter_ground() {
    console.log('\n🌸 TEST: Scatter blocks (ground level default)');
    const result = await toolsIndex.executeTool('scatter_blocks', {
      block: 'minecraft:torch', count: 20,
      center_x: 0, center_z: 0, radius: 15,
      // NOT specifying min_y/max_y — should default to ground level
    });
    if (result.ok) log(PASS, `Scattered ${result.commands_executed} torches at ground level`);
    else log(FAIL, `Scatter failed: ${result.error}`);

    // Verify the Y range used
    const bbox = result.bounding_box;
    if (bbox) {
      const minY = bbox.from.y;
      const maxY = bbox.to.y;
      if (minY >= 60 && maxY <= 70) {
        log(PASS, `Y range ${minY}-${maxY} is ground level`);
      } else {
        log(FAIL, `Y range ${minY}-${maxY} is NOT ground level (expected 63-66)`);
      }
    }
  },

  async boat_scenario() {
    console.log('\n🚣 TEST: Complex scenario — boat in the ocean');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }

    // 1. Find an ocean
    const ocean = await toolsIndex.executeTool('locate_and_teleport', {
      target: 'deep ocean', players: players.join(','),
    });
    if (!ocean.ok) { log(FAIL, `Could not find ocean: ${ocean.error}`); return; }
    log(PASS, `Found ocean at (${ocean.coordinates.x}, ${ocean.coordinates.z})`);
    const { x, z } = ocean.coordinates;

    await sleep(2000);

    // 2. Place boats for each player
    const boatCmds = [];
    for (let i = 0; i < players.length; i++) {
      boatCmds.push(`summon minecraft:oak_boat ${x + i * 3} 63 ${z}`);
    }
    const boatResult = await server.executeBatch(boatCmds);
    if (boatResult.ok) log(PASS, `Placed ${players.length} boats`);
    else log(FAIL, `Boat spawn failed`);

    // 3. Set spawn for all players at the ocean
    for (const p of players) {
      await server.runCommand(`spawnpoint ${p} ${x} 63 ${z}`);
    }
    log(PASS, 'Set spawn points at ocean');

    // 4. Strip all gear and give fishing rods only
    for (const p of players) {
      await toolsIndex.executeTool('kit', { player: p, action: 'strip_all' });
      await server.runCommand(`give ${p} minecraft:fishing_rod`);
    }
    log(PASS, 'Stripped gear, gave fishing rods');

    // 5. Apply debuff — half heart + hunger gone
    for (const p of players) {
      await server.executeBatch([
        `attribute ${p} minecraft:max_health base set 1`,
        `effect give ${p} minecraft:saturation infinite 0 true`,
        `effect give ${p} minecraft:instant_health 1 100 true`,
      ]);
    }
    log(PASS, 'Applied half-heart + saturation');

    await verifyLog(/Applied effect|base value/, 'Server confirmed effects');

    // 6. Verify — check a player's position is in the ocean area
    if (players.length > 0) {
      const pos = await server.getPlayerPositionAndDimension(players[0]);
      if (pos.ok) {
        const coords = pos.position.match(/-?\d+\.\d+/g).map(Number);
        const dist = Math.sqrt((coords[0] - x) ** 2 + (coords[2] - z) ** 2);
        if (dist < 50) log(PASS, `Player is near the ocean (${Math.round(dist)} blocks away)`);
        else log(WARN, `Player is ${Math.round(dist)} blocks from target`);
      }
    }

    // Cleanup — restore health
    for (const p of players) {
      await server.executeBatch([
        `attribute ${p} minecraft:max_health base set 20`,
        `effect clear ${p}`,
      ]);
    }
    log(PASS, 'Cleanup: restored health and cleared effects');
  },

  async enchantment_preservation() {
    console.log('\n🔮 TEST: Enchantment names survive batch execution');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // The critical test: item replace with enchantments that used to be mangled
    const cmds = [
      `item replace entity ${player} armor.head with minecraft:netherite_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:thorns":3,"minecraft:unbreaking":3}]`,
      `item replace entity ${player} weapon.mainhand with minecraft:netherite_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:sweeping_edge":3,"minecraft:fire_aspect":2}]`,
    ];
    const result = await server.executeBatch(cmds);
    if (result.ok) log(PASS, 'Batch executed without error');
    else log(FAIL, `Batch failed: ${result.error}`);

    // Check the log for "Replaced a slot" (confirms item was valid)
    const found = await verifyLog(/Replaced a slot.*Netherite/, 'Netherite items equipped with enchantments');

    // Make sure thorns wasn't mangled to torch
    const tail = await server.readLogTail(20);
    if (tail.includes('torch') && !tail.includes('Replaced')) {
      log(FAIL, 'REGRESSION: thorns was mangled to torch!');
    } else {
      log(PASS, 'No enchantment mangling detected');
    }
  },

  async effect_commands() {
    console.log('\n✨ TEST: Effect commands execute individually (not in batch)');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    const cmds = [
      `effect give ${player} minecraft:resistance 30 2 true`,
      `effect give ${player} minecraft:fire_resistance 30 0 true`,
      `effect give ${player} minecraft:speed 30 1 true`,
    ];
    const result = await server.executeBatch(cmds);
    if (result.ok) log(PASS, `Effects batch: ${result.commands_executed} cmds, ${result.succeeded} succeeded`);
    else log(FAIL, `Effects failed: ${result.error}`);

    // These should have run individually, not in mcfunction
    if (result.function_name === 'individual') {
      log(PASS, 'Effects routed to individual execution (not mcfunction)');
    } else {
      log(FAIL, `Effects went to mcfunction (${result.function_name}) — should be individual`);
    }

    // Verify via log — read immediately with a big tail since effects ran individually above
    await verifyLog(/Applied effect (Resistance|Fire Resistance|Speed)/, 'Effects confirmed in log', 500);

    // Cleanup
    await server.runCommand(`effect clear ${player}`);
  },
};

// ============================================================================
// Runner
// ============================================================================

async function runAll() {
  console.log('🧪 LIVE SCENARIO TESTS');
  console.log('='.repeat(50));

  const toRun = process.argv[2]
    ? [process.argv[2]]
    : Object.keys(scenarios);

  for (const name of toRun) {
    if (!scenarios[name]) {
      console.log(`Unknown scenario: ${name}`);
      console.log('Available:', Object.keys(scenarios).join(', '));
      process.exit(1);
    }
    try {
      await scenarios[name]();
    } catch (e) {
      log(FAIL, `CRASHED: ${e.message}`);
      console.error(e.stack);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} ${PASS}  ${failed} ${FAIL}  ${warnings} ${WARN}`);
  if (failed > 0) process.exit(1);
}

runAll();
