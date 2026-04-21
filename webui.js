// Web UI server for the Claude bot.
//
// Hosts a single HTML page on a LAN-accessible HTTP port. The page is a
// mobile-first chat UI (iMessage-style) that lets you type messages from your
// phone and have them routed into the bot's LLM brain exactly as if they were
// sent from the authorized operator in-game.
//
// Endpoints:
//   GET  /         → the chat page (HTML + CSS + JS inline)
//   POST /chat     → { "message": "..." } → runs handleChat(OP, message),
//                    sends the reply to in-game chat, returns { "reply": "..." }
//   GET  /healthz  → 200 OK
//
// v1: no auth. Bound to 0.0.0.0 so any device on your LAN can reach it.
// Add a shared-secret token later if you ever expose this beyond your LAN.

const http = require('http');
const { handleChat } = require('./llm');
const { runCommand } = require('./bisect');

// Dedupe: tracks messages we just echoed to in-game chat so bot.js can drop
// them when they come back via the Go transport's chat event stream.
// Without this, echoing "<.knightofiam85> foo" via /tellraw would loop back
// through handleChat since our parser successfully extracts it as a chat.
const recentEchoes = new Map(); // key: `${sender}|${message}` → ts
const ECHO_TTL_MS = 15000;

function markEcho(sender, message) {
  recentEchoes.set(`${sender}|${message}`, Date.now());
}

function wasRecentlyEchoed(sender, message) {
  const key = `${sender}|${message}`;
  const t = recentEchoes.get(key);
  if (!t) return false;
  if (Date.now() - t > ECHO_TTL_MS) {
    recentEchoes.delete(key);
    return false;
  }
  recentEchoes.delete(key); // one-shot
  return true;
}

// Periodic GC of stale echoes
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of recentEchoes) {
    if (now - t > ECHO_TTL_MS * 2) recentEchoes.delete(k);
  }
}, 30000).unref();

// index.html — served at GET /
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="theme-color" content="#000000">
<title>Claude</title>
<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  font-size: 16px;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  padding-top: calc(10px + env(safe-area-inset-top));
  background: rgba(12,12,12,0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d97757, #b55c37);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}
.name { font-weight: 600; font-size: 16px; line-height: 1.2; }
.status {
  font-size: 12px;
  color: #7a7a7a;
  line-height: 1.2;
  margin-top: 2px;
}
.status.online { color: #8aff8a; }
.status.online::before { content: '● '; font-size: 10px; }

main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  -webkit-overflow-scrolling: touch;
}
main::-webkit-scrollbar { display: none; }

.msg {
  max-width: 78%;
  padding: 9px 14px;
  border-radius: 20px;
  font-size: 16px;
  line-height: 1.38;
  word-wrap: break-word;
  white-space: pre-wrap;
  margin-top: 2px;
}
.msg.me {
  align-self: flex-end;
  background: #007aff;
  color: #fff;
  border-bottom-right-radius: 6px;
}
.msg.bot {
  align-self: flex-start;
  background: #2c2c2e;
  color: #fff;
  border-bottom-left-radius: 6px;
}
.msg.system {
  align-self: center;
  background: transparent;
  color: #666;
  font-size: 12px;
  padding: 6px 12px;
  max-width: 92%;
  text-align: center;
}
.msg.error {
  align-self: center;
  background: #3a1a1a;
  color: #ff6b6b;
  font-size: 13px;
  padding: 8px 14px;
  max-width: 92%;
}
.typing {
  align-self: flex-start;
  color: #666;
  font-size: 13px;
  padding: 6px 14px;
  font-style: italic;
}

footer {
  padding: 8px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  background: rgba(12,12,12,0.98);
  border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
#input {
  flex: 1;
  resize: none;
  border: 1px solid #333;
  background: #1c1c1e;
  color: #fff;
  border-radius: 22px;
  padding: 10px 16px;
  font: inherit;
  font-size: 16px;  /* 16px prevents iOS zoom-on-focus */
  line-height: 1.35;
  max-height: 140px;
  min-height: 40px;
  outline: none;
  transition: border-color 0.15s;
}
#input:focus {
  border-color: #007aff;
}
#input::placeholder {
  color: #666;
}
#send {
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 20px;
  flex: 0 0 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  font-weight: 700;
}
#send:disabled {
  background: #2a2a2a;
  color: #555;
  cursor: default;
}
#send:not(:disabled):active {
  background: #0055b3;
}
</style>
</head>
<body>
<header>
  <div class="avatar">C</div>
  <div>
    <div class="name">Claude</div>
    <div class="status" id="status">Ready</div>
  </div>
</header>

<main id="messages"></main>

<footer>
  <div class="input-row">
    <textarea id="input" rows="1" placeholder="Message Claude..." autocomplete="off" autocorrect="on" autocapitalize="sentences"></textarea>
    <button id="send" disabled aria-label="Send">↑</button>
  </div>
</footer>

<script>
const messagesEl = document.getElementById('messages');
const inputEl    = document.getElementById('input');
const sendEl     = document.getElementById('send');
const statusEl   = document.getElementById('status');

let typingEl = null;

function addMessage(role, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.textContent = text;
  messagesEl.appendChild(el);
  // Smooth scroll the new message into view
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
  return el;
}

function showTyping() {
  if (typingEl) return;
  typingEl = document.createElement('div');
  typingEl.className = 'typing';
  typingEl.textContent = 'Claude is thinking…';
  messagesEl.appendChild(typingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() {
  if (typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

// Auto-grow the textarea as user types, up to max-height
function autogrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
}
inputEl.addEventListener('input', () => {
  sendEl.disabled = !inputEl.value.trim();
  autogrow();
});

// Enter sends, Shift-Enter inserts newline
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!sendEl.disabled) send();
  }
});

sendEl.addEventListener('click', send);

// Pending request counter — allows multiple messages to be queued. Each send
// fires its own fetch; the server serializes processing so conversation order
// is preserved. The UI shows how many are in-flight.
let pending = 0;
function updatePendingUI() {
  if (pending > 1) {
    statusEl.textContent = 'Thinking… (' + pending + ' queued)';
  } else if (pending === 1) {
    statusEl.textContent = 'Thinking…';
  } else {
    statusEl.textContent = 'Ready';
    hideTyping();
  }
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  addMessage('me', text);
  inputEl.value = '';
  autogrow();
  sendEl.disabled = true; // re-enabled by input event when user types again
  pending++;
  showTyping();
  updatePendingUI();

  try {
    const r = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!r.ok) {
      const body = await r.text();
      addMessage('error', 'Error ' + r.status + ': ' + body);
      return;
    }
    const data = await r.json();
    if (data.reply) {
      addMessage('bot', data.reply);
    } else if (data.error) {
      addMessage('error', data.error);
    } else {
      addMessage('system', '(no reply)');
    }
  } catch (e) {
    addMessage('error', 'Network error: ' + e.message);
  } finally {
    pending--;
    updatePendingUI();
    inputEl.focus();
  }
}

// Initial greeting
addMessage('system', 'Connected to Claude bot. Type a message to get started.');
</script>
</body>
</html>
`;

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

/**
 * Start the web UI HTTP server.
 *
 * @param {object} opts
 * @param {string} opts.host          - bind address (default 0.0.0.0)
 * @param {number} opts.port          - port (default 3000)
 * @param {string} opts.operator      - the AUTHORIZED_OP to impersonate for web messages
 * @param {(text: string) => void} opts.sendChat - function to send bot replies to in-game chat
 */
function startWebUI(opts) {
  const host = opts.host || '0.0.0.0';
  const port = opts.port || 3000;
  const operator = opts.operator;
  const sendChat = opts.sendChat;
  if (!operator || typeof sendChat !== 'function') {
    throw new Error('startWebUI requires { operator, sendChat }');
  }

  // Parallel request counter for logging
  let requestCounter = 0;

  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(INDEX_HTML);
        return;
      }

      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }

      if (req.method === 'POST' && req.url === '/chat') {
        // Parse body immediately (fast, no queue contention)
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          return json(res, 400, { error: 'invalid JSON body' });
        }
        const message = (body.message || '').toString().trim();
        if (!message) {
          return json(res, 400, { error: 'message required' });
        }
        console.log(`[web] <${operator}> ${message}`);

        // Stream the response with periodic keep-alive whitespace so the
        // phone's fetch() doesn't time out during long tool calls.
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Access-Control-Allow-Origin': '*',
          'X-Accel-Buffering': 'no',
          'Transfer-Encoding': 'chunked',
        });
        const keepAlive = setInterval(() => {
          try { res.write(' '); } catch {}
        }, 8000);
        let clientGone = false;
        res.on('close', () => { clientGone = true; clearInterval(keepAlive); });

        // Parallel execution — each request runs independently with an isolated
        // snapshot of conversation history. Multiple Claude API calls + tool
        // executions happen concurrently. History append is mutex-protected in
        // llm.js so final results don't interleave.
        const reqId = ++requestCounter;
        const tag = `web-${reqId}`;
        let result = {};
        try {
          const reply = await handleChat(operator, message, { tag });
          if (reply) {
            try { sendChat(reply); } catch (e) { console.error(`[web:${reqId}] sendChat error:`, e); }
          }
          result = { reply: reply || '' };
        } catch (e) {
          console.error(`[web:${reqId}] handleChat error:`, e);
          result = { error: e.message };
        }

        clearInterval(keepAlive);
        if (clientGone) return;
        const finalJson = result.error
          ? JSON.stringify({ error: result.error })
          : JSON.stringify({ reply: result.reply || '' });
        try {
          res.write(finalJson);
          res.end();
        } catch (e) {
          console.error('[web] response write error:', e.message);
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    } catch (e) {
      console.error('[web] unhandled error:', e);
      try { json(res, 500, { error: e.message }); } catch {}
    }
  });

  server.listen(port, host, () => {
    console.log(`[web] web UI listening on http://${host}:${port}`);
  });
  server.on('error', (err) => {
    console.error('[web] server error:', err.message);
  });

  return server;
}

module.exports = { startWebUI, wasRecentlyEchoed };
