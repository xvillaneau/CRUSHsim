
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crushmap.js - Javascript objet for CRUSH map handling
//

crushsim = {};

crushsim.crushmap = function() {
	// JavaScript "Class" for managing a CRUSH map.
	// Stores every information in subclasses, then allows
	// import and export in CRUSH text format, transparently

	var map = {},
		reweights = {},
		buckets,
		devices,
		rules,
		tunables,
		types;


	function bucketsConstructor() {
		// Class for buckets
		var bucketsObj = {},
			bList = [],
			byId = {},
			byName = {};

		bucketsObj.parse = function(lines) {
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
	buckets = bucketsConstructor();


	function devsConstructor() {
		// "Class" for managing devices in a map

		// Currently it doesn't make any difference between the id and
		// the name of a device, since it's always 'osd.<id>'.
		// Maybe this is a mistake... If it does cause you trouble,
		// please send me some feedback.

		var devsObj = {},
			devs = [];

		devsObj.parse = function(line) {
			var l = line.split(' ');
			if (! isNaN(parseInt(l[1]))) devs.push(parseInt(l[1]));
		};

		devsObj.dump = function() {
			var output = '';
			for (var i = 0; i < devs.length; i++)
				output += 'device ' + devs[i] + ' osd.' + devs[i] + '\n' ;
			return output;
		};

		devsObj.json = function() {
			var output = [];
			for (var i = 0; i < devs.length; i++)
				output.push({'id': devs[i], 'name': 'osd.'+devs[i]});
			return output;
		};

		devsObj.rawList = function() {
			return devs;
		};

		devsObj.init = function() {
			devs = [];
		};

		return devsObj;
	};
	devices = devsConstructor();


	function rulesConstructor() {
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
	rules = rulesConstructor();

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
	tunables = tunsConstructor();


	// Internal object for types management
	function typesConstructor() {
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
			byName = {
				'osd': 0,
				'host': 1,
				'chassis': 2,
				'rack': 3,
				'row': 4,
				'pdu': 5,
				'pod': 6,
				'room': 7,
				'datacenter': 8,
				'region': 9,
				'root': 10
			};
		};

		return typesObj;
	};
	types = typesConstructor();



	function parseTextMap(input) {
		var list = input.split('\n'),
			line, block,
			inBlock = '';

		for (var i = 0; i < list.length; i++) {
			line = list[i]
				.replace(RegExp('^[ \t]*'),'')
				.replace(RegExp('[ \t]*#.*'),'');
			l = line.split(' ');

			if (! line) continue;

			else if (line == '}') {
				// Get out of rule/bucket mode
				if (inBlock == 'rule') rules.parse(block);
				else if (inBlock == 'bucket') buckets.parse(block);
				inBlock = '';
				continue;
			}

			else if (inBlock) {block.push(line); continue;}

			else if (line.startsWith('device ')) devices.parse(line);
			else if (line.startsWith('tunable ')) tunables.parse(line);
			else if (line.startsWith('type ')) types.parse(line);
			else if (line.startsWith('rule ')) {block = [line]; inBlock = 'rule'}
			else {block = [line]; inBlock = 'bucket'}
		}
	};

	map.textMap = function(m){
		if (!arguments.length) {
			return '# begin crush map\n'
				+ tunables.dump()
				+ '\n# devices\n'
				+ devices.dump()
				+ '\n# types\n'
				+ types.dump()
				+ '\n# buckets\n'
				+ buckets.dump()
				+ '\n# rules\n'
				+ rules.dump()
				+ '\n# end crush map';
		}
		else parseTextMap(m);
	};

	map.jsonMap = function(){
		return {
			'buckets': buckets.json(),
			'devices': devices.json(),
			'rules': rules.json(),
			'tunables': tunables.json(),
			'types': types.json()
		};
	};

	map.graphData = function() {
		var out = {'nodes': [], 'links': []},
			bList = buckets.json(),
			bIndex = {};

		function pushNode(obj) {
			bIndex[obj.id] = out.nodes.length;
			out.nodes.push(obj);
		};

		function addLink(sourceId, targetId) {
			var source, target;
			source = bIndex[sourceId];
			target = bIndex[targetId];
			if (typeof source == 'undefined' || typeof target == 'undefined') return false;
			out.links.push({'source': source, 'target': target, 'value': 0});
			return true;
		};

		for (var i = 0; i < bList.length; i++) {
			var b = bList[i];

			pushNode({
				'name': b.name,
				'id': b.id,
				'type_id': b.type_id,
				'type': b.type_name
			});

			for (var j = 0; j < b.items.length; j++) {
				var item = b.items[j];

				if (item.id >= 0 && typeof bIndex[item.id] == 'undefined') {
					pushNode({
						'name': 'osd.'+item.id,
						'id': item.id,
						'type_id': 0, // Assuming type 0 is OSD, might not be the case ?
						'type': 'osd' // Same remark, making assumptions here
					});
				}
				addLink(b.id, item.id);
			};
		};
		out.types = types.json();
		return out;
	};

	map.init = function() {
		buckets.init();
		devices.init();
		rules.init();
		tunables.init();
		types.init();
	}

	map.buckets = (function(){
		return buckets;
	})()

	map.devices = (function(){
		return devices;
	})()

	map.rules = (function(){
		return rules;
	})()

	map.tunables = (function(){
		return tunables;
	})()

	map.types = (function(){
		return types;
	})()

	map.simulate = function(rule, size, pgs, callback) {
		if (arguments.length < 3 || arguments.length > 4) return false;

		if (arguments.length == 3) {callback = pgs; pgs = null;}
		if (typeof callback != 'function') return false;

		if (isNaN(parseInt(size))) return false;

		if (typeof rule == 'string') {
			var r = rules.getByName(rule);
			if (typeof r == 'undefined') return false;
			rule = r.ruleset;
		}
		else if (isNaN(parseInt(rule))) return false;
		else if (typeof rules.getByRuleset(rule) == 'undefined') return false;

		var url = '/api/simulate'
			+ '?rule=' + rule
			+ '&size=' + size;

		if (pgs != null && !isNaN(parseInt(pgs)))
			url += '&pgs=' + pgs;

		for (var osd in reweights)
			url += '&osd.' + osd + '=' + reweights[osd];

		$.ajax({
			'url': url,
			'contentType': 'text/plain',
			'data': this.textMap(),
			'method': 'PUT',
			'success': callback
		});
	};

	map.suggestPgs = function(ruleset, size) {
		if (!arguments.length || arguments.lenght > 2) return false;
		if (arguments.length == 1) size = rules.getByRuleset(ruleset).max_size;

		var out = 1;
		while (out < (devices.json().length * 100 / size)) out = out * 2;
		return out;
	}

	map.osdReweight = function(osd, weight) {
		// Will temporarily reweight an OSD as in "ceph osd reweight"
		// This does NOT change the CRUSH map

		// Few test to check if the arguments are good
		if (! osd in devices.rawList()) return false;
		if (typeof weight != 'number') return false;
		if (weight < 0 || weight > 1) return false;

		// A weight of 1 means the OSD is in
		if (weight == 1 && reweights.hasOwnProperty(osd)) delete reweights[osd];
		// Else, store the wanted weight
		else reweights[osd] = weight;

		return true;
	};

	map.osdDown = function(osd) {
		// Few test to check if the arguments are good
		if (! osd in devices.rawList()) return false;
		this.osdReweight(osd, 0);
		return true;
	};

	return map;
};

// vim: set ts=4 sw=4 autoindent:
