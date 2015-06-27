
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-rules.js - Javascript objet for CRUSH map rules
//

crush.rules = function() {
  var rulesObj = {},
    rulesList = [],
    byRuleset = {},
    byName = {};

  rulesObj.parse = function(lines) {
    var obj = {'steps': []};

    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].split(' ');

      if (i == 0) {
        obj.rule_name = l[1];
        continue;
      }

      if (l[0] == 'type') {
        if (l[1] == 'replicated') obj.type = 1;
        else if (l[1] == 'erasure') obj.type = 3;
        // TODO: other types
      }
      else if (l[0] == 'step') {
        if (l[1] == 'take')
          obj.steps.push({'op': 'take', 'item_name': l[2]});
        else if (l[1] == 'emit')
          obj.steps.push({'op': 'emit'});
        else if (l[1] == 'set_chooseleaf_tries')
          obj.steps.push({'op': 'set_chooseleaf_tries', 'num': parseInt(l[2])});
        else // Should be choose or chooseleaf, with firstn or indep
          obj.steps.push({'op': l[1]+'_'+l[2], 'num': parseInt(l[3]), 'type': l[5]});
          // TODO: There are definitely other cases
      }
      else obj[l[0]] = parseInt(l[1]); // Should only be ruleset, max_size and min_size
      obj.rule_id = rulesList.length;
    }
    byRuleset[obj.ruleset] = rulesList.length;
    byName[obj.rule_name] = rulesList.length;
    rulesList.push(obj);
  };

  rulesObj.dump = function() {
    var output = '';

    for (var i = 0; i < rulesList.length; i++) {
      var r = rulesList[i];

      output += 'rule ' + r.rule_name + ' {\n';

      output += '\truleset ' + r.ruleset + '\n';

      output += '\ttype ';
      if (r.type == 1) output += 'replicated';
      else if (r.type == 3) output += 'erasure';
      output += '\n';

      output += '\tmin_size ' + r.min_size + '\n';
      output += '\tmax_size ' + r.max_size + '\n';

      for (var j = 0; j < r.steps.length; j++) {
        var s = r.steps[j];

        output += '\tstep ';
        if (s.op == 'emit') output += 'emit';
        else if (s.op == 'take') output += 'take ' + s.item_name;
        else if (s.op == 'set_chooseleaf_tries') output += s.op + ' ' + s.num;
        else {
          output += s.op.split('_')[0] + ' ' + s.op.split('_')[1] + ' ';
          output += s.num + ' type ' + s.type;
        }
        output += '\n';
      };

      output += '}\n';
    };

    return output;
  };

  rulesObj.json = function() {
    return rulesList;
  };

  rulesObj.getByName = function(name) {
    if (byName.hasOwnProperty(name)) {
      return rulesList[byName[name]];
    };
  };

  rulesObj.getByRuleset = function(ruleset) {
    if (byRuleset.hasOwnProperty(ruleset)) {
      return rulesList[byRuleset[ruleset]];
    };
  };

  rulesObj.init = function() {
    rulesList = [{
      'name': 'replicated_ruleset',
      'ruleset': 0,
      'type': 1,
      'min_size': 1,
      'max_size': 10,
      'steps': [
        {'op': 'take', 'item': 0, 'item_name': 'default'},
        {'op': 'chooseleaf_firstn', 'num': 0, 'type': 'host'},
        {'op': 'emit'}
      ]
    }];
    byName = {'replicated_ruleset': 0};
    byRuleset = {0: 0};
  };

  return rulesObj;
};
