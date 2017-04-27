'use strict';

const fse = require ('fs-extra');
const path = require ('path');
const watt = require ('watt');
const shrew = require ('shrew');
const semver = require ('semver');
const merge = require ('merge-deep');
const spawn = require ('child_process').spawn;

const helpers = require ('../helpers.js');
const config = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

const root = shrew ();

const npm = function (verb, subjects, cwd, next) {
  console.log (`npm ${verb} ${subjects.map (s => `"${s}"`).join (' ')}`);

  let args = [verb];
  if (Array.isArray (subjects)) {
    args = args.concat (subjects);
  } else {
    args.push (subjects);
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const proc = spawn (npm, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname,
  });

  proc.on ('error', data => console.error (data.toString ()));
  proc.on ('exit', next);
};

function parsePackage (pkgDef) {
  const list = {};
  const packages = config.modules.map (info => info.def.name);

  [pkgDef.dependencies, pkgDef.devDependencies]
    .filter (deps => !!deps)
    .forEach (deps => {
      Object.keys (deps)
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

const install = watt (function* (src, dst, next) {
  const pkgSrc = JSON.parse (
    fse.readFileSync (path.join (src, 'package.json'))
  );

  try {
    fse.symlinkSync (path.relative (path.dirname (dst), src), dst, 'junction');
  } catch (ex) {
    if (ex.code !== 'EEXIST') {
      throw ex;
    }

    /* Check if it's a symlink otherwise check the version and replace by
     * the symlink if it matches.
     */
    const st = fse.lstatSync (dst);
    if (st.isSymbolicLink ()) {
      return;
    }

    const pkgDst = JSON.parse (
      fse.readFileSync (path.join (dst, 'package.json'))
    );
    const list = [pkgSrc.version, pkgDst.version];

    if (!helpers.isSemverSatisfies (list)) {
      throw new Error (
        `Clash with ${path.basename (src)} versions ${list.join (', ')}`
      );
    }

    /* Replace by the symlink */
    fse.removeSync (dst);
    fse.symlinkSync (path.relative (path.dirname (dst), src), dst, 'junction');
  }

  if (pkgSrc.scripts && pkgSrc.scripts.build) {
    yield npm ('build', [dst], root, next);
  }
});

const postinstall = watt (function* (next) {
  let err = null;
  let list = {};

  config.modules.forEach (info => {
    list = merge (list, parsePackage (info.def));
  });

  /* Check all versions for each dependency. All versions must be range-
   * compatible.
   */
  Object.keys (list).forEach (mod => {
    if (!helpers.isSemverSatisfies (list[mod])) {
      err = `Clash with ${mod} versions ${list[mod].join (', ')}`;
    }
  });

  if (err) {
    throw new Error (err);
  }

  yield unlinkModules (config, false);

  const pkgs = Object.keys (list).map (mod => {
    /* It's necessary because [^] are stripped on Window with the spawn
     * of npm by cmd. Even escaping like ^^ are not working. Then the
     * solution is to use range normalized.
     */
    const modVersion = new semver.Range (list[mod][0]).toString ();
    return `${mod}@${modVersion}`;
  });

  const subjects = config.npmInstallArgs.concat (pkgs);
  yield npm ('install', subjects, root, next);

  for (const info of config.modules) {
    yield install (info.src, info.dst);
  }

  for (const info of config.modules) {
    if (info.def.scripts && info.def.scripts.startcraft) {
      yield npm ('run', ['startcraft'], info.src, next);
    }
  }
});

module.exports = postinstall;
