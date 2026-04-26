// Equip a player with a full gear set, auto-equipped to correct armor/weapon/hotbar slots.

'use strict';

const server = require('../server');

const ENCHANTMENT_PRESETS = {
  netherite: {
    helmet: 'minecraft:netherite_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:respiration":3,"minecraft:aqua_affinity":1,"minecraft:thorns":3}]',
    chestplate: 'minecraft:netherite_chestplate[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    leggings: 'minecraft:netherite_leggings[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3,"minecraft:swift_sneak":3}]',
    boots: 'minecraft:netherite_boots[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3,"minecraft:feather_falling":4,"minecraft:depth_strider":3,"minecraft:soul_speed":3}]',
    sword: 'minecraft:netherite_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:looting":3,"minecraft:fire_aspect":2,"minecraft:knockback":2,"minecraft:sweeping_edge":3}]',
    pickaxe: 'minecraft:netherite_pickaxe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:fortune":3}]',
    axe: 'minecraft:netherite_axe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:sharpness":5}]',
    shovel: 'minecraft:netherite_shovel[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:silk_touch":1}]',
    bow: 'minecraft:bow[minecraft:enchantments={"minecraft:power":5,"minecraft:punch":2,"minecraft:flame":1,"minecraft:infinity":1,"minecraft:unbreaking":3}]',
    shield: 'minecraft:shield[minecraft:enchantments={"minecraft:unbreaking":3,"minecraft:mending":1}]',
    totem: 'minecraft:totem_of_undying',
    elytra: 'minecraft:elytra[minecraft:enchantments={"minecraft:unbreaking":3,"minecraft:mending":1}]',
    fireworks: 'minecraft:firework_rocket[minecraft:fireworks={flight_duration:3}] 64',
    trident: 'minecraft:trident[minecraft:enchantments={"minecraft:loyalty":3,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:channeling":1}]',
  },
  diamond: {
    helmet: 'minecraft:diamond_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    chestplate: 'minecraft:diamond_chestplate[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    leggings: 'minecraft:diamond_leggings[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3}]',
    boots: 'minecraft:diamond_boots[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:feather_falling":4}]',
    sword: 'minecraft:diamond_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:unbreaking":3,"minecraft:looting":3}]',
    pickaxe: 'minecraft:diamond_pickaxe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:fortune":3}]',
    shield: 'minecraft:shield',
  },
  iron: {
    helmet: 'minecraft:iron_helmet', chestplate: 'minecraft:iron_chestplate',
    leggings: 'minecraft:iron_leggings', boots: 'minecraft:iron_boots',
    sword: 'minecraft:iron_sword', pickaxe: 'minecraft:iron_pickaxe', shield: 'minecraft:shield',
  },
  leather: {
    helmet: 'minecraft:leather_helmet[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    chestplate: 'minecraft:leather_chestplate[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    leggings: 'minecraft:leather_leggings[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    boots: 'minecraft:leather_boots[minecraft:enchantments={"minecraft:protection":4,"minecraft:unbreaking":3,"minecraft:mending":1,"minecraft:thorns":3}]',
    sword: 'minecraft:wooden_sword[minecraft:enchantments={"minecraft:sharpness":5,"minecraft:unbreaking":3,"minecraft:mending":1}]',
    pickaxe: 'minecraft:wooden_pickaxe[minecraft:enchantments={"minecraft:efficiency":5,"minecraft:unbreaking":3,"minecraft:mending":1}]',
    shield: 'minecraft:shield',
  },
};

const SLOT_MAP = {
  helmet: 'armor.head', chestplate: 'armor.chest', elytra: 'armor.chest',
  leggings: 'armor.legs', boots: 'armor.feet',
  sword: 'weapon.mainhand', trident: 'weapon.mainhand',
  shield: 'weapon.offhand', totem: 'weapon.offhand',
  bow: 'hotbar.0', pickaxe: 'hotbar.1', axe: 'hotbar.2',
  shovel: 'hotbar.3', fireworks: 'hotbar.4',
};

const schema = {
  name: 'equip_player',
  description: 'Give a player a full gear set, auto-equipped to the correct armor/weapon/hotbar slots. Handles enchantment syntax and /item replace internally. Use this instead of give_item for any equipment.',
  input_schema: {
    type: 'object',
    properties: {
      player: { type: 'string', description: 'Player name (e.g. .player1, .player2)' },
      tier: { type: 'string', enum: ['netherite', 'diamond', 'iron', 'leather'], description: 'Gear tier. Default netherite.' },
      items: {
        type: 'array', items: { type: 'string' },
        description: 'Which items to equip. Options: helmet, chestplate, leggings, boots, sword, pickaxe, axe, shovel, bow, shield, totem, elytra, fireworks, trident. Default: full armor + sword + pickaxe + shield.',
      },
    },
    required: ['player'],
  },
};

async function execute(input) {
  const player = input.player;
  const tier = input.tier || 'netherite';
  const preset = ENCHANTMENT_PRESETS[tier] || ENCHANTMENT_PRESETS.netherite;
  const itemList = input.items || ['helmet', 'chestplate', 'leggings', 'boots', 'sword', 'pickaxe', 'shield'];
  const cmds = [];
  const equipped = [];

  for (const item of itemList) {
    const itemData = preset[item];
    const slot = SLOT_MAP[item];
    if (!itemData || !slot) continue;
    const parts = itemData.split(' ');
    if (parts.length > 1) {
      cmds.push(`item replace entity ${player} ${slot} with ${parts[0]} ${parts[1]}`);
    } else {
      cmds.push(`item replace entity ${player} ${slot} with ${itemData}`);
    }
    equipped.push(item);
  }

  if (cmds.length === 0) return { ok: false, error: 'no valid items to equip' };
  const result = await server.executeBatch(cmds);
  return { ok: result.ok, equipped, player, tier, commands: cmds.length, errors: result.errors };
}

module.exports = { schema, execute, ENCHANTMENT_PRESETS, SLOT_MAP };
