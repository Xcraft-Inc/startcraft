'use strict';

const fs   = require ('fs');
const path = require ('path');

function unlinkModules (config, root) {
  config.modules.forEach (pkgPath => {
    const mod = path.join (root, 'node_modules', path.basename (pkgPath));
    try {
      const st = fs.lstatSync (mod);
      if (st.isSymbolicLink ()) {
        fs.unlinkSync (mod);
      }
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
  });
}

module.exports = unlinkModules;
