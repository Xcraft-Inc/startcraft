'use strict';

const fs    = require ('fs');
const path  = require ('path');
const shrew = require ('shrew');

const helpers = require ('./helpers.js');

const root = shrew ();

function loadConfig () {
  const config = JSON.parse (fs.readFileSync (path.join (root, '.scrc')));

  config.modules = config.modules
    .map (pkgPath => {
      const pkgJsonPath = path.join (root, pkgPath, 'package.json');
      const def = JSON.parse (fs.readFileSync (pkgJsonPath));
      return {
        def: def,
        src: path.join (root, pkgPath),
        dst: path.join (root, 'node_modules', def.name)
      };
    })
    .filter (info => helpers.isOsCompatible (info.def, process.platform));

  return config;
}

module.exports = loadConfig ();
