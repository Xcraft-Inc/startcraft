'use strict';

const fs     = require ('fs');
const path   = require ('path');
const watt   = require ('watt');
const spawn  = require ('child_process').spawn;

function loadIgnoreList () {
  return JSON.parse (fs.readFileSync ('./.scignore'));
}

const ignoreList = loadIgnoreList ();

const npm = (verb, modPath, cwd, next) => {
  console.log (`npm ${verb} ${modPath}`);

  let args = [verb];
  if (Array.isArray (modPath)) {
    args = args.concat (modPath);
  } else {
    args.push (modPath);
  }

  args.push ('--registry');
  args.push ('http://localhost:8485');

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawn (npm, args, {
    stdio: ['ignore', 1, 2],
    cwd: cwd || __dirname
  });
  res.on ('close', next);
};

function parsePackage (packagePath) {
  let def = fs.readFileSync (path.join (__dirname, packagePath));
  def = JSON.parse (def);

  const list = {};

  [def.dependencies, def.devDependencies]
    .filter (deps => !!deps)
    .forEach (deps => {
      Object
        .keys (deps)
        .filter (pkg => {
          return ignoreList.indexOf (pkg) === -1;
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
  ignoreList.forEach (pkg => {
    list = Object.assign (list, parsePackage (`lib/${pkg}/package.json`));
  });

  ignoreList.forEach (pkg => {
    const mod = path.join (__dirname, `./node_modules/${pkg}`);
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

  yield npm ('install', Object.keys (list), null, next);

  ignoreList.forEach (pkg => {
    symlink (
      path.join (__dirname, 'node_modules'),
      path.join (__dirname, `./lib/${pkg}/node_modules`)
    );
    symlink (
      path.join (__dirname, `/lib/${pkg}`),
      path.join (__dirname, `./node_modules/${pkg}`)
    );
  });
});

boot ((err) => {
  if (err) {
    console.error (err);
  }
  console.log ('done');
});
