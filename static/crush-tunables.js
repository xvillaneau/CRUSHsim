
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-tunables.js - Javascript objet for CRUSH map tunables
//

function tunsConstructor() {
  var tunsObj = {},
    tuns = {};

  tunsObj.parse = function(line) {
    var l = line.split(' ');
    if (isNaN(parseInt(l[2]))) tuns[l[1]] = l[2];
    else tuns[l[1]] = parseInt(l[2]);
  };

  tunsObj.dump = function() {
    var output = '';
    for (var k in tuns)
      output += 'tunable ' + k + ' ' + tuns[k] + '\n';
    return output;
  };

  tunsObj.json = function() {
    return tuns;
  };

  tunsObj.init = function() {
    tuns = {};
    // I think these are the default settings. It might depend on Ceph's version
    tuns.choose_local_tries = 0;
    tuns.choose_local_fallback_tries = 0;
    tuns.choose_total_tries = 50;
    tuns.chooseleaf_descend_once = 1;
  };

  return tunsObj;
};
