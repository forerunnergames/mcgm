// Claude bot — main entry.
//
// Connects to the server by spawning a Go subprocess (`transport/bedrock-transport`)
// built on `gophertunnel`. The Go binary handles Microsoft auth, RakNet, and the
// Bedrock protocol because the PrismarineJS Node libraries don't yet support
// Bedrock 26.x. We talk to it over JSON lines on stdin/stdout; its stderr is
// passed through so the user sees device-code prompts and Go-side logs.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { handleChat } = require('./llm');
const { startWebUI, wasRecentlyEchoed } = require('./webui');
const { setLeaveAndRejoinHandler } = require('./control');
const server = require('./server');
const gamemaster = require('./server/gamemaster');

// Chat log file — appends every message and tool call for debugging
const LOG_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const chatLogStream = fs.createWriteStream(
  path.join(LOG_DIR, `chat-${new Date().toISOString().slice(0, 10)}.log`),
  { flags: 'a' }
);
function chatLog(line) {
  const ts = new Date().toISOString();
  chatLogStream.write(`[${ts}] ${line}\n`);
}

// Matches messages that explicitly address the bot.
// We use \b word boundaries so "cloud" and "donation" don't trigger.
// Build the mention regex dynamically from BOT_NAME env var.
// Always matches "claude"; also matches the configured bot gamertag (minus leading dot).
const _botTag = (process.env.BOT_NAME || '').replace(/^\./, '');
const _mentionParts = ['claude'];
if (_botTag) _mentionParts.push(_botTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const BOT_MENTION = new RegExp(`\\b(${_mentionParts.join('|')})\\b`, 'i');
function isAddressedToBot(message) {
  return BOT_MENTION.test(message);
}

const HOST = process.env.SERVER_HOST || '142.79.47.246';
const PORT = process.env.SERVER_PORT || '9050';
const TRANSPORT_BIN = path.join(__dirname, 'transport', 'bedrock-transport');

console.log(`[bot] Claude bot starting`);
console.log(`[bot] target: ${HOST}:${PORT}`);
console.log(`[bot] transport: ${TRANSPORT_BIN}`);
console.log(`[bot] authorized operator: ${process.env.AUTHORIZED_OP}`);
console.log(`[bot] LLM model: ${process.env.LLM_MODEL}`);

let child = null;
let botName = null;
let botXUID = null;
let chatQueue = Promise.resolve();
let intentionalRestart = false;
let onConnectedResolve = null; // set by leaveAndRejoin, called by handleEvent

function spawnTransport() {
  console.log('[bot] spawning Go transport...');
  child = spawn(TRANSPORT_BIN, [], {
    env: {
      ...process.env,
      SERVER_HOST: HOST,
      SERVER_PORT: PORT,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Parse stdout as JSON lines
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch (e) {
      console.error(`[bot] non-JSON line from transport: ${line}`);
      return;
    }
    handleEvent(evt).catch((err) => {
      console.error('[bot] handleEvent error:', err);
    });
  });

  child.on('exit', (code, signal) => {
    console.log(`[bot] transport exited code=${code} signal=${signal}`);
    if (!intentionalRestart) {
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    console.error(`[bot] failed to spawn transport: ${err.message}`);
    if (!intentionalRestart) process.exit(1);
  });
}

async function handleEvent(evt) {
  switch (evt.type) {
    case 'msa_signed_in':
      console.log('[bot] microsoft auth complete');
      return;

    case 'connected':
      botName = evt.name;
      botXUID = evt.xuid;
      console.log(`[bot] connected as "${botName}" (xuid ${botXUID})`);
      if (onConnectedResolve) {
        const r = onConnectedResolve;
        onConnectedResolve = null;
        r();
      }
      // Post-connect hardening: make the bot invincible and immune to all
      // hostile state so it can never die and enter the broken "dead player"
      // state that Paper reports as "Chat disabled in client options". Also
      // Protects the bot's player data — every time the bot disconnects
      // and rejoins, gamemode may reset, so we re-apply on every connect.
      applyPostConnectHardening().catch((e) => {
        console.error('[bot] post-connect hardening error:', e.message);
      });
      // Clean up stale batch files from prior sessions
      server.cleanupStaleBatchFiles().catch((e) => {
        console.warn('[bot] stale batch cleanup error:', e.message);
      });
      // Build the GM platform and start watching for GM joins
      gamemaster.buildPlatform().then(() => {
        gamemaster.startWatching();
      }).catch((e) => {
        console.warn('[bot] gamemaster platform error:', e.message);
      });
      return;

    case 'chat': {
      const sender = (evt.sender || '').trim();
      const message = (evt.message || '').trim();
      if (!sender || !message) return;
      if (botName && sender === botName) return; // ignore our own
      if (sender === 'Server' || sender.startsWith('§')) return;

      // Drop echoes of phone messages that we just broadcast via tellraw
      if (wasRecentlyEchoed(sender, message)) {
        console.log(`[chat] skip phone echo: <${sender}> ${message}`);
        return;
      }

      // In-game chat: only respond when the bot is actually addressed.
      // (Web UI messages bypass this because they come in via POST /chat, not
      // through this Go-transport event path.)
      if (!isAddressedToBot(message)) {
        console.log(`[chat] skip (no mention): <${sender}> ${message}`);
        return;
      }

      console.log(`[chat] <${sender}> ${message}`);
      chatLog(`IN-GAME <${sender}> ${message}`);
      // Serialize chat processing so two fast messages don't interleave tool calls
      chatQueue = chatQueue
        .then(() => processChat(sender, message))
        .catch((e) => console.error('[bot] processChat error:', e));
      return;
    }

    case 'disconnect':
      console.log(`[bot] disconnected: ${evt.reason || '(no reason)'}`);
      return;

    case 'error':
      console.error(`[bot] transport error: ${evt.error}`);
      return;

    default:
      console.log(`[bot] unknown event: ${JSON.stringify(evt)}`);
  }
}

async function applyPostConnectHardening() {
  if (!botName) return;
  const target = `.${botName}`;
  console.log(`[bot] applying post-connect hardening to ${target}`);
  // Fire-and-forget; we don't want to block other event handling
  const cmds = [
    `gamemode creative ${target}`,          // invincible to most damage
    `effect give ${target} minecraft:resistance infinite 4 true`,  // belt & suspenders
    `effect give ${target} minecraft:instant_health 100 100 true`, // full heal
  ];
  for (const cmd of cmds) {
    try {
      await server.runCommand(cmd);
    } catch (e) {
      console.error(`[bot] hardening cmd failed (${cmd}):`, e.message);
    }
  }
  console.log('[bot] hardening complete');
}

async function processChat(sender, message) {
  try {
    const reply = await handleChat(sender, message);
    if (reply) {
      sendChat(reply);
    }
  } catch (e) {
    console.error('[bot] handleChat error:', e);
    sendChat(`Sorry, my brain glitched — try again in a sec! 🔄`);
  }
}

function sendChat(text) {
  if (!text) return;
  if (!child || child.killed || !child.stdin || !child.stdin.writable) {
    console.warn(`[bot] sendChat skipped (transport not writable): ${text}`);
    return;
  }
  // Bedrock chat per-message cap is around 256 chars; chunk long replies.
  const MAX = 240;
  let s = text;
  while (s.length > 0) {
    const chunk = s.slice(0, MAX);
    s = s.slice(MAX);
    try {
      child.stdin.write(JSON.stringify({ type: 'chat', message: chunk }) + '\n');
    } catch (e) {
      console.error('[bot] sendChat write error:', e.message);
      return;
    }
  }
  console.log(`[bot] -> ${text}`);
  chatLog(`BOT -> ${text}`);
}

// Leave and rejoin the server. Used by Claude as a workaround for the Paper
// 26.1 alpha gamerule bug — disconnect so the bot doesn't count toward the
// sleep percentage, wait, then reconnect.
async function leaveAndRejoin(delaySeconds) {
  if (intentionalRestart) {
    return { ok: false, error: 'already restarting' };
  }
  const delay = Math.max(5, Math.min(120, delaySeconds || 25));
  console.log(`[bot] leave_and_rejoin: disconnecting for ${delay}s`);

  // Let the user know via in-game chat before we go dark. Claude usually says
  // its own version of this in the same turn, but we also guarantee a message
  // here so the transition is never silent.
  sendChat(`Heading out so you can sleep! 💤 Back in ~${delay}s.`);
  // Give that message a beat to land on the wire before we disconnect
  await new Promise((r) => setTimeout(r, 800));

  intentionalRestart = true;

  // Tell the Go side to disconnect gracefully
  try {
    if (child && child.stdin.writable) {
      child.stdin.write(JSON.stringify({ type: 'disconnect' }) + '\n');
    }
  } catch {}

  // Wait for the child to exit (or force-kill after 8s)
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      resolve();
    }, 8000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  console.log(`[bot] leave_and_rejoin: disconnected, waiting ${delay}s`);
  await new Promise((r) => setTimeout(r, delay * 1000));

  // Respawn and wait for the 'connected' event
  botName = null;
  botXUID = null;
  spawnTransport();

  const reconnected = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      onConnectedResolve = null;
      resolve(false);
    }, 90000);
    onConnectedResolve = () => {
      clearTimeout(timeout);
      resolve(true);
    };
  });

  intentionalRestart = false;

  if (reconnected) {
    console.log('[bot] leave_and_rejoin: reconnected');
    // Brief delay, then announce we're back
    await new Promise((r) => setTimeout(r, 500));
    sendChat(`Back! 👋`);
    return { ok: true, name: botName };
  } else {
    console.log('[bot] leave_and_rejoin: reconnect timed out');
    return { ok: false, error: 'reconnect timed out after 90s — check server state manually' };
  }
}

setLeaveAndRejoinHandler(leaveAndRejoin);

process.on('SIGINT', () => {
  console.log('\n[bot] SIGINT — disconnecting...');
  try {
    if (child && child.stdin.writable) {
      child.stdin.write(JSON.stringify({ type: 'disconnect' }) + '\n');
    }
  } catch {}
  // Give the child a moment to close gracefully, then force-exit
  setTimeout(() => {
    try { child && child.kill('SIGTERM'); } catch {}
    process.exit(0);
  }, 1000);
});

// Start the web UI. It shares the same `sendChat` used by in-game chat so
// phone-originated replies are visible to all players in-game.
startWebUI({
  host: process.env.WEB_UI_HOST || '0.0.0.0',
  port: parseInt(process.env.WEB_UI_PORT || '3000', 10),
  operator: process.env.AUTHORIZED_OP,
  sendChat,
});

// Finally, start the transport
spawnTransport();
