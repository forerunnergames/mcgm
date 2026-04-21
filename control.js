// control.js — shared bridge so llm.js (where tools are dispatched) can invoke
// bot-level operations that only bot.js (which owns the Go subprocess) can
// actually perform.
//
// Usage: bot.js calls setLeaveAndRejoinHandler(fn) at startup. llm.js calls
// requestLeaveAndRejoin(delay) from a tool handler and awaits the result.

let leaveAndRejoinHandler = null;

function setLeaveAndRejoinHandler(fn) {
  leaveAndRejoinHandler = fn;
}

async function requestLeaveAndRejoin(delaySeconds) {
  if (typeof leaveAndRejoinHandler !== 'function') {
    return { ok: false, error: 'bot control not initialized' };
  }
  try {
    return await leaveAndRejoinHandler(delaySeconds);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { setLeaveAndRejoinHandler, requestLeaveAndRejoin };
