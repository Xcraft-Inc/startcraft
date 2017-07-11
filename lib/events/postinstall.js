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
const removeLocks = require ('../remove-locks.js');

const root = shrew ();

const npm = function (verb, subjects, cwd, next) {
  const userAgent = 'npm_config_user_agent';
  let agent = process.env[userAgent].replace (/(.*?)\/.*/, '$1');

  if (!/^(npm|yarn)$/.test (agent)) {
    throw new Error (
      `startcraft can be used only with npm or yarn; you are using ${agent}`
    );
  }

  const flags = [];
  const isProd = process.env.NODE_ENV === 'production';

  switch (agent) {
    case 'npm':
      if (verb === 'install' && !isProd) {
        flags.push ('--no-save');
      }
      break;

    case 'yarn':
      switch (verb) {
        case 'install':
          verb = 'add';
          flags.push ('--no-lockfile');
          break;

        case 'build':
          /* Fallback on npm because yarn is too high level and we want to build
           * ourself the symlinked modules.
           */
          agent = 'npm';
          break;
      }
      break;
  }

  if (isProd) {
    flags.push ('--production');
  }

  console.log (
    clc.greenBright (
      `${agent} ${verb} ${flags} \\\n${subjects
        .sort ()
        .map ((s, i) => `  "${s}"${i < subjects.length - 1 ? ' \\' : ''}`)
        .join ('\n')}`
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
  proc.on ('exit', next);
};

function parsePackage (pkgDef) {
  const list = {};
  const packages = config.modules.map (info => info.def.name);
  const addDevDeps = process.env.NODE_ENV !== 'production';

  const deps = [pkgDef.dependencies];
  if (addDevDeps) {
    deps.push (pkgDef.devDependencies);
  }

  deps.filter (deps => !!deps).forEach (deps => {
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
  const useSymlink = process.env.NODE_ENV !== 'production';

  const copyModule = () => {
    if (useSymlink) {
      fse.symlinkSync (
        path.relative (path.dirname (dst), src),
        dst,
        'junction'
      );
    } else {
      fse.copySync (src, dst);
    }
  };

  try {
    copyModule ();
  } catch (ex) {
    if (ex.code !== 'EEXIST') {
      throw ex;
    }

    /* Check if it's a symlink otherwise check the version and replace by
     * the right module if it matches.
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
    }

    /* Replace by the right module */
    fse.removeSync (dst);
    copyModule ();
  }

  /* Remove obsolete nested node_modules */
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

  const isProd = process.env.NODE_ENV === 'production';
  const pkgFile = path.join (root, 'package.json');
  let pkgDef;

  /* In case of development build, the package.json file is untouched. */
  if (!isProd) {
    pkgDef = fse.readFileSync (pkgFile);
  }

  const subjects = config.npmInstallArgs.concat (pkgs);
  yield npm ('install', subjects, root, next);

  /* In case of production build, all modules are saved in the package.json. */
  if (isProd) {
    pkgDef = fse.readFileSync (pkgFile);
    pkgDef.dependencies = (pkgDef.dependencies || []).concat (
      config.modules.map (info => {
        return {[info.def.name]: info.def.version};
      })
    );
  }

  fse.writeFileSync (pkgFile, pkgDef);

  for (const info of config.modules) {
    yield install (info.src, info.dst);
  }

  for (const info of config.modules) {
    if (info.def.scripts && info.def.scripts.startcraft) {
      yield npm ('run', ['startcraft'], info.src, next);
    }
  }

  yield removeLocks ();
});

module.exports = postinstall;
