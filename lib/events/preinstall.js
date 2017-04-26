'use strict';

const watt = require ('watt');

const config = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

const preinstall = watt (function* () {
  yield unlinkModules (config, true);
});

module.exports = preinstall;
