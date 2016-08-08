'use strict';

const fs    = require ('fs');
const path  = require ('path');
const shrew = require ('shrew');

const helpers = require ('./helpers.js');

const root = shrew ();


class Config {
  constructor () {
    this._config = JSON.parse (fs.readFileSync (path.join (root, '.scrc')));
  }

  get npmInstallArgs () {
    return this._config.npmInstallArgs;
  }

  get modules () {
    return this._config.modules
      .map (pkgPath => {
        const pkgJsonPath = path.join (root, pkgPath, 'package.json');
        try {
          const def = JSON.parse (fs.readFileSync (pkgJsonPath));
          return {
            def: def,
            src: path.join (root, pkgPath),
            dst: path.join (root, 'node_modules', def.name)
          };
        } catch (ex) {
          return {
            def: {},
            src: null,
            dst: null
          };
        }
      })
      .filter (info => helpers.isOsCompatible (info.def, process.platform));
  }

  get scripts () {
    return this._config.scripts;
  }
}

module.exports = new Config ();
