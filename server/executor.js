// Smart command execution for Minecraft.
// Routes commands based on their type: block commands go to .mcfunction batches,
// player commands (effect, give, item, attribute, tp) run individually via API.
// One bad command no longer kills an entire batch.

'use strict';

const api = require('./api');
const chunkLoader = require('./chunk-loader');
const { classify, isBatchSafe, extractFillBounds } = require('../minecraft/command');
const { normalizeCommands } = require('../minecraft/normalize');
const { isValidEntity } = require('../minecraft/registry');

let batchCounter = 0;
let currentBatchAborted = false;

// Switch player protection: the Nintendo Switch freezes when receiving thousands
// of block-change packets in one tick. We tp the Switch player to the GM platform
// (glass platform at height limit above spawn) before large operations, then
// bring them back after. The platform is far enough above ground that block
// changes below don't reach render distance.
const SWITCH_PLAYER = process.env.SWITCH_PLAYER || process.env.AUTHORIZED_OP || '.knightofiam85';
const SWITCH_PROTECTION_THRESHOLD = 50; // block commands that trigger protection

/**
 * Execute a single command with optional output capture.
 */
async function executeSingle(command, opts = {}) {
  const result = await api.sendCommand(command);
  if (!result.ok || !opts.captureOutput) return result;

  const waitMs = opts.waitMs || 1200;
  await new Promise(r => setTimeout(r, waitMs));
  const log = await api.readLogTail(60);
  const lines = log.split('\n');
  const output = lines.slice(Math.max(0, lines.length - 20)).join('\n');
  return { ok: true, command: result.command, output };
}

/**
 * Execute an array of commands intelligently.
 * - Normalizes block names in block commands
 * - Validates entities in summon commands
 * - Auto-tiles oversized fills
 * - Routes player commands (effect, give, item, attribute, tp) individually
 * - Batches block/entity/world commands into a .mcfunction for speed
 *
 * @param {string[]} commands - Array of raw command strings
 * @returns {Promise<{ ok: boolean, commands_executed: number, succeeded: number, failed: number, errors: Array, warnings: string|undefined }>}
 */
async function executeBatch(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return { ok: false, error: 'commands must be a non-empty array' };
  }

  // Step 1: Normalize block names (only touches fill/setblock/place commands)
  const { commands: normalized, corrections, rejected } = normalizeCommands(commands);
  if (rejected.length > 0) {
    console.warn(`[executor] rejected ${rejected.length} commands:`, rejected.slice(0, 5));
  }

  // Step 2: Classify and validate each command
  const classified = [];
  for (const raw of normalized) {
    const cmd = classify(raw);

    // Validate summon entities against registry
    if (cmd.type === 'summon') {
      const entityMatch = cmd.inner.match(/summon (minecraft:[a-z_0-9]+)/);
      if (entityMatch && !isValidEntity(entityMatch[1])) {
        rejected.push({ cmd: raw.slice(0, 80), reason: `unknown entity: ${entityMatch[1]}` });
        continue;
      }
    }

    classified.push(cmd);
  }

  // Step 3: Auto-tile oversized fills
  const tiled = autoTileFills(classified);
  const totalCount = tiled.length;

  if (totalCount > 50000) {
    return { ok: false, error: `too many commands after tiling (${totalCount}, max 50000)` };
  }

  // Step 4: Separate batch-safe commands from individual commands
  const batchCmds = [];
  const individualCmds = [];
  for (const cmd of tiled) {
    if (isBatchSafe(cmd)) {
      batchCmds.push(cmd);
    } else {
      individualCmds.push(cmd);
    }
  }

  // Step 5: Run individual commands first (effect, attribute, give, item, tp)
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const cmd of individualCmds) {
    const result = await api.sendCommand(cmd.raw);
    if (result.ok) {
      succeeded++;
    } else {
      failed++;
      errors.push({ cmd: cmd.raw.slice(0, 80), error: result.error || 'command failed' });
    }
  }

  // Step 6: Batch block/entity/world commands via .mcfunction
  if (batchCmds.length > 0) {
    // Auto-chunk-loading for fill commands
    const bounds = extractFillBounds(batchCmds);
    if (bounds) {
      const xSpan = bounds.maxX - bounds.minX;
      const zSpan = bounds.maxZ - bounds.minZ;
      if (xSpan <= 400 && zSpan <= 400) {
        await chunkLoader.ensureLoaded(bounds, bounds.dimension);
      }
    }

    // Switch protection: tp the Switch player away before large block operations
    // so they don't receive thousands of block-change packets that freeze the client.
    const blockCmdCount = batchCmds.filter(c => c.category === 'block').length;
    let switchPlayerSaved = null;
    if (SWITCH_PLAYER && blockCmdCount >= SWITCH_PROTECTION_THRESHOLD) {
      try {
        const { getPlayerPositionAndDimension } = require('./log-reader');
        const pos = await getPlayerPositionAndDimension(SWITCH_PLAYER);
        if (pos.ok) {
          switchPlayerSaved = pos;
          const gm = require('./gamemaster');
          const safePos = gm.getGMSpawn();
          console.log(`[executor] switch protection: moving ${SWITCH_PLAYER} to GM platform (${blockCmdCount} block cmds)`);
          await api.sendCommand(`tp ${SWITCH_PLAYER} ${safePos.x} ${safePos.y} ${safePos.z}`);
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        // Player may be offline (on phone) — that's fine, no protection needed
      }
    }

    batchCounter++;
    currentBatchAborted = false;
    const funcName = `batch_${batchCounter}`;
    const funcContent = batchCmds.map(c => c.raw.startsWith('/') ? c.raw.slice(1) : c.raw).join('\n') + '\n';

    // Ensure datapack exists (may be missing after world reset)
    const mcmeta = JSON.stringify({ pack: { pack_format: 71, description: 'Claude bot batch commands' } });
    await api.writeFile('/world/datapacks/claude-bot/pack.mcmeta', mcmeta).catch(() => {});

    // Write the .mcfunction file
    const filePath = `/world/datapacks/claude-bot/data/claude/function/${funcName}.mcfunction`;
    const writeResult = await api.writeFile(filePath, funcContent);
    if (!writeResult.ok) {
      return { ok: false, error: `failed to write mcfunction: ${writeResult.status}` };
    }

    // Reload and execute
    await api.sendCommand('reload');
    await new Promise(r => setTimeout(r, 800));

    if (currentBatchAborted) {
      return { ok: false, error: 'batch was cancelled before execution' };
    }

    await api.sendCommand(`function claude:${funcName}`);
    succeeded += batchCmds.length;

    // Cleanup forceloaded chunks
    if (bounds) {
      await chunkLoader.cleanup(bounds.dimension);
    }

    // Delete the .mcfunction file to prevent stale file accumulation
    try {
      await api.deleteFiles('/world/datapacks/claude-bot/data/claude/function', [`${funcName}.mcfunction`]);
    } catch (e) {
      console.warn(`[executor] cleanup failed for ${funcName}:`, e.message);
    }

    // Switch protection: leave the GM on the platform (their home base).
    // The platform is safe and they can see everything from up there.
    // Only tp them back if they were NOT already on/near the platform.
    if (switchPlayerSaved) {
      try {
        const coords = switchPlayerSaved.position.match(/-?\d+\.\d+/g);
        if (coords && coords.length >= 3) {
          const origY = parseFloat(coords[1]);
          const gm = require('./gamemaster');
          // If they were already near the platform (within 20 blocks), leave them there
          if (Math.abs(origY - gm.PLATFORM.y) > 20) {
            // They were on the ground — wait for block changes to settle, then return them
            await new Promise(r => setTimeout(r, 2000));
            const [px, py, pz] = coords.map(c => Math.floor(parseFloat(c)));
            const dp = chunkLoader.dimPrefix(switchPlayerSaved.dimension);
            await api.sendCommand(`${dp}tp ${SWITCH_PLAYER} ${px} ${py} ${pz}`);
            console.log(`[executor] switch protection: returned ${SWITCH_PLAYER} to ${px} ${py} ${pz}`);
          } else {
            console.log(`[executor] switch protection: ${SWITCH_PLAYER} stays on platform`);
          }
        }
      } catch (e) {
        console.warn(`[executor] switch protection: failed to return player:`, e.message);
      }
    }
  }

  const result = {
    ok: true,
    commands_executed: totalCount,
    succeeded,
    failed,
    function_name: batchCmds.length > 0 ? `claude:batch_${batchCounter}` : 'individual',
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  if (rejected.length > 0) {
    result.warnings = `${rejected.length} commands had invalid names and were skipped: ${rejected.slice(0, 3).map(r => r.reason).join(', ')}`;
  }
  return result;
}

function abortCurrentBatch() {
  currentBatchAborted = true;
}

/**
 * Remove all old batch_*.mcfunction files from prior sessions.
 */
async function cleanupStaleBatchFiles() {
  try {
    const files = await api.listFiles('/world/datapacks/claude-bot/data/claude/function');
    const stale = files.filter(n => /^batch_\d+\.mcfunction$/.test(n));
    if (stale.length === 0) return;
    console.log(`[executor] cleaning up ${stale.length} stale batch files`);
    await api.deleteFiles('/world/datapacks/claude-bot/data/claude/function', stale);
  } catch (e) {
    console.warn('[executor] batch cleanup failed:', e.message);
  }
}

// ============================================================================
// Auto-tiling: split oversized fill commands into chunks ≤32768 blocks
// ============================================================================

function autoTileFills(classified) {
  const MAX_VOLUME = 32768;
  const result = [];
  const fillRe = /^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (.+)$/;

  for (const cmd of classified) {
    if (cmd.type !== 'fill') {
      result.push(cmd);
      continue;
    }
    const m = cmd.inner.match(fillRe);
    if (!m) {
      result.push(cmd);
      continue;
    }
    const [, sx1, sy1, sz1, sx2, sy2, sz2, rest] = m;
    const x1 = Math.min(+sx1, +sx2), x2 = Math.max(+sx1, +sx2);
    const y1 = Math.min(+sy1, +sy2), y2 = Math.max(+sy1, +sy2);
    const z1 = Math.min(+sz1, +sz2), z2 = Math.max(+sz1, +sz2);
    const vol = (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
    if (vol <= MAX_VOLUME) {
      result.push(cmd);
      continue;
    }
    // Split into tiles
    const prefix = cmd.dimension ? `execute in ${cmd.dimension} run ` : '';
    const yRange = y2 - y1 + 1;
    const tileSize = Math.max(1, Math.floor(Math.sqrt(MAX_VOLUME / yRange)));
    for (let tx = x1; tx <= x2; tx += tileSize) {
      for (let tz = z1; tz <= z2; tz += tileSize) {
        const tx2 = Math.min(tx + tileSize - 1, x2);
        const tz2 = Math.min(tz + tileSize - 1, z2);
        const tileRaw = `${prefix}fill ${tx} ${y1} ${tz} ${tx2} ${y2} ${tz2} ${rest}`;
        result.push(classify(tileRaw));
      }
    }
  }
  return result;
}

module.exports = {
  executeSingle, executeBatch, abortCurrentBatch, cleanupStaleBatchFiles,
};
