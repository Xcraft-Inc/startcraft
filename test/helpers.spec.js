'use strict';
/* jshint -W030 */

const {expect} = require('chai');

const helpers = require('../lib/helpers.js');

describe('check helpers', function() {
  const def1 = {
    os: ['win32'],
  };
  const def2 = {
    os: ['!darwin'],
  };
  const def3 = {};
  const def4 = {
    os: [],
  };
  const def5 = {
    os: ['win32', 'linux'],
  };

  it('#isOsCompatible', function() {
    expect(helpers.isOsCompatible(def1, 'win32')).to.be.true;
    expect(helpers.isOsCompatible(def1, 'linux')).to.be.false;
    expect(helpers.isOsCompatible(def2, 'darwin')).to.be.false;
    expect(helpers.isOsCompatible(def2, 'sunos')).to.be.true;
    expect(helpers.isOsCompatible(def3, 'linux')).to.be.true;
    expect(helpers.isOsCompatible(def4, 'win32')).to.be.true;
    expect(helpers.isOsCompatible(def5, 'darwin')).to.be.false;
    expect(helpers.isOsCompatible(def5, 'linux')).to.be.true;
  });

  it('#isSemverSatisfies', function() {
    const ranges = [
      [true, ['^1.0.0', '^1.9.2']], // max: x.x.x, x.x.x
      [false, ['^1.5.0', '^2.1.2']], // max: 1.x.x, 2.x.x
      [false, ['~1.5.0', '~1.6.0']], // max: 1.5.x, 1.6.x
      [true, ['~1.5.0', '<1.6']], // max: 1.5.x, 1.5.x
      [false, ['1.1.0', '^1.1.0']], // max: 1.1.0, 1.x.x
      [true, ['1.0.0 - 2.0.0', '>1.1.0 <=2.0.0']], // max: 2.0.0, 2.0.0
      [true, ['2.0.0', '<=2.0.0']], // max: 2.0.0, 2.0.0
      [false, ['2.0.0', '<2.0.0']], // max: 2.0.0, 1.x.x
      [true, ['*', '>5']], // max: x.x.x, x.x.x
      [false, ['*', '<5']], // max: x.x.x, 4.x.x
      [true, ['>1.1.1', '>1.1.2']], // max: x.x.x, x.x.x
      [true, ['^1.1.1', '^1.9.2', '>1.0.0 <2']], // max: 1.x.x, 1.x.x, 1.x.x
      [true, ['3.1.1 || <=2.1.1', '2.1.1']], // max: (3.1.1 || 2.1.1), 2.1.1
      [true, ['3.1.1 || <=2.1.1', '>4 || 2.1.1']], // max: (3.1.1 || 2.1.1), (x.x.x || 2.1.1)
      [false, ['a', 'b']],
      [true, ['a', 'a']],
    ];

    ranges.forEach(range =>
      expect(helpers.isSemverSatisfies(range[1])).to.be.eql(range[0])
    );
  });
});
