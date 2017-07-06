'use strict';

const path = require ('path');
const fse = require ('fs-extra');
const watt = require ('watt');
const shrew = require ('shrew');
const clc = require ('cli-color');

const root = shrew ();

const postshrinkwrap = watt (function* (next) {
  const lockFiles = ['package-lock.json', 'yarn.lock'];

  console.log (
    clc.yellowBright (`Remove all lock files (${lockFiles.join (', ')})`)
  );

  for (const file of lockFiles) {
    yield fse.unlink (path.join (root, file), next);
  }
});

module.exports = postshrinkwrap;
