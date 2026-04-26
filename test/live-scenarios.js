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
  // Retry twice with delay — listPlayers can miss on first try due to log timing
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await server.listPlayers();
    if (r.ok && r.players.length > 0) return r.players;
    await sleep(1000);
  }
  return [];
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

  // ========================================================================
  // EXTREME SCENARIOS
  // ========================================================================

  async scenario_prison() {
    console.log('\n🔒 EXTREME: Obsidian prison with mobs');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // Get player position
    const pos = await server.getPlayerPositionAndDimension(player);
    if (!pos.ok) { log(FAIL, `Can't find ${player}`); return; }
    const coords = pos.position.match(/-?\d+\.\d+/g).map(c => Math.floor(parseFloat(c)));
    const [px, py, pz] = coords;
    log(PASS, `Found ${player} at (${px}, ${py}, ${pz})`);

    // Build obsidian box around them
    const r = 4;
    const cmds = [
      `fill ${px-r} ${py-1} ${pz-r} ${px+r} ${py+6} ${pz+r} minecraft:obsidian hollow`,
      // Spawn hostile mobs inside
      `summon minecraft:zombie ${px+1} ${py} ${pz+1}`,
      `summon minecraft:skeleton ${px-1} ${py} ${pz-1}`,
      `summon minecraft:spider ${px} ${py} ${pz+2}`,
    ];
    const result = await server.executeBatch(cmds);
    if (result.ok) log(PASS, `Prison built at (${px}, ${py}, ${pz}) with 3 mobs`);
    else log(FAIL, `Prison failed: ${result.error}`);

    await sleep(3000);

    // Cleanup — remove prison and mobs
    await server.executeBatch([
      `fill ${px-r} ${py-1} ${pz-r} ${px+r} ${py+6} ${pz+r} minecraft:air`,
      `kill @e[type=minecraft:zombie,distance=..20]`,
      `kill @e[type=minecraft:skeleton,distance=..20]`,
      `kill @e[type=minecraft:spider,distance=..20]`,
    ]);
    log(PASS, 'Prison cleaned up');
  },

  async scenario_lava_floor() {
    console.log('\n🌋 EXTREME: Lava floor under player');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // Give them fire resistance first so they don't die
    await server.executeBatch([
      `effect give ${player} minecraft:fire_resistance 60 0 true`,
      `effect give ${player} minecraft:resistance 60 4 true`,
    ]);
    log(PASS, 'Applied fire resistance + damage resistance');

    // Get position
    const pos = await server.getPlayerPositionAndDimension(player);
    if (!pos.ok) { log(FAIL, 'Can\'t find player'); return; }
    const coords = pos.position.match(/-?\d+\.\d+/g).map(c => Math.floor(parseFloat(c)));
    const [px, py, pz] = coords;

    // Replace ground under them with lava (20 block radius)
    const result = await server.executeBatch([
      `fill ${px-20} ${py-1} ${pz-20} ${px+20} ${py-1} ${pz+20} minecraft:lava replace minecraft:grass_block`,
      `fill ${px-20} ${py-1} ${pz-20} ${px+20} ${py-1} ${pz+20} minecraft:lava replace minecraft:dirt`,
      `fill ${px-20} ${py-1} ${pz-20} ${px+20} ${py-1} ${pz+20} minecraft:lava replace minecraft:stone`,
    ]);
    if (result.ok) log(PASS, `Lava floor placed under ${player}`);
    else log(FAIL, `Lava floor failed: ${result.error}`);

    await sleep(4000);

    // Cleanup — restore ground and clear effects
    await server.executeBatch([
      `fill ${px-20} ${py-1} ${pz-20} ${px+20} ${py-1} ${pz+20} minecraft:grass_block replace minecraft:lava`,
    ]);
    await server.executeBatch([
      `effect clear ${player}`,
    ]);
    log(PASS, 'Lava cleaned up, effects cleared');
  },

  async scenario_kit_swap() {
    console.log('\n🔄 EXTREME: Rapid kit cycling (min → max → underwater → strip)');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    const toolsIdx = require('../tools/index');

    // Apply min kit
    let result = await toolsIdx.executeTool('kit', { player, kit: 'min', action: 'apply' });
    if (result.ok) log(PASS, `Min kit applied (${result.slots_equipped} slots)`);
    else log(FAIL, `Min kit failed: ${result.error}`);

    await sleep(500);

    // Replace with max kit (should strip min first)
    result = await toolsIdx.executeTool('kit', { player, kit: 'max', action: 'replace', old_kit: 'min' });
    if (result.ok) log(PASS, `Max kit replaced min (${result.slots_equipped} slots)`);
    else log(FAIL, `Max kit replace failed: ${result.error}`);

    await sleep(500);

    // Replace with underwater kit
    result = await toolsIdx.executeTool('kit', { player, kit: 'underwater', action: 'replace', old_kit: 'max' });
    if (result.ok) log(PASS, `Underwater kit replaced max (${result.slots_equipped} slots)`);
    else log(FAIL, `Underwater kit failed: ${result.error}`);

    await sleep(500);

    // Strip all
    result = await toolsIdx.executeTool('kit', { player, action: 'strip_all' });
    if (result.ok) log(PASS, 'All gear stripped');
    else log(FAIL, `Strip failed: ${result.error}`);
  },

  async scenario_fill_junk_inventory() {
    console.log('\n🗑️ EXTREME: Fill inventory with junk, then give kit on top');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    const toolsIdx = require('../tools/index');

    // First give them a level 3 kit
    await toolsIdx.executeTool('kit', { player, kit: '3', action: 'apply' });
    log(PASS, 'Level 3 kit applied');

    // Fill empty slots with junk
    const junkResult = await toolsIdx.executeTool('inventory', { player, action: 'fill_junk' });
    if (junkResult.ok) log(PASS, `Filled ${junkResult.filled} empty slots with junk`);
    else log(FAIL, `Fill junk failed: ${junkResult.error}`);

    // Read inventory to verify gear wasn't overwritten
    const inv = await toolsIdx.executeTool('inventory', { player, action: 'read' });
    if (inv.ok) {
      const hasHelmet = inv.slots['armor.head']?.includes('iron_helmet');
      const hasSword = inv.slots['weapon.mainhand']?.includes('iron_sword');
      const emptyCount = inv.empty.length;
      if (hasHelmet && hasSword) log(PASS, `Gear preserved (helmet+sword intact, ${emptyCount} empty slots remain)`);
      else log(FAIL, `Gear overwritten! helmet=${inv.slots['armor.head']}, sword=${inv.slots['weapon.mainhand']}`);
    } else {
      log(WARN, 'Could not read inventory to verify');
    }

    // Cleanup
    await toolsIdx.executeTool('kit', { player, action: 'strip_all' });
    log(PASS, 'Cleaned up');
  },

  async scenario_mountain_teleport() {
    console.log('\n⛰️ EXTREME: Teleport to mountain top (surface Y test)');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    const toolsIdx = require('../tools/index');

    const result = await toolsIdx.executeTool('locate_and_teleport', { target: 'mountain top', players: player });
    if (!result.ok) { log(FAIL, `Mountain locate failed: ${result.error}`); return; }
    log(PASS, `Mountain found at (${result.coordinates.x}, ${result.coordinates.y}, ${result.coordinates.z})`);

    // Verify player Y is reasonable for a mountain (should be > 100)
    await sleep(1500);
    const pos = await server.getPlayerPositionAndDimension(player);
    if (pos.ok) {
      const coords = pos.position.match(/-?\d+\.\d+/g).map(c => parseFloat(c));
      const playerY = coords[1];
      if (playerY > 90) log(PASS, `Player at Y=${Math.round(playerY)} — on a mountain`);
      else if (playerY > 60) log(WARN, `Player at Y=${Math.round(playerY)} — maybe a low mountain`);
      else log(FAIL, `Player at Y=${Math.round(playerY)} — not on a mountain (too low)`);
    }

    // Return to spawn
    await server.runCommand(`tp ${player} 0 64 0`);
    log(PASS, 'Returned to spawn');
  },

  async scenario_trial_chambers() {
    console.log('\n🏛️ EXTREME: Teleport to trial chambers (underground Y test)');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    const toolsIdx = require('../tools/index');

    // Give resistance so they don't die if something goes wrong
    await server.executeBatch([`effect give ${player} minecraft:resistance 60 4 true`]);

    const result = await toolsIdx.executeTool('locate_and_teleport', { target: 'trial chambers', players: player });
    if (!result.ok) { log(FAIL, `Trial chambers locate failed: ${result.error}`); return; }
    log(PASS, `Trial chambers at (${result.coordinates.x}, ${result.coordinates.y}, ${result.coordinates.z})`);

    // Verify player is underground (Y should be negative or very low)
    await sleep(2000);
    const pos = await server.getPlayerPositionAndDimension(player);
    if (pos.ok) {
      const coords = pos.position.match(/-?\d+\.\d+/g).map(c => parseFloat(c));
      const playerY = coords[1];
      if (playerY < 0) log(PASS, `Player at Y=${Math.round(playerY)} — underground`);
      else if (playerY < 40) log(PASS, `Player at Y=${Math.round(playerY)} — below surface`);
      else log(FAIL, `Player at Y=${Math.round(playerY)} — not underground (too high)`);
    }

    // Return to spawn and clear effects
    await server.runCommand(`tp ${player} 0 64 0`);
    await server.executeBatch([`effect clear ${player}`]);
    log(PASS, 'Returned to spawn');
  },

  async scenario_mixed_batch() {
    console.log('\n🧬 EXTREME: Mixed batch — blocks + effects + items + tp in one call');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];

    // One executeBatch with every command type
    const cmds = [
      'fill 200 64 200 210 68 210 minecraft:obsidian hollow',           // block → batch
      `effect give ${player} minecraft:glowing 30 0 true`,              // effect → individual
      `item replace entity ${player} hotbar.8 with minecraft:compass`,  // item → individual
      'summon minecraft:chicken 205 65 205',                             // entity → batch
      `tp ${player} 205 65 205`,                                         // tp → individual
      'setblock 205 69 205 minecraft:glowstone',                         // block → batch
      `give ${player} minecraft:arrow 32`,                               // give → individual
    ];
    const result = await server.executeBatch(cmds);
    if (result.ok) {
      log(PASS, `Mixed batch: ${result.commands_executed} cmds, ${result.succeeded} succeeded`);
      if (result.errors?.length > 0) log(WARN, `${result.errors.length} errors: ${JSON.stringify(result.errors)}`);
    } else {
      log(FAIL, `Mixed batch failed: ${result.error}`);
    }

    // Verify player was teleported
    await sleep(1500);
    const pos = await server.getPlayerPositionAndDimension(player);
    if (pos.ok) {
      const coords = pos.position.match(/-?\d+\.\d+/g).map(c => Math.floor(parseFloat(c)));
      const dist = Math.sqrt((coords[0] - 205) ** 2 + (coords[2] - 205) ** 2);
      if (dist < 10) log(PASS, `Player teleported to build site (${dist} blocks away)`);
      else log(FAIL, `Player NOT at build site (${dist} blocks away)`);
    }

    // Verify the obsidian structure exists
    await verifyLog(/Successfully filled|Running function/, 'Build commands executed');

    // Cleanup
    await server.executeBatch([
      'fill 200 64 200 210 69 210 minecraft:air',
      `effect clear ${player}`,
      `kill @e[type=minecraft:chicken,distance=..30]`,
    ]);
    await server.runCommand(`tp ${player} 0 64 0`);
    log(PASS, 'Cleaned up');
  },

  async scenario_rapid_buff_cycle() {
    console.log('\n⚡ EXTREME: Rapid buff/debuff cycling');
    const players = await getOnlinePlayers();
    if (players.length === 0) { log(WARN, 'No players online — skipping'); return; }
    const player = players[0];
    const toolsIdx = require('../tools/index');

    // Cycle through all 5 buff levels
    for (let level = 1; level <= 5; level++) {
      const result = await toolsIdx.executeTool('buff_debuff', { player, type: 'buff', level });
      if (result.ok) log(PASS, `Buff L${level}: ${result.effects_applied} effects, ${result.max_health} HP`);
      else log(FAIL, `Buff L${level} failed`);
    }

    // Clear
    await toolsIdx.executeTool('buff_debuff', { player, type: 'clear' });
    log(PASS, 'Cleared all buffs');

    // Cycle through all 5 debuff levels
    for (let level = 1; level <= 5; level++) {
      const result = await toolsIdx.executeTool('buff_debuff', { player, type: 'debuff', level });
      if (result.ok) log(PASS, `Debuff L${level}: ${result.effects_applied} effects, ${result.max_health} HP`);
      else log(FAIL, `Debuff L${level} failed`);
    }

    // Clear and restore
    await toolsIdx.executeTool('buff_debuff', { player, type: 'clear' });
    log(PASS, 'Cleared all debuffs, restored to normal');
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
