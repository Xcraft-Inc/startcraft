'use strict';

const config        = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

function preinstall () {
  unlinkModules (config);
}

module.exports = preinstall;
