'use strict';

const {expect} = require ('chai');


const npmEnv = 'npm_package_name';
process.env[npmEnv] = 'startcraft';

describe ('check config', function () {
  it ('#modules', function () {
    const {modules} = require ('../lib/config.js');
    expect (modules[0]).to.be.eql ({
      def: {},
      src: null,
      dst: null
    });
    expect (modules[1].def.name).to.be.eql ('test-module');
    expect (modules[1].src).to.match (/.*test[/\\]test-module/);
    expect (modules[1].dst).to.match (/.*node_modules[/\\]test-module/);
  });
});
