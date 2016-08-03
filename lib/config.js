'use strict';

const fs    = require ('fs');
const path  = require ('path');
const shrew = require ('shrew');

const root = shrew ();

function loadConfig () {
  return JSON.parse (fs.readFileSync (path.join (root, '.scrc')));
}

module.exports = loadConfig ();
