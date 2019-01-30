'use strict';

const fse = require('fs-extra');
const path = require('path');
const watt = require('watt');
const shrew = require('shrew');
const semver = require('semver');
const merge = require('merge-deep');
const spawn = require('child_process').spawn;
const clc = require('cli-color');

const helpers = require('../helpers.js');
const config = require('../config.js');
const unlinkModules = require('../unlink-modules.js');
const removeLocks = require('../remove-locks.js');

const root = shrew();

const npm = function(verb, subjects, cwd, next) {
  const userAgent = 'npm_config_user_agent';
  let agent = process.env[userAgent].replace(/(.*?)\/.*/, '$1');

  if (!/^(npm|yarn)$/.test(agent)) {
    throw new Error(
      `startcraft can be used only with npm or yarn; you are using ${agent}`
    );
  }

  const flags = [];
  const isProd = process.env.NODE_ENV === 'production';

  switch (agent) {
    case 'npm':
      if (verb === 'install') {
        flags.push('--no-package-lock');
      }
      break;

    case 'yarn':
      switch (verb) {
        case 'install':
          verb = 'add';
          flags.push('--no-lockfile');
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
    flags.push('--production');
  }

  console.log(
    clc.greenBright(
      `${agent} ${verb} ${flags} \\\n${subjects
        .sort()
        .map((s, i) => `  "${s}"${i < subjects.length - 1 ? ' \\' : ''}`)
        .join('\n')}`
    )
  );

  const args = [verb, ...flags, ...subjects];

  const {env} = process;
  env.startcraft_event = 'postinstall';

  const cmd = process.platform === 'win32' ? `${agent}.cmd` : agent;
  const proc = spawn(cmd, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname,
    env,
  });

  proc.on('error', data => console.error(clc.yellowBright(data.toString())));
  proc.on('exit', next);
};

function parsePackage(pkgDef) {
  const list = {};
  const packages = config.modules.map(info => info.def.name);
  const addDevDeps = process.env.NODE_ENV !== 'production';

  const depList = {
    normal: pkgDef.dependencies,
    optional: pkgDef.optionalDependencies,
  };
  if (addDevDeps) {
    depList.dev = pkgDef.devDependencies;
  }

  for (const key in depList) {
    const deps = depList[key];
    if (!deps) {
      continue;
    }

    Object.keys(deps)
      .filter(
        pkg =>
          packages.indexOf(pkg) === -1 && config.exclude.indexOf(pkg) === -1
      )
      .forEach(pkg => {
        if (!list[pkg]) {
          list[pkg] = [];
        }
        list[pkg].push({ver: deps[pkg], type: key});
      });
  }

  return list;
}

const install = watt(function*(src, dst, next) {
  const copyModule = () => {
    if (helpers.useSymlinks()) {
      fse.symlinkSync(path.relative(path.dirname(dst), src), dst, 'junction');
    } else {
      fse.copySync(src, dst);
    }
  };

  try {
    copyModule();
  } catch (ex) {
    if (ex.code !== 'EEXIST') {
      throw ex;
    }

    /* Check if it's a symlink otherwise check the version and replace by
     * the right module if it matches.
     */
    const st = fse.lstatSync(dst);
    if (!st.isSymbolicLink()) {
      const pkgSrc = JSON.parse(
        fse.readFileSync(path.join(src, 'package.json'))
      );
      const pkgDst = JSON.parse(
        fse.readFileSync(path.join(dst, 'package.json'))
      );
      const list = [pkgSrc.version, pkgDst.version];

      if (!helpers.isSemverSatisfies(list)) {
        throw new Error(
          `Clash with ${path.basename(src)} versions ${list.join(', ')}`
        );
      }
    }

    /* Replace by the right module */
    fse.removeSync(dst);
    copyModule();
  }

  /* Remove obsolete nested node_modules */
  fse.removeSync(path.join(dst, 'node_modules'));

  yield npm('build', [dst], root, next);
});

const postinstall = watt(function*(next) {
  let err = null;
  let list = {};

  config.modules.forEach(info => {
    list = merge(list, parsePackage(info.def));
  });

  /* Check all versions for each dependency. All versions must be range-
   * compatible.
   */
  Object.keys(list).forEach(mod => {
    const vers = list[mod].map(pkg => pkg.ver);
    if (!helpers.isSemverSatisfies(vers)) {
      err = `Clash with ${mod} versions ${vers.join(', ')}`;
    }
  });

  if (err) {
    throw new Error(err);
  }

  yield unlinkModules(config, false);

  let pkgs = []; /* List of mandatory dependencies (prod and dev) */
  let pkgsOpt = []; /* List of optional dependencies */

  Object.keys(list).forEach(mod => {
    const isOpt = list[mod].every(pkg => pkg.type === 'optional');
    const pkgsList = isOpt ? pkgsOpt : pkgs;
    try {
      /* It's necessary because [^] are stripped on Window with the spawn
       * of npm by cmd. Even escaping like ^^ are not working. Then the
       * solution is to use range normalized.
       */
      const modVersion = new semver.Range(list[mod][0].ver).toString();
      pkgsList.push(`${mod}@${modVersion}`);
    } catch (ex) {
      if (helpers.areAllEqual(list[mod].map(pkg => pkg.ver))) {
        /* Not a version, looks like an URI */
        pkgsList.push(list[mod][0].ver);
        return;
      }
      throw ex;
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const pkgFile = path.join(root, 'package.json');
  let pkgDef;

  try {
    /* In case of development build, the package.json file is untouched. */
    if (!isProd) {
      pkgDef = JSON.parse(fse.readFileSync(pkgFile));
    }

    /* Main dependencies */
    if (pkgs.length) {
      const subjects = config.npmInstallArgs.concat(pkgs);
      yield npm('install', subjects, root, next);
    }

    /* Optional dependencies */
    if (pkgsOpt.length) {
      const subjects = config.npmInstallArgs.concat(pkgsOpt);
      for (const subject of subjects) {
        try {
          yield npm('install', [subject], root, next);
        } catch (ex) {
          console.error(`Warning, optional dependencies error: ${ex}`);
        }
      }
    }

    /* Handle substitutions */
    for (const sub in config.substitutions) {
      console.log(
        clc.yellowBright(
          `Create substitution of ${sub} by ${config.substitutions[sub]}`
        )
      );

      const src = path.join(root, 'node_modules', sub);
      const target = path.join(root, 'node_modules', config.substitutions[sub]);
      fse.removeSync(src);
      fse.symlinkSync(sub, target, 'junction');
    }
  } finally {
    /* In case of production build, all modules are saved in the package.json. */
    if (isProd) {
      pkgDef = JSON.parse(fse.readFileSync(pkgFile));
      pkgDef.dependencies = Object.assign(
        pkgDef.dependencies || {},
        ...config.modules.map(info => {
          return {[info.def.name]: info.def.version};
        })
      );
    }

    fse.writeFileSync(pkgFile, JSON.stringify(pkgDef, null, 2));
  }

  for (const info of config.modules) {
    install(info.src, info.dst, next.parallel());
  }

  yield next.sync();

  for (const info of config.modules) {
    if (info.def.scripts && info.def.scripts.startcraft) {
      yield npm('run', ['startcraft'], info.src, next);
    }
  }

  yield removeLocks();
});

module.exports = postinstall;
