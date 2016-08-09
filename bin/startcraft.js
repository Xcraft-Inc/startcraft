#!/usr/bin/env node
'use strict';

const exec  = require ('child_process').exec;
const watt  = require ('watt');
const shrew = require ('shrew');

const config = require ('../lib/config.js');

const lifecycleEnv   = 'npm_lifecycle_event';
const lifecycleEvent = process.env[lifecycleEnv];
const root           = shrew ();

let lcEvent = null;

switch (lifecycleEvent) {
  case 'preinstall':
  case 'postinstall': {
    lcEvent = require (`../lib/events/${lifecycleEvent}.js`);
    break;
  }
  default: {
    throw new Error (`lcEvent ${lifecycleEvent} not supported`);
  }
}

function cbExec (next) {
  return function (err, stdout, stderr) {
    if (stdout) {
      console.log (stdout);
    }
    if (stderr) {
      console.error (stderr);
    }
    next (err);
  };
}

const scExec = watt (function * (section, next) {
  if (config.scripts &&
      config.scripts.presc &&
      config.scripts[section][lifecycleEvent]) {
    console.log (`Run ${lifecycleEvent} script for section '${section}' ...`);

    const cmds = config.scripts[section][lifecycleEvent];
    for (const cmd of cmds) {
      yield exec (cmd, {cwd: root}, cbExec (next));
    }
  }
});

watt (function * () {
  yield scExec ('presc');
  yield lcEvent ();
  yield scExec ('postsc');
}, (ex) => {
  if (ex) {
    console.error (ex.message || ex);
  } else {
    console.log ('startcraft done');
  }
}) ();
