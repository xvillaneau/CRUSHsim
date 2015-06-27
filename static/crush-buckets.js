
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-buckets.js - Javascript objet for CRUSH map buckets
//

crush.buckets = function() {
  // Class for buckets
  var bucketsObj = {},
    bList = [],
    byId = {},
    byName = {};

  bucketsObj.parse = function(lines, types) {
    // Given the lines corresponding to a bucket in the CRUSH map
    // text format, will parse and import the data.
    // TODO: It seems it becomes complicated if the alg is not 'straw'
    // I'll fix that later
    var obj = {'items': [], 'weight': 0};

    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].split(' ');

      if (i == 0) {
        // The first line is special and holds the name and the type
        obj.name = l[1];
        obj.type_name = l[0];
        obj.type_id = types.byName(l[0]);
        continue;
      };

      if (l[0] == 'hash') {
        // For some reasons, conversion is necessary
        if (l[1] == '0') obj.hash = 'rjenkins1';
        // TODO: other hashs
      }
      else if (l[0] == 'item') {
        var item = {}
        if (l[1].startsWith('osd.')) {
          // If the item is an OSD, get its weight
          item.weight = Math.floor(parseFloat(l[3]) * 0x10000);
          item.id = parseInt(l[1].slice(4));
        } else {
          if (typeof byName[l[1]] == 'undefined') return false;
          item.id = bList[byName[l[1]]].id;
          item.weight = bList[byId[item.id]].weight
        }
        obj.weight += item.weight;
        item.pos = obj.items.length;
        obj.items.push(item)
      }
      else if (l[0] == 'id') obj.id = parseInt(l[1]);
      else if (l[0] == '}') continue; // Shouldn't happen, but just in case
      else obj[l[0]] = l[1];
    }

    byId[obj.id] = bList.length;
    byName[obj.name] = bList.length;
    bList.push(obj);

    return true;
  };

  bucketsObj.dump = function() {
    var output = '';
    for (var i = 0; i < bList.length; i++) {
      var b = bList[i];

      output += b.type_name + ' ' + b.name + ' {\n';

      output += '\tid ' + b.id + '\t\t# do not change unnecessarily\n';

      output += '\t# weight ' + (b.weight / 0x10000).toFixed(3) + '\n';

      output += '\talg ' + b.alg + '\n';

      output += '\thash ';
      if (b.hash == "rjenkins1") output += '0';
      output += '\t# rjenkins1\n';

      for (var j = 0; j < b.items.length; j++) {
        var it = b.items[j];

        output += '\titem ';
        if (it.id >= 0) output += 'osd.' + it.id;
        else output += bList[byId[it.id]].name;
        output += ' weight ' + (it.weight / 0x10000).toFixed(3) + '\n'
      };

      output += '}\n';
    };

    return output;
  };

  bucketsObj.json = function() {
    return bList;
  };

  bucketsObj.init = function() {
    bList = [{
      'id': -1,
      'name': 'default',
      'type_name': 'root',
      'type_id': 10,
      'alg': 'straw',
      'hash': 'rjenkins1',
      'weight': 0,
      'items': []
    }];
    byId = {}; byId[-1] = 0;
    byName = {'default': 0};
  };

  return bucketsObj;
};
