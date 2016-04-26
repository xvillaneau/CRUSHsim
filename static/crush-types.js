
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-types.js - Javascript objet for CRUSH map types
//

crush.types = function() {
  var typesObj = {},
    byId = {},
    byName = {};

  typesObj.parse = function(line) {
    var l = line.split(' ');
    byId[parseInt(l[1])] = l[2];
    byName[l[2]] = parseInt(l[1]);
  };

  typesObj.byId = function(id) {
    if (! arguments.length) return byId;
    return byId[id];
  };

  typesObj.byName = function(name) {
    if (! arguments.length) return byName;
    return byName[name];
  };

  typesObj.dump = function() {
    var output = '';
    for (var k in byId)
      output += 'type ' + k + ' ' + byId[k] + '\n';
    return output;
  };

  typesObj.json = function() {
    var output = [];
    for (var k in byId) output.push({'id_type': k, 'name': byId[k]});
    return output;
  };

  typesObj.init = function() {
    byId = {
      0: 'osd',
      1: 'host',
      2: 'chassis',
      3: 'rack',
      4: 'row',
      5: 'pdu',
      6: 'pod',
      7: 'room',
      8: 'datacenter',
      9: 'region',
      10: 'root'
    };
    byName = {};
    for (var i in byId) byName[byId[i]] = i;
  };

  return typesObj;
};
