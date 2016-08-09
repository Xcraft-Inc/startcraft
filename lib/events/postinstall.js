'use strict';

const fs     = require ('fs');
const watt   = require ('watt');
const shrew  = require ('shrew');
const merge  = require ('merge-deep');
const spawn  = require ('child_process').spawn;

const helpers       = require ('../helpers.js');
const config        = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

const root = shrew ();

const npm = function (verb, subjects, cwd, next) {
  console.log (`npm ${verb} ${subjects}`);

  let args = [verb];
  if (Array.isArray (subjects)) {
    args = args.concat (subjects);
  } else {
    args.push (subjects);
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const proc = spawn (npm, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname
  });

  proc.on ('error', (data) => console.error (data.toString ()));
  proc.on ('exit', next);
};

function parsePackage (pkgDef) {
  const list = {};
  const packages = config.modules.map (info => info.def.name);

  [pkgDef.dependencies, pkgDef.devDependencies]
    .filter (deps => !!deps)
    .forEach (deps => {
      Object
        .keys (deps)
        .filter (pkg => {
          return packages.indexOf (pkg) === -1;
        })
        .forEach (pkg => {
          if (!list[pkg]) {
            list[pkg] = [];
          }
          list[pkg].push (deps[pkg]);
        });
    });

  return list;
}

const install = watt (function * (src, dst, next) {
  try {
    fs.symlinkSync (src, dst, 'junction');
  } catch (ex) {
    if (ex.code !== 'EEXIST') {
      throw ex;
    }
  }

  yield npm ('build', [dst], root, next);
});

const postinstall = watt (function * (next) {
  let err = null;
  let list = {};

  config.modules.forEach (info => {
    list = merge (list, parsePackage (info.def));
  });

  Object
    .keys (list)
    .forEach (mod => {
      if (!helpers.isSemverSatisfies (list[mod])) {
        err = `Clash with ${mod} versions ${list[mod].join (', ')}`;
      }
    });

  if (err) {
    throw new Error (err);
  }

  unlinkModules (config);

  const pkgs = Object.keys (list).map (mod => `"${mod}@${list[mod][0]}"`);
  const subjects = config.npmInstallArgs.concat (pkgs);
  yield npm ('install', subjects, root, next);

  for (const info of config.modules) {
    yield install (info.src, info.dst);
  }

  for (const info of config.modules) {
    if (info.def.scripts &&
        info.def.scripts.startcraft) {
      yield npm ('run', ['startcraft'], info.src, next);
    }
  }
});

module.exports = postinstall;
