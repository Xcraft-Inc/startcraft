#!/usr/bin/env node
'use strict';

const lifecycleEnv   = 'npm_lifecycle_event';
const lifecycleEvent = process.env[lifecycleEnv];

let lcEvent = null;

switch (lifecycleEvent) {
  case 'preinstall':
  case 'postinstall': {
    lcEvent = require (`../lib/events/${lifecycleEvent}.js`);
    break;
  }
  default: {
    console.error (`lcEvent ${lifecycleEvent} not supported`);
    process.exit (1);
  }
}

lcEvent ((err) => {
  if (err) {
    console.error (err);
  } else {
    console.log ('done');
  }
});
