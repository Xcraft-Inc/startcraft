'use strict';

const fse = require ('fs-extra');
const path = require ('path');
const watt = require ('watt');
const shrew = require ('shrew');
const semver = require ('semver');
const merge = require ('merge-deep');
const spawn = require ('child_process').spawn;
const clc = require ('cli-color');

const helpers = require ('../helpers.js');
const config = require ('../config.js');
const unlinkModules = require ('../unlink-modules.js');

const root = shrew ();

const npm = function (verb, subjects, cwd, next) {
  const userAgent = 'npm_config_user_agent';
  let agent = process.env[userAgent].replace (/(.*?)\/.*/, '$1');

  if (!/^(npm|yarn)$/.test (agent)) {
    throw new Error (
      `startcraft can be used only with npm or yarn; you are using ${agent}`
    );
  }

  const pkgFile = path.join (cwd, 'package.json');
  const pkgDef = fse.readFileSync (pkgFile);

  if (agent === 'yarn') {
    switch (verb) {
      case 'install':
        verb = 'add';
        break;

      case 'build':
        /* Fallback on npm because yarn is too high level and we want to build
         * ourself the symlinked modules.
         */
        agent = 'npm';
        break;
    }
  }

  const flags = [];
  if (process.env.NODE_ENV === 'production') {
    flags.push ('--production');
  }

  console.log (
    clc.greenBright (
      `${agent} ${verb} ${flags} ${subjects.map (s => `"${s}"`).join (' ')}`
    )
  );

  const args = [verb, ...flags, ...subjects];

  const {env} = process;
  env.startcraft_event = 'postinstall';

  const cmd = process.platform === 'win32' ? `${agent}.cmd` : agent;
  const proc = spawn (cmd, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname,
    env,
  });

  proc.on ('error', data =>
    console.error (clc.yellowBright (data.toString ()))
  );
  proc.on ('exit', (err, res) => {
    fse.writeFileSync (pkgFile, pkgDef);
    next (err, res);
  });
};

function parsePackage (pkgDef) {
  const list = {};
  const packages = config.modules.map (info => info.def.name);

  [pkgDef.dependencies, pkgDef.devDependencies]
    .filter (deps => !!deps)
    .forEach (deps => {
      Object.keys (deps)
        .filter (
          pkg =>
            packages.indexOf (pkg) === -1 && config.exclude.indexOf (pkg) === -1
        )
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
    if (!st.isSymbolicLink ()) {
      const pkgSrc = JSON.parse (
        fse.readFileSync (path.join (src, 'package.json'))
      );
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
      fse.symlinkSync (
        path.relative (path.dirname (dst), src),
        dst,
        'junction'
      );
    }
  }

  /* Ensure that potential node_modules in symlinked modules are removed. */
  fse.removeSync (path.join (dst, 'node_modules'));

  yield npm ('build', [dst], root, next);
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
    try {
      /* It's necessary because [^] are stripped on Window with the spawn
       * of npm by cmd. Even escaping like ^^ are not working. Then the
       * solution is to use range normalized.
       */
      const modVersion = new semver.Range (list[mod][0]).toString ();
      return `${mod}@${modVersion}`;
    } catch (ex) {
      if (helpers.areAllEqual (list[mod])) {
        /* Not a version, looks like an URI */
        return list[mod][0];
      }
      throw ex;
    }
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
