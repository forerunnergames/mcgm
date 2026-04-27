// Pattern matching — skip the LLM for common commands.
// Returns { matched: true, tool, input } or { matched: false }.
// Saves ~$0.03 per matched request by avoiding the API entirely.

'use strict';

/**
 * Try to match a message to a tool call without using the LLM.
 * Only matches unambiguous, high-confidence patterns.
 *
 * @param {string} sender - Player who sent the message
 * @param {string} message - The chat message
 * @param {function} resolvePlayer - Function to resolve nickname → in-game name
 * @returns {{ matched: boolean, tool?: string, input?: object, reply?: string }}
 */
function tryMatch(sender, message, resolvePlayer) {
  const msg = message.toLowerCase().trim();

  // --- KITS ---
  // "give me max gear/kit", "max kit", "give max kit to andrew"
  const kitMatch = msg.match(/(?:give\s+(?:me\s+|(\w+)\s+)?)?(?:the\s+)?(max|min|level\s*[1-5]|lvl\s*[1-5]|tier\s*[1-5]|overworld.?pvp|underwater|lava|elytra|nether|[1-5])\s*(?:kit|gear|loadout|equipment|armor)/i)
    || msg.match(/^(max|min)\s*(?:kit|gear)$/i)
    || msg.match(/^(?:kit|gear)\s+(max|min|[1-5])$/i);
  if (kitMatch) {
    const kitName = (kitMatch[2] || kitMatch[1] || 'max').replace(/\s+/g, '').replace(/level|lvl|tier/i, '');
    const targetName = kitMatch[1] && !['max','min','level','lvl','tier'].includes(kitMatch[1].toLowerCase()) ? kitMatch[1] : null;
    const player = targetName ? resolvePlayer(targetName) : sender;
    return { matched: true, tool: 'kit', input: { player, kit: kitName, action: 'apply' } };
  }

  // "give me gear", "gear me up", "equip me"
  if (/^(?:give me gear|gear me up|equip me|gear up|load me up)/.test(msg)) {
    return { matched: true, tool: 'kit', input: { player: sender, kit: 'max', action: 'apply' } };
  }

  // "strip my gear", "clear my inventory", "strip all"
  if (/^(?:strip|clear|wipe)\s+(?:my\s+)?(?:gear|inventory|kit|everything|all)/.test(msg)) {
    return { matched: true, tool: 'kit', input: { player: sender, action: 'strip_all' } };
  }

  // --- BUFFS ---
  // "make me invincible", "buff me", "max buff"
  if (/(?:make\s+me\s+invincible|buff\s+me|max\s+buff\s+me|make\s+me\s+god)/.test(msg)) {
    return { matched: true, tool: 'buff_debuff', input: { player: sender, type: 'buff', level: 5 } };
  }

  // "debuff <player>", "nerf <player>" — check BEFORE buff to avoid "debuff" matching "buff"
  const debuffMatch = msg.match(/(?:debuff|nerf|weaken)\s+(\w+)/);
  if (debuffMatch) {
    return { matched: true, tool: 'buff_debuff', input: { player: resolvePlayer(debuffMatch[1]), type: 'debuff', level: 5 } };
  }

  // "buff <player>", "make <player> invincible"
  const buffPlayerMatch = msg.match(/(?:^|\s)buff\s+(\w+)|make\s+(\w+)\s+invincible/);
  if (buffPlayerMatch) {
    const target = buffPlayerMatch[1] || buffPlayerMatch[2];
    return { matched: true, tool: 'buff_debuff', input: { player: resolvePlayer(target), type: 'buff', level: 5 } };
  }

  // "clear effects", "remove buffs"
  if (/(?:clear|remove)\s+(?:my\s+)?(?:effects?|buffs?|debuffs?)/.test(msg)) {
    return { matched: true, tool: 'buff_debuff', input: { player: sender, type: 'clear' } };
  }

  // --- TELEPORT ---
  // "tp me to <player>", "teleport to <player>"
  const tpToPlayerMatch = msg.match(/(?:tp|teleport)\s+(?:me\s+)?to\s+(\w+)/);
  if (tpToPlayerMatch) {
    const target = tpToPlayerMatch[1].toLowerCase();
    // Check if it's a biome/structure name or a player
    const biomeWords = ['village', 'ocean', 'mountain', 'forest', 'desert', 'jungle', 'swamp', 'cave', 'dark', 'nether', 'end', 'trial', 'monument', 'fortress', 'bastion', 'mansion', 'temple', 'igloo', 'shipwreck', 'city', 'outpost', 'stronghold', 'mineshaft', 'coral', 'reef', 'mushroom', 'cherry', 'meadow', 'plains', 'taiga', 'savanna', 'badlands', 'bamboo', 'birch', 'peaks', 'frozen'];
    if (biomeWords.some(w => target.includes(w))) {
      // It's a biome/structure — don't match, let LLM handle for the full location string
      return { matched: false };
    }
    // It's a player name
    return { matched: true, tool: 'teleport_player', input: { player: sender, target_player: resolvePlayer(target) } };
  }

  // --- SLEEP ---
  if (/^(?:sleep|go to sleep|leave|let me sleep|bed|night|leave for sleep)/.test(msg)) {
    return { matched: true, tool: 'leave_for_sleep', input: { delay_seconds: 25 } };
  }

  // --- SERVER STATS ---
  if (/^(?:server\s*(?:stats?|health|status)|how.s the server|tps|is the server ok)/.test(msg)) {
    return { matched: true, tool: 'get_server_stats', input: {} };
  }

  // --- WHO'S ONLINE ---
  if (/^(?:who.s (?:online|on|here|playing)|player list|list players|who is online)/.test(msg)) {
    return { matched: true, tool: 'list_online_players', input: {} };
  }

  return { matched: false };
}

module.exports = { tryMatch };
