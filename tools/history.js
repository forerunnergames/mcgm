// History tool — query deaths, past bot actions, and undo them.
// "where did Caleb die?", "undo the prison", "what did you do last?"

'use strict';

const server = require('../server');
const deathTracker = require('../server/death-tracker');
const eventLog = require('../server/event-log');

const schema = {
  name: 'history',
  description: `Query game history and undo past bot actions. Actions:
- "deaths" — get a player's death history (last 10 by default). Returns coordinates so you can teleport them there.
- "last_death" — get a player's most recent death location.
- "events" — list recent bot actions (builds, spawns, teleports, kits, etc.).
- "search" — search past events by keyword ("prison", "lava", "ocean", player name, etc.).
- "undo" — undo a past event by ID or keyword. Fills build areas with air, kills spawned entities, clears effects.
- "undo_last" — undo the most recent event.
Use when the operator asks "where did someone die", "undo that", "clear the prison", "what did you build", "take me back to where you did X", etc.`,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['deaths', 'last_death', 'events', 'search', 'undo', 'undo_last'],
      },
      player: { type: 'string', description: 'Player name (for deaths/last_death)' },
      query: { type: 'string', description: 'Search keyword (for search/undo)' },
      event_id: { type: 'integer', description: 'Event ID to undo (for undo)' },
      count: { type: 'integer', description: 'How many results (default 10)' },
    },
    required: ['action'],
  },
};

async function execute(input) {
  const { action, player, query, event_id, count = 10 } = input;

  switch (action) {
    case 'deaths': {
      if (!player) return { ok: false, error: 'player required for deaths' };
      const deaths = deathTracker.getDeaths(player, count);
      if (deaths.length === 0) return { ok: true, player, deaths: [], note: 'No recorded deaths' };
      return { ok: true, player, deaths, total: deaths.length };
    }

    case 'last_death': {
      if (!player) return { ok: false, error: 'player required for last_death' };
      const death = deathTracker.getLastDeath(player);
      if (!death) return { ok: true, player, death: null, note: 'No recorded deaths' };
      return { ok: true, player, death };
    }

    case 'events': {
      const events = eventLog.getRecent(count);
      return { ok: true, events: events.map(summarize), total: events.length };
    }

    case 'search': {
      if (!query) return { ok: false, error: 'query required for search' };
      const results = eventLog.search(query);
      return { ok: true, query, results: results.slice(0, count).map(summarize), total: results.length };
    }

    case 'undo': {
      let event;
      if (event_id) {
        event = eventLog.getById(event_id);
      } else if (query) {
        event = eventLog.findLast(query);
      } else {
        return { ok: false, error: 'event_id or query required for undo' };
      }
      if (!event) return { ok: false, error: `No event found matching "${query || event_id}"` };
      return await undoEvent(event);
    }

    case 'undo_last': {
      const recent = eventLog.getRecent(1);
      if (recent.length === 0) return { ok: false, error: 'No events to undo' };
      return await undoEvent(recent[0]);
    }

    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

async function undoEvent(event) {
  const cmds = eventLog.getUndoCommands(event);
  if (cmds.length === 0) {
    return { ok: false, error: `Event #${event.id} "${event.description}" has no undo data (no bounding box or entities recorded)` };
  }
  const result = await server.executeBatch(cmds);
  // Record the undo as its own event
  eventLog.record('undo', `Undid event #${event.id}: ${event.description}`, {
    undone_event_id: event.id,
  });
  return {
    ok: result.ok,
    undone: { id: event.id, description: event.description },
    commands: cmds.length,
  };
}

function summarize(event) {
  return {
    id: event.id,
    type: event.type,
    description: event.description,
    timestamp: event.timestamp,
    coordinates: event.coordinates || null,
    boundingBox: event.boundingBox || null,
    canUndo: !!(event.boundingBox || event.entities),
  };
}

module.exports = { schema, execute };
