'use strict';

const fs = require ('fs');

function unlinkModules (config) {
  config.modules.forEach (info => {
    try {
      const st = fs.lstatSync (info.dst);
      if (st.isSymbolicLink ()) {
        fs.unlinkSync (info.dst);
      }
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
  });
}

module.exports = unlinkModules;
