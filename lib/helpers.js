'use strict';


exports.isOsCompatible = function (pkgDef, platform) {
  let isCompatible = true;

  if (pkgDef.hasOwnProperty ('os') && pkgDef.os.length > 0) {
    isCompatible = pkgDef.os.some ((os) => {
      if (os === platform) {
        return true;
      }
      if (/^!/.test (os) && os !== `!${platform}`) {
        return true;
      }
      return false;
    });
  }

  return isCompatible;
};
