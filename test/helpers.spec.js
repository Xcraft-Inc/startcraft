'use strict';

const {expect} = require ('chai');

const helpers = require ('../lib/helpers.js');


describe ('check helpers', function () {
  const def1 = {
    os: [ 'win32' ]
  };
  const def2 = {
    os: [ '!darwin' ]
  };
  const def3 = {};
  const def4 = {
    os: []
  };
  const def5 = {
    os: [ 'win32', 'linux' ]
  };

  it ('#isOsCompatible', function () {
    expect (helpers.isOsCompatible (def1, 'win32')).to.be.true;
    expect (helpers.isOsCompatible (def1, 'linux')).to.be.false;
    expect (helpers.isOsCompatible (def2, 'darwin')).to.be.false;
    expect (helpers.isOsCompatible (def2, 'sunos')).to.be.true;
    expect (helpers.isOsCompatible (def3, 'linux')).to.be.true;
    expect (helpers.isOsCompatible (def4, 'win32')).to.be.true;
    expect (helpers.isOsCompatible (def5, 'darwin')).to.be.false;
    expect (helpers.isOsCompatible (def5, 'linux')).to.be.true;
  });
});
