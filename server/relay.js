// Relay — bridges the phone web UI to Claude Code (you) instead of the bot's LLM.
// Messages from the phone are written to a queue file. Claude Code reads them,
// executes commands, and writes responses back.

'use strict';

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'memory', 'relay-queue.json');
const RESPONSE_FILE = path.join(__dirname, '..', 'memory', 'relay-response.json');

function ensureDir() {
  fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
}

/**
 * Push a message from the phone to the queue.
 * Returns a request ID that the phone polls for a response.
 */
function pushMessage(message) {
  ensureDir();
  let queue = [];
  try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch {}
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  queue.push({ id, message, timestamp: new Date().toISOString() });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  return id;
}

/**
 * Read pending messages (for Claude Code to process).
 */
function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch { return []; }
}

/**
 * Clear the queue after processing.
 */
function clearQueue() {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE, '[]');
}

/**
 * Write a response for a specific request ID.
 */
function writeResponse(id, reply) {
  ensureDir();
  let responses = {};
  try { responses = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8')); } catch {}
  responses[id] = { reply, timestamp: new Date().toISOString() };
  fs.writeFileSync(RESPONSE_FILE, JSON.stringify(responses, null, 2));
}

/**
 * Read a response by request ID (phone polls this).
 */
function readResponse(id) {
  try {
    const responses = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8'));
    return responses[id] || null;
  } catch { return null; }
}

/**
 * Push an in-game chat message to the queue.
 * Same as pushMessage but tagged with source.
 */
function pushChat(sender, message) {
  ensureDir();
  let queue = [];
  try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch {}
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  queue.push({ id, sender, message, source: 'ingame', timestamp: new Date().toISOString() });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  return id;
}

module.exports = { pushMessage, pushChat, readQueue, clearQueue, writeResponse, readResponse };
