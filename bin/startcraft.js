#!/usr/bin/env node
'use strict';

const fs     = require ('fs');
const path   = require ('path');
const watt   = require ('watt');
const shrew  = require ('shrew');
const spawn  = require ('child_process').spawn;

const root = shrew ();

function loadConfig () {
  return JSON.parse (fs.readFileSync (path.join (root, '.scrc')));
}

const config = loadConfig ();

const npm = (verb, modPath, cwd, next) => {
  console.log (`npm ${verb} ${modPath}`);

  let args = [verb];
  if (Array.isArray (modPath)) {
    args = args.concat (modPath);
  } else {
    args.push (modPath);
  }
  args.concat (config.npmargs);

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawn (npm, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname
  });
  res.on ('close', next);
};

function parsePackage (pkgPath) {
  let def = fs.readFileSync (pkgPath);
  def = JSON.parse (def);

  const list = {};
  const packages = config.modules.map (mod => path.basename (mod));

  [def.dependencies, def.devDependencies]
    .filter (deps => !!deps)
    .forEach (deps => {
      Object
        .keys (deps)
        .filter (pkg => {
          return packages.indexOf (pkg) === -1;
        })
        .forEach (pkg => {
          list[`${pkg}@${deps[pkg]}`] = null;
        });
    });

  return list;
}

function symlink (src, dst) {
  try {
    fs.symlinkSync (src, dst, 'junction');
  } catch (ex) {
    if (ex.code !== 'EEXIST') {
      throw ex;
    }
  }
}

const boot = watt (function * (next) {
  let list = {};

  config.modules.forEach (pkgPath => {
    const pkgJsonPath = path.join (root, pkgPath, 'package.json');
    list = Object.assign (list, parsePackage (pkgJsonPath));
  });

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

  yield npm ('install', Object.keys (list), root, next);

  config.modules.forEach (pkgPath => {
    symlink (
      path.join (root, 'node_modules'),
      path.join (root, pkgPath, 'node_modules')
    );
    symlink (
      path.join (root, pkgPath),
      path.join (root, 'node_modules', path.basename (pkgPath))
    );
  });
});

boot ((err) => {
  if (err) {
    console.error (err);
  }
  console.log ('done');
});
