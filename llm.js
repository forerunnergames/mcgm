// Claude (Anthropic) brain for the bot. Receives chat messages, decides whether
// to respond and/or invoke tools. Tools are only exposed to the authorized
// operator — everyone else gets conversational replies only, no world actions.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const bisect = require('./bisect');
const { requestLeaveAndRejoin } = require('./control');
const tools = require('./tools');

// Load player nickname mappings. Maps in-game names → real names/nicknames.
const NICKNAMES_FILE = path.join(__dirname, 'nicknames.json');
let NICKNAMES = {};
try {
  if (fs.existsSync(NICKNAMES_FILE)) {
    NICKNAMES = JSON.parse(fs.readFileSync(NICKNAMES_FILE, 'utf8'));
    console.log(`[llm] loaded ${Object.keys(NICKNAMES).length} nickname mappings`);
  }
} catch (e) {
  console.error(`[llm] failed to load nicknames: ${e.message}`);
}

// Build the nickname prompt section dynamically
function buildNicknamePrompt() {
  const entries = Object.entries(NICKNAMES);
  if (entries.length === 0) return '';
  const lines = entries.map(([ign, nick]) => `  - "${nick}" → in-game name: ${ign}`);
  return `
Player nickname mappings (ALWAYS use the EXACT in-game name for tool calls, never the nickname):
${lines.join('\n')}
When a player or the operator refers to someone by nickname (e.g. "Andrew"), you MUST resolve it to the exact in-game name (e.g. "_FlameFrags__") before passing it to any tool. The /data get entity command is case-sensitive and requires the exact name including underscores and dots. Use these nicknames in your chat responses to sound natural (call them by their real name, not their gamertag).
If someone mentions a name you don't recognize, call list_online_players to find the closest match.`;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5';
const AUTHORIZED_OP = process.env.AUTHORIZED_OP || '';

function getSystemPrompt() {
  return `You are Claude, a friendly Minecraft builder bot on a Paper 26.1.1 server. Your in-game name is ".knightofiam1294".

Chat: messages arrive as "[sender] text". Keep replies SHORT (1-2 sentences, under 200 chars). Be friendly and playful.

Authorization: only ".knightofiam85" (Aaron) can trigger tools. Other players get conversation only — tell them only Aaron can give you orders.

The operator often messages from a PHONE, not in-game. If get_player_position fails for ".knightofiam85", the operator is on their phone — use the BOT's position or ask for coords. Never refuse because the operator isn't in-game.

Tool selection guide:
- "give gear/armor/weapons" → equip_player (handles enchantments, slots, everything)
- "replace/convert blocks" → replace_blocks_in_area (handles chunk loading, block tags, tiling)
- "teleport to/find structure/biome" → locate_and_teleport (handles /locate, dimension, tp)
- "plant trees" → plant_trees (handles ground prep, /place feature)
- "place/generate a structure" → place_structure (trial chambers, villages, monuments, etc.)
- "scatter random blocks" → scatter_blocks (server-side random coords, instant)
- "scan what blocks are here" → scan_area (ONLY for conversion tasks, NOT for building)
- "sleep/leave/bed" → leave_for_sleep (disconnects 25s so players can skip night). After this tool returns, you are ALREADY BACK — don't say "I'll be back soon."
- Building custom structures → batch_commands (auto-tiles oversized fills, auto-corrects block names)
- Single blocks/details → setblock
- Arbitrary commands → run_command

When building or modifying: ALWAYS include the bounding box coordinates in your reply so the operator can verify on BlueMap and request undo.

For undo: look back in conversation for coordinates you used previously. Fill that region with air, or /kill spawned entities.

For cancellation: stop immediately if told to cancel/stop.
${buildNicknamePrompt()}

You have conversation memory (~40 turns). Use it — reference previous builds, coordinates, and actions when asked.`;
}

const TOOLS = [
  // === HIGH-LEVEL TOOLS (prefer these over low-level ones) ===
  {
    name: 'equip_player',
    description: 'Give a player a full gear set, auto-equipped to the correct armor/weapon/hotbar slots. Handles enchantment syntax and /item replace internally. Use this instead of give_item for any equipment.',
    input_schema: {
      type: 'object',
      properties: {
        player: { type: 'string', description: 'Player name (e.g. .knightofiam85, _FlameFrags__)' },
        tier: { type: 'string', enum: ['netherite', 'diamond', 'iron'], description: 'Gear tier. Default netherite.' },
        items: {
          type: 'array', items: { type: 'string' },
          description: 'Which items to equip. Options: helmet, chestplate, leggings, boots, sword, pickaxe, axe, shovel, bow, shield, totem, elytra, fireworks, trident. Default: full armor + sword + pickaxe + shield.',
        },
      },
      required: ['player'],
    },
  },
  {
    name: 'replace_blocks_in_area',
    description: 'Replace one block type with another in an area. Handles chunk loading, bot teleporting, forceloading, tiling, and block tags ALL automatically. Use block group names for convenience: "wood" (all planks/logs/stairs/slabs/fences/doors), "trees" (logs+leaves), "stone", "ores", "flowers", "ice", "sand", "dirt", "water", "lava", "wool", "glass". Or use specific block IDs or #tags.',
    input_schema: {
      type: 'object',
      properties: {
        center_x: { type: 'number', description: 'Center X coordinate of the area' },
        center_z: { type: 'number', description: 'Center Z coordinate of the area' },
        radius: { type: 'integer', description: 'Radius in blocks (max 150, default 80)' },
        from_block: { type: 'string', description: 'Block to replace. Use group names (wood, trees, stone, ores, flowers, ice, sand, dirt, water, lava) or specific IDs (minecraft:oak_log) or tags (#minecraft:logs)' },
        to_block: { type: 'string', description: 'Block to replace with (e.g. minecraft:glass, minecraft:lava, minecraft:air)' },
        dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
        min_y: { type: 'integer', description: 'Minimum Y (default 50)' },
        max_y: { type: 'integer', description: 'Maximum Y (default 120)' },
      },
      required: ['center_x', 'center_z', 'from_block', 'to_block'],
    },
  },
  {
    name: 'locate_and_teleport',
    description: 'Find a structure or biome and teleport players there. Handles /locate, coordinate parsing, dimension detection, and /tp automatically. Works for: village, ocean monument, guardian temple, fortress, bastion, end city, mineshaft, stronghold, trial chambers, mansion, witch hut, pyramid, jungle temple, igloo, shipwreck, ancient city, pillager outpost, deep dark, skulk, lush cave, mushroom, cherry grove, desert, jungle, forest, plains, snowy plains, polar bear, ice spikes, ocean, badlands, meadow, flower forest, taiga, savanna, soul sand valley, crimson forest, warped forest, basalt deltas, and more.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'What to find (natural language, e.g. "village", "ocean monument", "deep dark", "cherry grove", "nether fortress")' },
        players: { type: 'string', description: 'Who to teleport. Use "@a" for everyone, or a specific player name. Default "@a".' },
      },
      required: ['target'],
    },
  },
  {
    name: 'plant_trees',
    description: 'Plant natural-looking trees at a location. Handles ground prep and /place feature automatically. Some trees may fail on unsuitable terrain — the tool compensates by attempting 2x the requested count.',
    input_schema: {
      type: 'object',
      properties: {
        tree_type: { type: 'string', enum: ['cherry', 'oak', 'birch', 'spruce', 'jungle', 'dark oak', 'acacia'], description: 'Type of tree' },
        count: { type: 'integer', description: 'How many trees (max 200). ~50% will succeed on natural terrain.' },
        center_x: { type: 'number' },
        center_z: { type: 'number' },
        radius: { type: 'integer', description: 'Radius to scatter trees in (max 100, default 50)' },
        dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
      },
      required: ['tree_type', 'count', 'center_x', 'center_z'],
    },
  },
  {
    name: 'scan_area',
    description: 'Scan an area to discover what block types are present. ONLY use this for CONVERSION/REPLACEMENT tasks ("convert village to desert", "replace all wood with glass"). Do NOT use for BUILDING tasks ("build a bridge", "build a house") — those just need coordinates, not a scan. Takes 30-60 seconds. Handles chunk loading automatically.',
    input_schema: {
      type: 'object',
      properties: {
        center_x: { type: 'number' },
        center_z: { type: 'number' },
        radius: { type: 'integer', description: 'Scan radius (max 50, default 30)' },
        dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
      },
      required: ['center_x', 'center_z'],
    },
  },
  {
    name: 'place_structure',
    description: 'Generate an entire Minecraft structure at a location. Places REAL procedurally-generated structures — trial chambers, villages, ocean monuments, fortresses, mansions, etc. Handles chunk loading automatically. Use when the operator says "place", "build", "create", or "generate" a known Minecraft structure. Available structures: trial_chambers, village_plains, village_desert, village_savanna, village_snowy, village_taiga, ocean_monument, fortress, bastion_remnant, end_city, woodland_mansion, ancient_city, pillager_outpost, desert_pyramid, jungle_pyramid, swamp_hut, igloo, shipwreck, mineshaft, stronghold, ruined_portal.',
    input_schema: {
      type: 'object',
      properties: {
        structure: { type: 'string', description: 'Structure type (e.g. "trial_chambers", "village_plains", "ocean_monument")' },
        x: { type: 'integer' }, y: { type: 'integer' }, z: { type: 'integer' },
        dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
      },
      required: ['structure', 'x', 'y', 'z'],
    },
  },
  // === LOW-LEVEL TOOLS (use when high-level tools don't cover the need) ===
  {
    name: 'setblock',
    description: 'Place a single block at the given coordinates. Use minecraft: prefixed block IDs. Pass dimension from get_player_position if not in the overworld.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'integer', description: 'X coordinate (east/west)' },
        y: { type: 'integer', description: 'Y coordinate (up/down, sea level ~64)' },
        z: { type: 'integer', description: 'Z coordinate (south/north)' },
        block: { type: 'string', description: 'Block ID like minecraft:oak_planks' },
        dimension: { type: 'string', description: 'Dimension from get_player_position, e.g. "minecraft:the_nether". Omit for overworld.' },
      },
      required: ['x', 'y', 'z', 'block'],
    },
  },
  {
    name: 'fill',
    description: 'Fill a 3D rectangular region from (x1,y1,z1) to (x2,y2,z2) with a block. Volume cap is 32768 blocks per call — split larger jobs into multiple fills. Use mode "hollow" for hollow boxes, "outline" for outer shell with air inside, or "replace" (default) for solid fill. Pass dimension from get_player_position if not in the overworld.',
    input_schema: {
      type: 'object',
      properties: {
        x1: { type: 'integer' }, y1: { type: 'integer' }, z1: { type: 'integer' },
        x2: { type: 'integer' }, y2: { type: 'integer' }, z2: { type: 'integer' },
        block: { type: 'string', description: 'Block ID' },
        mode: { type: 'string', enum: ['replace', 'hollow', 'outline', 'keep'], description: 'fill mode (default replace)' },
        dimension: { type: 'string', description: 'Dimension, e.g. "minecraft:the_nether". Omit for overworld.' },
      },
      required: ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'block'],
    },
  },
  {
    name: 'give_item',
    description: 'Give an item to a player.',
    input_schema: {
      type: 'object',
      properties: {
        player: { type: 'string', description: 'Player name (e.g. .knightofiam85). Bedrock players have a leading dot.' },
        item: { type: 'string', description: 'Item ID like minecraft:diamond' },
        count: { type: 'integer', description: 'How many (default 1, max 64 for stackable)' },
      },
      required: ['player', 'item'],
    },
  },
  {
    name: 'teleport_player',
    description: 'Teleport a player to specific coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        player: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' },
      },
      required: ['player', 'x', 'y', 'z'],
    },
  },
  {
    name: 'get_player_position',
    description: 'Get the current XYZ position AND dimension of a player. Returns {position: "[x.xd, y.yd, z.zd]", dimension: "minecraft:overworld|the_nether|the_end"}. ALWAYS call this before building/spawning/teleporting — the dimension is REQUIRED for commands to work in the Nether or End. Pass the returned dimension to setblock/fill/summon/teleport_player tools.',
    input_schema: {
      type: 'object',
      properties: {
        player: { type: 'string', description: 'Player name including dot prefix for Bedrock players' },
      },
      required: ['player'],
    },
  },
  {
    name: 'list_online_players',
    description: 'Return the list of currently online player names.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'summon',
    description: 'Summon one or more entities at coordinates. When count > 1, entities are automatically spread in a ~10 block radius. Max 100 per call. For large counts (50+), warn about lag. Pass dimension from get_player_position if not in the overworld.',
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity ID like minecraft:cow, minecraft:chicken, minecraft:warden' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        count: { type: 'integer', description: 'How many to spawn (default 1, max 100). They spread out automatically.' },
        nbt: { type: 'string', description: 'optional SNBT data' },
        dimension: { type: 'string', description: 'Dimension, e.g. "minecraft:the_nether". Omit for overworld.' },
      },
      required: ['entity', 'x', 'y', 'z'],
    },
  },
  {
    name: 'run_command',
    description: 'Run an arbitrary slash command as the server console (full op privileges). The response includes the last ~40 lines of server log captured ~1 second after the command ran, so you CAN see the output of commands like `/spark health`, `/list`, `/tps`, `/say`, etc. Use this for things not covered by other tools. Examples: "time set day", "weather clear", "gamemode creative .knightofiam85", "spark health" (prints a full server health report), "spark tps". When interpreting output, scan the log tail for lines that appear to be responses to your command.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Slash command, with or without leading slash' },
      },
      required: ['command'],
    },
  },
  {
    name: 'get_server_stats',
    description: 'Get high-level server health and resource stats: current state, memory usage, CPU%, disk, uptime, TPS, chunks loaded. Use this FIRST when the operator asks "how\'s the server running?", "is the server healthy?", "is memory ok?", "how much ram is being used?", or similar. This is fast (~100ms) and returns structured data you can reason about and summarize naturally. For a DEEPER look at Java heap specifically, you can also run `spark health` via run_command.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'scatter_blocks',
    description: 'Scatter random individual blocks in the air at random positions. Coordinates are generated SERVER-SIDE (instant) so this is much faster than generating setblock commands yourself. Use for: random floating blocks, debris fields, chaotic effects, particle-like block clouds. Max 5000 blocks per call.',
    input_schema: {
      type: 'object',
      properties: {
        block: { type: 'string', description: 'Block ID like minecraft:bedrock, minecraft:obsidian, minecraft:glowstone' },
        count: { type: 'integer', description: 'How many blocks to scatter (max 5000)' },
        center_x: { type: 'number', description: 'Center X coordinate' },
        center_z: { type: 'number', description: 'Center Z coordinate' },
        radius: { type: 'integer', description: 'Horizontal radius to scatter within (blocks)' },
        min_y: { type: 'integer', description: 'Minimum Y height' },
        max_y: { type: 'integer', description: 'Maximum Y height' },
        dimension: { type: 'string', description: 'Dimension. Omit for overworld.' },
      },
      required: ['block', 'count', 'center_x', 'center_z', 'radius', 'min_y', 'max_y'],
    },
  },
  {
    name: 'batch_commands',
    description: 'Execute a large batch of commands INSTANTLY in a single server tick via a Minecraft datapack function. Use this instead of individual setblock/fill/summon calls when you need 10+ commands — it writes them all to a .mcfunction file and runs them at once. MASSIVELY faster than sequential API calls. Max 10000 commands per batch. Each command should be a valid Minecraft command WITHOUT the leading slash. For dimension-specific commands, prefix each with "execute in <dimension> run ". For spawning around a point, generate the randomized coordinates yourself in the command list.',
    input_schema: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Minecraft commands (no leading slash). Example: ["summon minecraft:chicken 100 64 200", "summon minecraft:chicken 103 64 197", "fill 0 64 0 10 68 10 minecraft:obsidian hollow"]',
        },
      },
      required: ['commands'],
    },
  },
  {
    name: 'leave_for_sleep',
    description: 'Temporarily disconnect from the Minecraft server so the human player(s) can skip the night. While you are offline, you do not count toward the sleep percentage, so a solo human can click a bed and trigger the night skip alone. You will automatically rejoin after the delay — no second tool call needed. Use this whenever the operator says sleep/leave/night/bed etc. Don\'t ask for confirmation, just do it. Do not pair this with other tools in the same turn.',
    input_schema: {
      type: 'object',
      properties: {
        delay_seconds: {
          type: 'integer',
          description: 'How long to stay disconnected before rejoining. 25 is a good default. 20 is the minimum reasonable value (enough time for one player to click a bed and finish the night skip); 30 if you want to be safe. Avoid going over 45.',
        },
      },
    },
  },
];

async function executeTool(name, input) {
  try {
    switch (name) {
      case 'equip_player':
        return await tools.equipPlayer(input.player, input.tier || 'netherite', input.items);
      case 'scan_area':
        return await tools.scanArea(input.center_x, input.center_z, input.radius, input.dimension);
      case 'place_structure':
        return await tools.placeStructure(input.structure, input.x, input.y, input.z, input.dimension);
      case 'replace_blocks_in_area':
        return await tools.replaceBlocksInArea(input.center_x, input.center_z, input.radius, input.from_block, input.to_block, input.dimension, input.min_y, input.max_y);
      case 'locate_and_teleport':
        return await tools.locateAndTeleport(input.target, input.players || '@a');
      case 'plant_trees':
        return await tools.plantTrees(input.tree_type, input.count, input.center_x, input.center_z, input.radius, input.dimension);
      case 'setblock':
        return await bisect.setBlock(input.x, input.y, input.z, input.block, input.dimension);
      case 'fill':
        return await bisect.fillBlocks(input.x1, input.y1, input.z1, input.x2, input.y2, input.z2, input.block, input.mode || 'replace', input.dimension);
      case 'give_item':
        return await bisect.giveItem(input.player, input.item, input.count || 1);
      case 'teleport_player':
        return await bisect.teleport(input.player, input.x, input.y, input.z, input.dimension);
      case 'get_player_position':
        return await bisect.getPlayerPositionAndDimension(input.player);
      case 'list_online_players':
        return await bisect.listPlayers();
      case 'summon':
        return await bisect.summon(input.entity, input.x, input.y, input.z, input.nbt, input.count || 1, input.dimension);
      case 'scatter_blocks':
        return await bisect.scatterBlocks(input.block, input.count, input.center_x, input.center_z, input.radius, input.min_y, input.max_y, input.dimension);
      case 'batch_commands':
        return await bisect.executeBatch(input.commands);
      case 'run_command':
        return await bisect.runCommand(input.command, { captureOutput: true });
      case 'get_server_stats':
        return await bisect.getServerStats();
      case 'leave_for_sleep': {
        const r = await requestLeaveAndRejoin(input.delay_seconds || 25);
        if (r && r.ok) {
          return {
            ok: true,
            status: 'already_returned',
            note: 'The disconnect and reconnect have ALREADY completed by the time you see this result. You are back online RIGHT NOW. Do NOT say "I\'ll be back" or "sleep tight, see you soon" — that time has passed. A short acknowledgment like "I\'m back!" or "alright, did that work?" is ideal, or say nothing at all (the tool already sent its own pre-leave and post-rejoin chat messages).',
            name: r.name,
          };
        }
        return r;
      }
      default:
        return { ok: false, error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Shared rolling conversation history. Each entry is a Claude messages array element.
// We store user messages tagged with sender name and assistant text replies.
// Persisted to disk so memory survives bot restarts.
const HISTORY_FILE = path.join(__dirname, 'memory', 'history.json');
const MAX_HISTORY_PAIRS = 20; // 20 user/assistant exchanges

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log(`[llm] loaded ${parsed.length} messages from ${HISTORY_FILE}`);
        return parsed;
      }
    }
  } catch (e) {
    console.error(`[llm] failed to load history: ${e.message}`);
  }
  return [];
}

function saveHistory() {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(HISTORY, null, 2));
  } catch (e) {
    console.error(`[llm] failed to save history: ${e.message}`);
  }
}

const HISTORY = loadHistory();

function trimHistory() {
  // Keep at most MAX_HISTORY_PAIRS * 2 messages
  while (HISTORY.length > MAX_HISTORY_PAIRS * 2) HISTORY.shift();
}

// Mutex for HISTORY append — only the final write needs to be serialized,
// not the entire Claude API call + tool execution.
let historyLock = Promise.resolve();

async function handleChat(sender, message, opts = {}) {
  const isAuthorized = sender === AUTHORIZED_OP;
  const tag = opts.tag || '';
  const logPrefix = tag ? `[llm:${tag}]` : '[llm]';

  // Snapshot HISTORY at the start so parallel requests each get a consistent
  // view without blocking each other. The snapshot is read-only — each request
  // builds its own working messages on top of it.
  const historySnapshot = [...HISTORY];
  const userMsg = { role: 'user', content: `[${sender}] ${message}` };

  // Working messages: snapshot + this request's user message
  const working = [...historySnapshot, userMsg];

  let finalText = null;
  const MAX_ITERS = 25;

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let resp;
    try {
      resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: getSystemPrompt(),
        tools: isAuthorized ? TOOLS : [],
        messages: working,
      });
    } catch (e) {
      console.error(`${logPrefix} api error:`, e.message);
      return `Sorry, my brain glitched — try again in a sec! 🔄`;
    }

    working.push({ role: 'assistant', content: resp.content });

    const textBlocks = resp.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      finalText = textBlocks.map(b => b.text).join(' ').trim();
    }

    if (resp.stop_reason === 'tool_use') {
      const toolUseBlocks = resp.content.filter(b => b.type === 'tool_use');
      const toolResults = [];
      for (const block of toolUseBlocks) {
        console.log(`${logPrefix} [tool] ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
        const result = await executeTool(block.name, block.input);
        const resultStr = JSON.stringify(result).slice(0, 500);
        console.log(`${logPrefix} [tool] -> ${resultStr}`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultStr,
          is_error: !result.ok,
        });
      }
      working.push({ role: 'user', content: toolResults });
      continue;
    }

    break;
  }

  // Append to shared HISTORY with a lock so concurrent requests don't interleave.
  // Only the user message + final text are saved (not tool internals).
  historyLock = historyLock.then(() => {
    HISTORY.push(userMsg);
    if (finalText) {
      HISTORY.push({ role: 'assistant', content: finalText });
    }
    trimHistory();
    saveHistory();
  });
  await historyLock;

  return finalText;
}

module.exports = { handleChat };
