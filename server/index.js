// Server module — clean interface for all server operations.

'use strict';

const api = require('./api');
const executor = require('./executor');
const chunkLoader = require('./chunk-loader');
const logReader = require('./log-reader');
const { qualify } = require('../minecraft/registry');
const { fixCommand } = require('../minecraft/fix-command');

// ============================================================================
// High-level command helpers (convenience wrappers)
// ============================================================================

async function runCommand(command, opts = {}) {
  // Fix common mistakes (old attribute names, missing minecraft: prefix, etc.)
  // This ensures even raw run_command fallback commands get corrected.
  const fixed = fixCommand(command);
  if (fixed !== command) {
    console.log(`[server] auto-fixed command: ${command.slice(0, 60)} → ${fixed.slice(0, 60)}`);
  }
  if (opts.captureOutput) {
    return logReader.runAndCapture(fixed, opts);
  }
  return api.sendCommand(fixed);
}

async function setBlock(x, y, z, block, dimension) {
  const dp = chunkLoader.dimPrefix(dimension);
  return api.sendCommand(`${dp}setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${qualify(block)}`);
}

async function fillBlocks(x1, y1, z1, x2, y2, z2, block, mode = 'replace', dimension) {
  const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
  if (volume > 32768) {
    return { ok: false, error: `fill region too large: ${volume} blocks (max 32768). Split into chunks.` };
  }
  const dp = chunkLoader.dimPrefix(dimension);
  return api.sendCommand(`${dp}fill ${Math.floor(x1)} ${Math.floor(y1)} ${Math.floor(z1)} ${Math.floor(x2)} ${Math.floor(y2)} ${Math.floor(z2)} ${qualify(block)} ${mode}`);
}

async function giveItem(player, item, count = 1) {
  return api.sendCommand(`give ${player} ${qualify(item)} ${count}`);
}

async function teleport(player, x, y, z, dimension) {
  const dp = chunkLoader.dimPrefix(dimension);
  return api.sendCommand(`${dp}tp ${player} ${x} ${y} ${z}`);
}

async function summon(entity, x, y, z, nbt, count = 1, dimension) {
  const ent = qualify(entity);
  const dp = chunkLoader.dimPrefix(dimension);
  const n = Math.max(1, Math.min(100, count));
  for (let i = 0; i < n; i++) {
    const ox = (x + (Math.random() * 10 - 5)).toFixed(1);
    const oz = (z + (Math.random() * 10 - 5)).toFixed(1);
    const cmd = nbt
      ? `${dp}summon ${ent} ${ox} ${y} ${oz} ${nbt}`
      : `${dp}summon ${ent} ${ox} ${y} ${oz}`;
    await api.sendCommand(cmd);
  }
  return { ok: true, spawned: n, entity: ent, center: { x, y, z } };
}

async function scatterBlocks(block, count, cx, cz, radius, minY, maxY, dimension) {
  const ent = qualify(block);
  const dp = chunkLoader.dimPrefix(dimension);
  const n = Math.max(1, Math.min(5000, count));
  const cmds = [];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(cx + (Math.random() * 2 - 1) * radius);
    const y = Math.floor(minY + Math.random() * (maxY - minY));
    const z = Math.floor(cz + (Math.random() * 2 - 1) * radius);
    cmds.push(`${dp}setblock ${x} ${y} ${z} ${ent}`);
  }
  const result = await executor.executeBatch(cmds);
  result.bounding_box = {
    from: { x: Math.floor(cx - radius), y: minY, z: Math.floor(cz - radius) },
    to: { x: Math.floor(cx + radius), y: maxY, z: Math.floor(cz + radius) },
  };
  result.center = { x: Math.floor(cx), z: Math.floor(cz) };
  return result;
}

// ============================================================================
// Server stats
// ============================================================================

async function getServerStats() {
  const res = await api.getResources();
  if (!res.ok) return res;

  const a = res.data;
  if (!a) return { ok: false, error: 'unexpected response shape' };

  const r = a.resources || {};
  const memBytes = Number(r.memory_bytes || 0);
  const memMB = Math.round(memBytes / 1024 / 1024);

  // Query the actual plan limit from the API
  let planMB = 8192;
  const limits = await api.getServerLimits();
  if (limits?.memory) planMB = limits.memory;

  const cpuPct = Number(r.cpu_absolute || 0);
  const diskMB = Math.round(Number(r.disk_bytes || 0) / 1024 / 1024);
  const uptimeSec = Math.round(Number(r.uptime || 0) / 1000);
  const mc = a.minecraft_resources || {};

  return {
    ok: true,
    state: a.current_state,
    memory_used_mb: memMB,
    memory_plan_mb: planMB,
    memory_pct: Math.round((memMB / planMB) * 100),
    cpu_pct: Number(cpuPct.toFixed(1)),
    disk_used_mb: diskMB,
    uptime_seconds: uptimeSec,
    uptime_hours: Number((uptimeSec / 3600).toFixed(1)),
    tps: mc.minecraft_tps || null,
    chunks_loaded: mc.minecraft_chunks || null,
    entities: mc.minecraft_entities || null,
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Command execution
  runCommand,
  executeBatch: executor.executeBatch,
  abortCurrentBatch: executor.abortCurrentBatch,
  cleanupStaleBatchFiles: executor.cleanupStaleBatchFiles,
  // Convenience commands
  setBlock, fillBlocks, giveItem, teleport, summon, scatterBlocks,
  // Player/log queries
  getPlayerData: logReader.getPlayerData,
  getPlayerPositionAndDimension: logReader.getPlayerPositionAndDimension,
  listPlayers: logReader.listPlayers,
  readLogTail: api.readLogTail,
  // Server management
  getServerStats,
  // Sub-modules (for direct access)
  api, executor, chunkLoader, logReader,
};
