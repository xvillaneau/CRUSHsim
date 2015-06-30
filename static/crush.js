
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crushmap.js - Javascript objet for CRUSH map handling
//

crush = {};

crush.crushmap = function() {
	// JavaScript "Class" for managing a CRUSH map.
	// Stores every information in subclasses, then allows
	// import and export in CRUSH text format, transparently

	var map = {},
		reweights = {},
		buckets = crush.buckets(),
		devices = crush.devices(),
		rules = crush.rules(),
		tunables = crush.tunables(),
		types = crush.types();


	map.parse = function(input) {
		// Takes a raw text map and fills in the class from it

		var list = input.split('\n'),
			line, block, output,
			inBlock = '';

		for (var i = 0; i < list.length; i++) {

			// Removes blanks and comments, keeping only the useful part
			line = list[i]
				.replace(RegExp('^[ \t]*'),'')
				.replace(RegExp('[ \t]*#.*'),'');
			l = line.split(' ');

			// Skip if line is empty
			if (! line) continue;

			else if (line == '}') {
				// Get out of rule/bucket mode
				if (inBlock == 'rule') output = rules.parse(block); // Only returns something if it fails
				else if (inBlock == 'bucket') output = buckets.parse(block, types);
				inBlock = '';
			}

			else if (inBlock) {block.push(line); continue;}

			else if (line.startsWith('device ')) output = devices.parse(line);
			else if (line.startsWith('tunable ')) output = tunables.parse(line);
			else if (line.startsWith('type ')) output = types.parse(line);

			else if (line.startsWith('rule ')) {block = [line]; inBlock = 'rule'}
			else {block = [line]; inBlock = 'bucket'}

			if (output) return output; // Parsing only returns something if it fails
		}
	}

	map.textMap = function(m){
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
		return out;
	};

	map.init = function() {
		buckets.init();
		devices.init();
		rules.init();
		tunables.init();
		types.init();
	}

	map.buckets = (function(){return buckets;})()
	map.devices = (function(){return devices;})()
	map.rules = (function(){return rules;})()
	map.tunables = (function(){return tunables;})()
	map.types = (function(){return types;})()

	map.simulate = function(ruleset, size, pgs, callback) {
		if (arguments.length < 3 || arguments.length > 4) return false;

		if (arguments.length == 3) {callback = pgs; pgs = null;}
		if (typeof callback != 'function') return false;

		if (isNaN(parseInt(size))) return false;

		if (isNaN(parseInt(ruleset))) return false;
		var rule = rules.getByRuleset(ruleset)
		if (typeof rule == 'undefined') return false;

		var url = '/api/simulate'
			+ '?rule=' + rule.rule_id
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

	map.bucketsInRule = function(ruleset) {
		if (arguments.length != 1) return false;
		var res = [],
				rule = rules.getByRuleset(ruleset);
		for (var s = 0; s < rule.steps.length; s++) {
			if (rule.steps[s].op == 'take')
				res = res.concat([rule.steps[s].item_name])
				      .concat(buckets.children(rule.steps[s].item_name));
		};
		// Remove duplicate elements in res (Thank-you Stack Overflow!)
		res = res.reduce(function(accum, current) {
				if (accum.indexOf(current) < 0) accum.push(current);
				return accum;
			}, []);
		return res;
	}

	return map;
};

// vim: set ts=4 sw=4 autoindent:
