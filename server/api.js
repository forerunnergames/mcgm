// Thin HTTP client for the Bisect/Pterodactyl API.
// Zero game logic — just sends HTTP requests and returns responses.

'use strict';

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

/** Send a command to the server console. */
async function sendCommand(command) {
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
  return { ok: true, command: cmd };
}

/** Read the tail of the server log. */
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

/** Write a file to the server filesystem. */
async function writeFile(filePath, content) {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/files/write`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ file: filePath, content }),
  });
  return { ok: r.ok, status: r.status };
}

/** Delete files from the server filesystem. */
async function deleteFiles(root, files) {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/files/delete`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ root, files }),
  });
  return { ok: r.ok, status: r.status };
}

/** List files in a server directory. */
async function listFiles(directory) {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/files/list?directory=${encodeURIComponent(directory)}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.data || []).map(f => f.attributes?.name || f.name).filter(Boolean);
}

/** Get server resource stats (memory, cpu, disk, state). */
async function getResources() {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/resources`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!r.ok) return { ok: false, status: r.status, error: await r.text() };
  const data = await r.json();
  return { ok: true, data: data.attributes };
}

/** Get server limits (memory, cpu) from server details. */
async function getServerLimits() {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.attributes?.limits || null;
}

/** Send a power signal (start, stop, restart, kill). */
async function sendPowerSignal(signal) {
  const r = await fetch(`${API_BASE}/servers/${SERVER_ID}/power`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ signal }),
  });
  return { ok: r.ok || r.status === 204, status: r.status };
}

module.exports = {
  sendCommand, readLogTail, writeFile, deleteFiles, listFiles,
  getResources, getServerLimits, sendPowerSignal,
  // Expose for testing/advanced use
  API_BASE, SERVER_ID, HEADERS,
};
