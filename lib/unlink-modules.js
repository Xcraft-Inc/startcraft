'use strict';

const fs     = require ('fs');
const watt   = require ('watt');
const rimraf = require ('rimraf');

const unlinkModules = watt (function * (config, force, next) {
  for (const info of config.modules) {
    if (!info.dst) {
      continue;
    }

    try {
      if (force || fs.lstatSync (info.dst).isSymbolicLink ()) {
        console.log (`unlink module ${info.dst}`);
        yield rimraf (info.dst, next);
      } else {
        throw new Error (
          `The module ${info.def.name} already exists and it's not a symlink. ` +
          `${info.def.name} can not be a dependency of a module which is not ` +
          `referenced in your .scrc file.`
        );
      }
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
  }
});

module.exports = unlinkModules;
