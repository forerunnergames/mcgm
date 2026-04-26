// FACADE — re-exports from server/ modules for backwards compatibility.
// All logic has moved to server/api.js, server/executor.js, server/chunk-loader.js,
// and server/log-reader.js. This file will be removed in Phase 5.

'use strict';

module.exports = require('./server');
