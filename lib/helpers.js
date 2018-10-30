'use strict';

const semver = require('semver');

exports.isOsCompatible = function(pkgDef, platform) {
  let isCompatible = true;

  if (pkgDef.os && pkgDef.os.length > 0) {
    isCompatible = pkgDef.os.some(os => {
      if (os === platform) {
        return true;
      }
      if (/^!/.test(os) && os !== `!${platform}`) {
        return true;
      }
      return false;
    });
  }

  return isCompatible;
};

exports.areAllEqual = function(values) {
  return values.reduce((v1, v2) => v1 === v2);
};

exports.isSemverSatisfies = function(versions) {
  if (!versions || !versions.length) {
    return true;
  }

  try {
    versions.reduce((v1, v2) => {
      const r1 = new semver.Range(v1);
      const r2 = new semver.Range(v2);
      let bad = 0;

      r1.set.forEach(_r1 =>
        r2.set.forEach(_r2 => {
          const ltr1 = _r1[_r1.length - 1];
          const ltr2 = _r2[_r2.length - 1];
          const tr1 = ltr1.value.replace('<=', '');
          const tr2 = ltr2.value.replace('<=', '');

          /* Both can have the maximal version */
          if (
            (!tr1.length && /(>|>=)/.test(ltr2.operator)) ||
            (!tr2.length && /(>|>=)/.test(ltr1.operator)) ||
            (/(>|>=)/.test(ltr1.operator) && /(>|>=)/.test(ltr2.operator))
          ) {
            return;
          }

          if (tr1 !== tr2) {
            bad++;
          }
        })
      );

      /* It fails if all 'or' conditions are bad */
      if (bad === r1.set.length * r2.set.length) {
        throw new Error('no compatible range');
      }

      return v2;
    });
    return true;
  } catch (ex) {
    /* true if all values are equal */
    return exports.areAllEqual(versions);
  }
};

exports.useSymlinks = function() {
  switch (process.env.STARTCRAFT_SYMLINK) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return process.env.NODE_ENV !== 'production';
  }
};
