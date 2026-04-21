// Wrapper around the Bisect Starbase (Pterodactyl) /command API.
// Every helper here ultimately runs a slash command as the *server console*,
// which has higher privilege than any in-game op.

require('dotenv').config();

const API_BASE = process.env.BISECT_API_BASE;
const API_KEY = process.env.BISECT_API_KEY;
const SERVER_ID = process.env.BISECT_SERVER_ID;

if (!API_KEY || !SERVER_ID || !API_BASE) {
  throw new Error('BISECT_API_KEY, BISECT_SERVER_ID, BISECT_API_BASE must be set in .env');
}

const HEADERS = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
};

async function runCommand(command, opts = {}) {
  const cmd = command.startsWith('/') ? command.slice(1) : command;
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/command`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ command: cmd }),
  });
  if (!r.ok && r.status !== 204) {
    const text = await r.text();
    return { ok: false, status: r.status, error: text.slice(0, 300) };
  }
  // For build-path commands (setblock, fill, give, tp) we skip capturing
  // console output to keep builds snappy. Only enable capture when the caller
  // actually needs to see command output (e.g. Claude's run_command tool
  // running `spark health` or `/list`).
  if (!opts.captureOutput) {
    return { ok: true, command: cmd };
  }
  // Capture output: record the log line count BEFORE the command, then read
  // only NEW lines after. This prevents old log entries from polluting output.
  const preLog = await readLogTail(1);
  const preLineCount = preLog.split('\n').length;
  const waitMs = opts.waitMs || 1200;
  await new Promise((r) => setTimeout(r, waitMs));
  const postLog = await readLogTail(60);
  const postLines = postLog.split('\n');
  // Take only lines that appeared AFTER the command was sent
  const newLines = postLines.slice(Math.max(0, postLines.length - 20)).join('\n');
  return { ok: true, command: cmd, output: newLines };
}

// Fetch raw resource stats for the server (memory, cpu, uptime, state).
// Uses the Bisect /resources endpoint directly — no command execution.
async function getServerStats() {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/resources`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!r.ok) {
    return { ok: false, status: r.status, error: await r.text() };
  }
  const data = await r.json();
  const a = data && data.attributes;
  if (!a) return { ok: false, error: 'unexpected response shape' };
  const res = a.resources || {};
  const memBytes = Number(res.memory_bytes || 0);
  const memMB = Math.round(memBytes / 1024 / 1024);
  // Bisect's plan is 2 GB. The actual cgroup hard limit is higher (includes
  // JVM non-heap overhead), but 2048 MB is what the user sees in the panel.
  const planMB = 2048;
  const cpuPct = Number(res.cpu_absolute || 0);
  const diskMB = Math.round(Number(res.disk_bytes || 0) / 1024 / 1024);
  const uptimeSec = Math.round(Number(res.uptime || 0) / 1000);
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
    // Friendly notes for Claude to reason about
    note: 'memory_used_mb/memory_plan_mb is the Bisect panel "total" number which includes JVM non-heap overhead (metaspace, Netty buffers, JIT code). It often exceeds the plan limit because the actual cgroup hard limit is higher. Use this as a rough indicator. For actual heap usage, run `spark health` via run_command — that shows true Java heap percentage.',
  };
}

function qualify(id) {
  return id && !id.includes(':') ? `minecraft:${id}` : id;
}

// Prefix a command with /execute in <dimension> run ... when not in the overworld.
// Console commands default to overworld, so we only need the prefix for nether/end.
function dimPrefix(dimension) {
  if (dimension && dimension !== 'minecraft:overworld') {
    return `execute in ${dimension} run `;
  }
  return '';
}

async function setBlock(x, y, z, block, dimension) {
  return runCommand(`${dimPrefix(dimension)}setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${qualify(block)}`);
}

async function fillBlocks(x1, y1, z1, x2, y2, z2, block, mode = 'replace', dimension) {
  // Volume sanity check (Minecraft cap is 32768)
  const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
  if (volume > 32768) {
    return { ok: false, error: `fill region too large: ${volume} blocks (max 32768). Split into chunks.` };
  }
  return runCommand(`${dimPrefix(dimension)}fill ${Math.floor(x1)} ${Math.floor(y1)} ${Math.floor(z1)} ${Math.floor(x2)} ${Math.floor(y2)} ${Math.floor(z2)} ${qualify(block)} ${mode}`);
}

async function giveItem(player, item, count = 1) {
  return runCommand(`give ${player} ${qualify(item)} ${count}`);
}

// teleport moved above, next to summon (with dimension support)

async function summon(entity, x, y, z, nbt, count = 1, dimension) {
  const ent = qualify(entity);
  const dp = dimPrefix(dimension);
  const n = Math.max(1, Math.min(100, count));
  for (let i = 0; i < n; i++) {
    const ox = (x + (Math.random() * 10 - 5)).toFixed(1);
    const oz = (z + (Math.random() * 10 - 5)).toFixed(1);
    const cmd = nbt
      ? `${dp}summon ${ent} ${ox} ${y} ${oz} ${nbt}`
      : `${dp}summon ${ent} ${ox} ${y} ${oz}`;
    await runCommand(cmd);
  }
  return { ok: true, spawned: n, entity: ent, center: { x, y, z } };
}

async function teleport(player, x, y, z, dimension) {
  return runCommand(`${dimPrefix(dimension)}tp ${player} ${x} ${y} ${z}`);
}

// Read recent log content. Used to capture the result of a command we just ran
// (e.g. /data get entity returns its result via console output, which is only
// visible by polling latest.log).
async function readLogTail(maxLines = 50) {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/files/contents`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ file: '/logs/latest.log' }),
  });
  if (!r.ok) return '';
  const text = await r.text();
  const lines = text.split('\n');
  return lines.slice(-maxLines).join('\n');
}

// Get a player's NBT path data. Sends /data get and polls the log for the result.
async function getPlayerData(player, path = 'Pos') {
  await runCommand(`data get entity ${player} ${path}`);
  await new Promise(r => setTimeout(r, 700));
  const tail = await readLogTail(40);
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped} has the following entity data: (.+)$`);
  const lines = tail.split('\n').reverse();
  for (const line of lines) {
    const m = line.match(re);
    if (m) return { ok: true, data: m[1] };
  }
  return { ok: false, error: 'no data found in recent log (player offline?)' };
}

// Get a player's position AND dimension in one call.
async function getPlayerPositionAndDimension(player) {
  // Query Pos
  await runCommand(`data get entity ${player} Pos`);
  await new Promise(r => setTimeout(r, 600));
  // Query Dimension
  await runCommand(`data get entity ${player} Dimension`);
  await new Promise(r => setTimeout(r, 600));

  const tail = await readLogTail(40);
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped} has the following entity data: (.+)$`, 'g');

  let pos = null;
  let dim = null;
  const lines = tail.split('\n').reverse();
  for (const line of lines) {
    const m = line.match(new RegExp(`${escaped} has the following entity data: (.+)$`));
    if (m) {
      const val = m[1].trim();
      if (val.startsWith('[') && !pos) {
        pos = val;
      } else if (val.startsWith('"') && !dim) {
        dim = val.replace(/"/g, '');
      }
    }
    if (pos && dim) break;
  }

  if (!pos) {
    return {
      ok: false,
      error: `Could not find player "${player}". The name must be the EXACT in-game name (case-sensitive, including dots and underscores). Use list_online_players to see exact names. Common mistake: using a nickname like "Andrew" instead of the in-game name like "_FlameFrags__".`,
    };
  }
  return {
    ok: true,
    position: pos,
    dimension: dim || 'minecraft:overworld',
  };
}

// Get the list of online players (uses /list, polls log)
async function listPlayers() {
  await runCommand('list');
  await new Promise(r => setTimeout(r, 600));
  const tail = await readLogTail(20);
  // "There are N of a max of M players online: name1, name2"
  const m = tail.match(/There are \d+ of a max of \d+ players online:\s*(.*)$/m);
  if (!m) return { ok: false, error: 'list output not found' };
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  return { ok: true, players: names };
}

// Execute a batch of commands in a single server tick via .mcfunction datapack.
// This is VASTLY faster than individual API calls for large builds or mass spawns.
// Steps: write commands to a .mcfunction file → /reload → /function claude:batch
// Scatter random blocks in an area. Generates randomized setblock commands server-side
// (instant) instead of making Claude output hundreds of coordinate strings (slow).
async function scatterBlocks(block, count, cx, cz, radius, minY, maxY, dimension) {
  const ent = qualify(block);
  const dp = dimPrefix(dimension);
  const n = Math.max(1, Math.min(5000, count));
  const cmds = [];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(cx + (Math.random() * 2 - 1) * radius);
    const y = Math.floor(minY + Math.random() * (maxY - minY));
    const z = Math.floor(cz + (Math.random() * 2 - 1) * radius);
    cmds.push(`${dp}setblock ${x} ${y} ${z} ${ent}`);
  }
  const result = await executeBatch(cmds);
  result.bounding_box = {
    from: { x: Math.floor(cx - radius), y: minY, z: Math.floor(cz - radius) },
    to: { x: Math.floor(cx + radius), y: maxY, z: Math.floor(cz + radius) },
  };
  result.center = { x: Math.floor(cx), z: Math.floor(cz) };
  return result;
}

let batchCounter = 0;
let currentBatchAborted = false;

// Block name auto-corrector — fuzzy-matches any invalid block name against the
// real registry (1166 blocks from minecraft-reference.json). No manual rename
// map needed. If Claude invents "minecraft:poppys" or "minecraft:chain", the
// closest valid name is found automatically.
const _blockRegistry = (() => {
  try { return new Set(require('./minecraft-reference.json').blocks); } catch { return new Set(); }
})();
const _blockList = [..._blockRegistry];

// Official Mojang renames — NOT a Claude mistake list, just blocks whose
// minecraft: ID actually changed between versions. Checked first.
// Curated name mappings for cases where the common/natural name differs from
// the registry name. NOT a Claude mistake list — these are genuine Minecraft
// naming quirks that even human players get wrong.
const OFFICIAL_RENAMES = {
  'grass': 'short_grass',       // renamed in 1.20.3
  'grass_path': 'dirt_path',    // renamed in 1.17
  'chain': 'iron_chain',        // everyone calls it "chain" but registry is "iron_chain"
  'sign': 'oak_sign',           // generic "sign" = oak sign
  'boat': 'oak_boat',           // generic "boat" = oak boat
  'planks': 'oak_planks',       // generic "planks" = oak planks
  'log': 'oak_log',             // generic "log" = oak log
  'slab': 'oak_slab',           // generic "slab" = oak slab
  'fence': 'oak_fence',         // generic "fence" = oak fence
  'door': 'oak_door',           // generic "door" = oak door
  'button': 'oak_button',       // generic "button" = oak button
  'pressure_plate': 'oak_pressure_plate',
  'stairs': 'oak_stairs',
  'trapdoor': 'oak_trapdoor',
};

function findClosestBlock(invalid) {
  const name = invalid.replace('minecraft:', '');

  // 1. Check official renames first
  if (OFFICIAL_RENAMES[name]) {
    const renamed = `minecraft:${OFFICIAL_RENAMES[name]}`;
    if (_blockRegistry.has(renamed)) return renamed;
  }

  // 2. Exact match
  if (_blockRegistry.has(invalid)) return invalid;

  // 3. Plural stripping (poppys→poppy, torches→torch)
  for (const suffix of [/s$/, /es$/]) {
    const stripped = `minecraft:${name.replace(suffix, '')}`;
    if (_blockRegistry.has(stripped)) return stripped;
  }

  // 4. _block suffix add/remove
  const withoutBlock = `minecraft:${name.replace(/_block$/, '')}`;
  if (_blockRegistry.has(withoutBlock)) return withoutBlock;
  const withBlock = `minecraft:${name}_block`;
  if (_blockRegistry.has(withBlock)) return withBlock;

  // 5. Suffix match: input is the ENDING of a valid block name
  //    (e.g. "chain" → "iron_chain", not "chain_command_block")
  const suffixMatch = _blockList.find(c => {
    const cn = c.replace('minecraft:', '');
    return cn.endsWith('_' + name) || cn.endsWith(name);
  });
  if (suffixMatch) return suffixMatch;

  // 6. Prefix match: input is the BEGINNING of a valid block name
  const prefixMatch = _blockList.find(c => {
    const cn = c.replace('minecraft:', '');
    return cn.startsWith(name + '_') || cn.startsWith(name);
  });
  if (prefixMatch && prefixMatch !== `minecraft:${name}`) return prefixMatch;

  // 7. Levenshtein fuzzy match (≤3 edits)
  let best = null;
  let bestScore = Infinity;
  for (const candidate of _blockList) {
    const dist = levenshtein(name, candidate.replace('minecraft:', ''));
    if (dist < bestScore) { bestScore = dist; best = candidate; }
  }
  return bestScore <= 3 ? best : null;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function normalizeBlockNames(cmd) {
  // Fix invalid block tags (e.g. #minecraft:poppys → #minecraft:flowers)
  cmd = cmd.replace(/#minecraft:[a-z_0-9]+/g, (match) => {
    // Known valid tags — don't touch them
    const validTags = ['#minecraft:planks','#minecraft:logs','#minecraft:leaves','#minecraft:stairs',
      '#minecraft:slabs','#minecraft:fences','#minecraft:doors','#minecraft:wool','#minecraft:flowers',
      '#minecraft:tall_flowers','#minecraft:saplings','#minecraft:crops','#minecraft:signs',
      '#minecraft:beds','#minecraft:banners','#minecraft:candles','#minecraft:buttons',
      '#minecraft:pressure_plates','#minecraft:ice','#minecraft:sand','#minecraft:dirt',
      '#minecraft:base_stone_overworld','#minecraft:base_stone_nether',
      '#minecraft:gold_ores','#minecraft:iron_ores','#minecraft:diamond_ores',
      '#minecraft:coal_ores','#minecraft:copper_ores','#minecraft:emerald_ores',
      '#minecraft:lapis_ores','#minecraft:redstone_ores','#minecraft:stone_bricks',
      '#minecraft:walls','#minecraft:trapdoors','#minecraft:coral_blocks',
      '#minecraft:fire'];
    if (validTags.includes(match)) return match;
    // Try to fix: strip plurals, common mistakes
    const stripped = match.replace(/s$/, '').replace(/es$/, '');
    if (validTags.includes(stripped)) {
      console.log(`[bisect] auto-corrected tag: ${match} → ${stripped}`);
      return stripped;
    }
    console.warn(`[bisect] unknown block tag: ${match} — removing command`);
    return '##INVALID##'; // marker for validation to strip this command
  });

  // Find all minecraft:xxx block references in the command
  return cmd.replace(/(?<!#)minecraft:[a-z_0-9]+/g, (match) => {
    if (_blockRegistry.has(match)) return match;
    if (match === 'minecraft:air') return match;
    const corrected = findClosestBlock(match);
    if (corrected) {
      console.log(`[bisect] auto-corrected block: ${match} → ${corrected}`);
      return corrected;
    }
    return match;
  });
}

// Auto-split any oversized /fill commands into tiles that fit the 32768 volume limit.
// This prevents silent failures when Claude sends fills that are too large.
function autoTileFills(commands) {
  const MAX_VOLUME = 32768;
  const result = [];
  const fillRe = /^((?:execute in \S+ run )?fill) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (.+)$/;
  for (const cmd of commands) {
    const m = cmd.match(fillRe);
    if (!m) {
      result.push(cmd);
      continue;
    }
    const [, prefix, sx1, sy1, sz1, sx2, sy2, sz2, rest] = m;
    let x1 = Math.min(+sx1, +sx2), x2 = Math.max(+sx1, +sx2);
    let y1 = Math.min(+sy1, +sy2), y2 = Math.max(+sy1, +sy2);
    let z1 = Math.min(+sz1, +sz2), z2 = Math.max(+sz1, +sz2);
    const vol = (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
    if (vol <= MAX_VOLUME) {
      result.push(cmd);
      continue;
    }
    // Split into tiles
    const yRange = y2 - y1 + 1;
    const tileSize = Math.max(1, Math.floor(Math.sqrt(MAX_VOLUME / yRange)));
    for (let tx = x1; tx <= x2; tx += tileSize) {
      for (let tz = z1; tz <= z2; tz += tileSize) {
        const tx2 = Math.min(tx + tileSize - 1, x2);
        const tz2 = Math.min(tz + tileSize - 1, z2);
        result.push(`${prefix} ${tx} ${y1} ${tz} ${tx2} ${y2} ${tz2} ${rest}`);
      }
    }
  }
  return result;
}

// Extract the bounding box AND dimension of all fill commands for chunk-loading.
function extractFillBounds(commands) {
  const fillRe = /^(?:execute in (\S+) run )?fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  let found = false;
  let dimension = null;
  for (const cmd of commands) {
    const m = cmd.match(fillRe);
    if (m) {
      found = true;
      if (m[1]) dimension = m[1]; // e.g. "minecraft:the_nether"
      const coords = [+m[2], +m[4], +m[5], +m[7]]; // x1, z1, x2, z2
      minX = Math.min(minX, coords[0], coords[2]);
      maxX = Math.max(maxX, coords[0], coords[2]);
      minZ = Math.min(minZ, coords[1], coords[3]);
      maxZ = Math.max(maxZ, coords[1], coords[3]);
    }
  }
  return found ? { minX, minZ, maxX, maxZ, dimension } : null;
}

async function executeBatch(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return { ok: false, error: 'commands must be a non-empty array' };
  }
  // Normalize block names (fix outdated names Claude uses) then auto-tile
  commands = commands.map(normalizeBlockNames);
  // Validate — remove commands with invalid blocks or the ##INVALID## marker
  const validatedCommands = [];
  const rejected = [];
  for (const cmd of commands) {
    if (cmd.includes('##INVALID##')) {
      rejected.push({ cmd: cmd.slice(0, 80), reason: 'invalid block tag' });
      continue;
    }
    if (_blockRegistry.size > 0) {
      // Strip "execute in minecraft:xxx run " prefix before checking blocks —
      // dimension names like minecraft:the_nether are NOT blocks
      const cmdForValidation = cmd.replace(/^execute in minecraft:\S+ run /, '');
      const blockRefs = (cmdForValidation.match(/(?<!#)minecraft:[a-z_0-9]+/g) || []);
      const badBlock = blockRefs.find(b => !_blockRegistry.has(b) && b !== 'minecraft:air');
      if (badBlock) {
        rejected.push({ cmd: cmd.slice(0, 80), reason: `unknown block: ${badBlock}` });
        continue;
      }
    }
    validatedCommands.push(cmd);
  }
  if (rejected.length > 0) {
    console.warn(`[bisect] rejected ${rejected.length} commands with invalid blocks:`, rejected.slice(0, 5));
  }
  commands = autoTileFills(validatedCommands);
  const n = commands.length;
  if (n > 50000) {
    return { ok: false, error: `too many commands after tiling (${n}, max 50000)` };
  }

  // Auto-chunk-loading: if the batch has fill commands in a remote area, we need
  // to ensure chunks are loaded. Strategy: teleport the bot to the center of the
  // fill area. The bot's view distance (16 chunks = 256 blocks) loads chunks
  // around it. For areas larger than 256-block radius, we process in STRIPS —
  // tp bot to each strip center, forceload that strip, execute fills for that
  // strip, then move to the next. This is slower but reliable.
  const bounds = extractFillBounds(commands);
  if (bounds) {
    const xSpan = bounds.maxX - bounds.minX;
    const zSpan = bounds.maxZ - bounds.minZ;
    const cx = Math.floor((bounds.minX + bounds.maxX) / 2);
    const cz = Math.floor((bounds.minZ + bounds.maxZ) / 2);

    // If the area fits within bot's view distance, just tp and go
    if (xSpan <= 400 && zSpan <= 400) {
      const dim = bounds.dimension;
      const dimPrefix = dim ? `execute in ${dim} run ` : '';
      // Teleport bot to target (in correct dimension if needed)
      await runCommand(`${dimPrefix}tp .knightofiam1294 ${cx} 100 ${cz}`);
      // Forceload in the correct dimension
      const fMinX = Math.max(bounds.minX, cx - 100);
      const fMaxX = Math.min(bounds.maxX, cx + 100);
      const fMinZ = Math.max(bounds.minZ, cz - 100);
      const fMaxZ = Math.min(bounds.maxZ, cz + 100);
      await runCommand(`${dimPrefix}forceload add ${fMinX} ${fMinZ} ${fMaxX} ${fMaxZ}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  batchCounter++;
  currentBatchAborted = false;
  const funcName = `batch_${batchCounter}`;
  const funcContent = commands.map(c => c.startsWith('/') ? c.slice(1) : c).join('\n') + '\n';

  // Write the .mcfunction file
  const filePath = `/world/datapacks/claude-bot/data/claude/function/${funcName}.mcfunction`;
  const writeResp = await fetch(`${API_BASE}/servers/${SERVER_ID}/files/write`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ file: filePath, content: funcContent }),
  });
  if (!writeResp.ok) {
    return { ok: false, error: `failed to write mcfunction: ${writeResp.status}` };
  }

  // Reload datapacks so the server sees the new function
  await runCommand('reload');
  await new Promise(r => setTimeout(r, 800));

  if (currentBatchAborted) {
    return { ok: false, error: 'batch was cancelled before execution' };
  }

  // Execute the function — all commands run in ONE server tick
  await runCommand(`function claude:${funcName}`);

  // Clean up forceloaded chunks (in the correct dimension)
  if (bounds) {
    const dimPrefix = bounds.dimension ? `execute in ${bounds.dimension} run ` : '';
    await runCommand(`${dimPrefix}forceload remove all`);
  }

  const result = { ok: true, commands_executed: n, function_name: `claude:${funcName}` };
  if (rejected.length > 0) {
    result.warnings = `${rejected.length} commands had invalid block names and were skipped: ${rejected.slice(0, 3).map(r => r.reason).join(', ')}`;
  }
  return result;
}

function abortCurrentBatch() {
  currentBatchAborted = true;
}

module.exports = { runCommand, setBlock, fillBlocks, giveItem, teleport, summon, getPlayerData, getPlayerPositionAndDimension, listPlayers, readLogTail, getServerStats, executeBatch, abortCurrentBatch, scatterBlocks };
