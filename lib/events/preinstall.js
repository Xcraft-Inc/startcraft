'use strict';

const shrew = require ('shrew');

const config        = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

function preinstall () {
  unlinkModules (config, shrew ());
}

module.exports = preinstall;
