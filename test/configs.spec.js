'use strict';

const {expect} = require ('chai');


const npmEnv = 'npm_package_name';
process.env[npmEnv] = 'startcraft';

describe ('check config', function () {
  it ('#config', function () {
    const config = require ('../lib/config.js');
    console.dir (config.modules);
  });
});
