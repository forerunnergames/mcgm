// Minecraft domain modules — command classification, reference data, and normalization.

'use strict';

const command = require('./command');
const registry = require('./registry');
const normalize = require('./normalize');

module.exports = { command, registry, normalize };
