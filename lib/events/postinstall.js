'use strict';

const fs     = require ('fs');
const path   = require ('path');
const watt   = require ('watt');
const shrew  = require ('shrew');
const merge  = require ('merge-deep');
const spawn  = require ('child_process').spawn;

const config        = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

const root = shrew ();

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
          if (!list.hasOwnProperty (pkg)) {
            list[pkg] = [];
          }
          list[pkg].push (deps[pkg]);
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

const postinstall = watt (function * (next) {
  let mustThrown = false;
  let list = {};

  config.modules.forEach (pkgPath => {
    const pkgJsonPath = path.join (root, pkgPath, 'package.json');
    list = merge (list, parsePackage (pkgJsonPath));
  });

  Object
    .keys (list)
    .forEach (mod => {
      if (list[mod].length > 1) {
        console.error (`Clash with ${mod} versions ${list[mod].join (', ')}`);
        mustThrown = true;
      }
    });

  if (mustThrown) {
    throw new Error ('clash');
  }

  unlinkModules (config, root);

  yield npm ('install', Object.keys (list).map (mod => `${mod}@${list[mod][0]}`), root, next);

  config.modules.forEach (pkgPath => {
    symlink (
      path.join (root, pkgPath),
      path.join (root, 'node_modules', path.basename (pkgPath))
    );
  });
});

module.exports = postinstall;
