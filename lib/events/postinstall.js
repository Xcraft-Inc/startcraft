'use strict';

const fse = require('fs-extra');
const path = require('path');
const watt = require('watt');
const shrew = require('shrew');
const merge = require('merge-deep');
const spawn = require('child_process').spawn;
const clc = require('cli-color');

const helpers = require('../helpers.js');
const config = require('../config.js');
const unlinkModules = require('../unlink-modules.js');
const removeLocks = require('../remove-locks.js');

const root = shrew();

if (!root) {
  throw new Error(
    `The root cannot be empty, do not use 'file' or 'npm link' when providing dependency on 'startcraft'`
  );
}

const npm = function(verb, subjects, cwd, returnOutput, callback) {
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
        flags.push('--no-audit');
      }
      break;

    case 'yarn':
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

  const {env} = Object.assign({}, process);
  env.startcraft_event = 'postinstall';
  env.npm_config_package_lock = 'true';

  const cmd = process.platform === 'win32' ? `${agent}.cmd` : agent;
  const proc = spawn(cmd, args, {
    stdio: returnOutput ? ['ignore', 'pipe', 'pipe'] : ['ignore', 1, 2],
    cwd: cwd || __dirname,
    env,
  });

  let output;

  if (returnOutput) {
    output = '';
    proc.stdout.on('data', data => (output += data.toString()));
    proc.stderr.on('data', data => (output += data.toString()));
  }

  proc.on('error', data => console.error(clc.yellowBright(data.toString())));
  proc.on('close', () => callback(null, output));
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

function copyLockFiles(prefix) {
  const lockFiles = ['package-lock.json', 'yarn.lock'];

  const copy = (src, dst) => {
    try {
      fse.copyFileSync(src, dst);
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
  };

  const backup = () => {
    for (const file of lockFiles) {
      fse.removeSync(path.join(root, `${prefix}${file}`));
      copy(path.join(root, file), path.join(root, `${prefix}${file}`));
    }
  };

  const restore = () => {
    for (const file of lockFiles) {
      fse.removeSync(path.join(root, file));
      copy(path.join(root, `${prefix}${file}`), path.join(root, file));
    }
  };

  restore();
  return backup;
}

function copyFullLockFiles() {
  return copyLockFiles('full-');
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

  yield npm('build', [dst], root, false, next);
});

function updateSettings(pkgDef) {
  const hooks = ['postinstall', 'postshrinkwrap'];
  for (const hook of hooks) {
    if (!pkgDef.scripts) {
      pkgDef.scripts = {};
    }
    if (!pkgDef.scripts[hook]) {
      pkgDef.scripts[hook] = 'startcraft';
    } else if (!/startcraft/.test(pkgDef.scripts[hook])) {
      console.log(
        clc.yellowBright(
          `Check your 'startcraft' entry in the '${hook}' script (package.json)`
        )
      );
    }
  }

  let npmrc = [];
  try {
    npmrc = fse
      .readFileSync(path.join(root, '.npmrc'))
      .toString()
      .replace(/\\r/g, '')
      .split('\n');
  } catch (ex) {
    /* Create a new .npmrc file */
  }

  const index = npmrc.findIndex(value => /^package-lock[ \t]*=/.test(value));
  if (index < 0) {
    npmrc.push(`package-lock=false`);
  } else {
    console.log(
      clc.yellowBright(
        `Replace '${npmrc[index]}' in .npmrc by 'package-lock=false'`
      )
    );
    npmrc[index] = `package-lock=false`;
  }
  fse.writeFileSync(path.join(root, '.npmrc'), npmrc.join('\n'));
}

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
    err +=
      '\nIf you think that the clash is not related to your own modules (provided in .csrc file)' +
      '\nthen remove node_modules and the full-package-lock.json files and retry one more time.';
    throw new Error(err);
  }

  yield unlinkModules(config, false);

  let pkgs = []; /* List of mandatory dependencies (prod and dev) */
  let pkgsOpt = []; /* List of optional dependencies */

  Object.keys(list).forEach(mod => {
    const isOpt = list[mod].every(pkg => pkg.type === 'optional');
    const pkgsList = isOpt ? pkgsOpt : pkgs;
    pkgsList.push({mod, version: list[mod][0].ver});
  });

  const isProd = process.env.NODE_ENV === 'production';
  const pkgFile = path.join(root, 'package.json');
  let pkgDef;
  let origPkgDef;

  /* Use the full lock file for consistency in the installations */
  const restoreFull = copyFullLockFiles();

  let report;

  try {
    pkgDef = JSON.parse(fse.readFileSync(pkgFile));
    origPkgDef = JSON.parse(fse.readFileSync(pkgFile));

    /* Main dependencies */
    if (pkgs.length) {
      pkgDef.dependencies = Object.assign(
        pkgDef.dependencies || {},
        ...pkgs.map(pkg => {
          return {[pkg.mod]: pkg.version};
        })
      );
    }

    /* Optional dependencies */
    if (pkgsOpt.length) {
      pkgDef.optionalDependencies = Object.assign(
        pkgDef.optionalDependencies || {},
        ...pkgsOpt.map(pkg => {
          return {[pkg.mod]: pkg.version};
        })
      );
    }

    /* In case of development build, the package.json file is restored. */
    fse.writeFileSync(pkgFile, JSON.stringify(pkgDef, null, 2));

    yield npm('install', [], root, false, next);

    /* Handle substitutions */
    for (const sub in config.substitutions) {
      console.log(
        clc.yellowBright(
          `Try to create substitution of ${sub} by ${config.substitutions[sub]}`
        )
      );

      const substitute = path.join(
        root,
        'node_modules',
        config.substitutions[sub]
      );

      if (!fse.existsSync(substitute)) {
        clc.yellowBright(
          `-> skip substitution of ${sub} by ${config.substitutions[sub]} because ${config.substitutions[sub]} module is not installed`
        );
        continue;
      }

      const src = path.join(root, 'node_modules', sub);
      fse.removeSync(src);
      fse.symlinkSync(config.substitutions[sub], src, 'junction');
    }
  } finally {
    try {
      report = yield npm('audit', [], root, true, next);
    } catch (ex) {
      /* continue */
    }

    /* In case of production build, all modules are saved in the package.json. */
    if (isProd) {
      pkgDef = JSON.parse(fse.readFileSync(pkgFile));
      pkgDef.dependencies = Object.assign(
        pkgDef.dependencies || {},
        ...config.modules.map(info => {
          return {[info.def.name]: info.def.version};
        })
      );
    } else {
      pkgDef = origPkgDef;
      restoreFull();
    }

    /* Update package.json, ... with startcraft stuff */
    updateSettings(pkgDef);

    fse.writeFileSync(pkgFile, JSON.stringify(pkgDef, null, 2));
  }

  for (const info of config.modules) {
    install(info.src, info.dst, next.parallel());
  }

  yield next.sync();

  for (const info of config.modules) {
    if (info.def.scripts && info.def.scripts.startcraft) {
      yield npm('run', ['startcraft'], info.src, false, next);
    }
  }

  return report;
});

module.exports = watt(function*() {
  let report;
  try {
    report = yield postinstall();
  } finally {
    yield removeLocks();
  }
  process.stdout.write(report);
  console.log(clc.greenBright('... please, check for vulnerabilities above'));
});
