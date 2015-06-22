
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// onepageapp.js - First draft for the CRUSHsim one page application
//

var apph, appw;

$(document).ready(function(){
	apph = $(window).height()
	appw = $(window).width()
	// Fixes the size of the entire page
	// TODO: This is awful and there's certainly a better way to do it
	$('html').css('width', $(window).width());
	$('html').css('height', $(window).height());

	
});

var crushsim = {};

crushsim.map = function(){
	var map = {},
		textMap,
		jsonMap;
	
	function textMapToJson(){
		var list = textMap.split('\n'),
			l,
			inrule = '',
			inbucket = '',
			rule,
			line;

		jsonMap = {
			tunables: {},
			types: {},
			devices: [],
			buckets: {},
			rules: {}
		}

		for (var i = 0; i < list.length; i++) {
			line = list[i]
				.replace(RegExp('^[ \t]*'),'')
				.replace(RegExp('[ \t]*#.*'),'');
			l = line.split(' ');

			if (line == '') continue;

			else if (line == '}') {
				// Get out of rule/bucket mode
				if (inrule) jsonMap.rules[parseInt(rule.ruleset)] = rule;
				inrule = '';
				inbucket = '';
				continue;
			}

			else if (inrule) {
				// Rule mode
				if (l[0] == 'step') rule.step.push(line.slice(5))
				else rule[l[0]] = line.slice(l[0].length + 1);
			}

			else if (inbucket) {
				// Bucket mode
				if (l[0] = 'item') {
					var item = {};
					item.name = l[1];
					item.weight = parseFloat(l[3]);
					jsonMap.buckets[inbucket].item.push(item);
				}
				else if (l[0] == 'id') jsonMap.buckets[inbucket].id = parseInt(l[1]);
				else jsonMap.buckets[inbucket][l[0]] = l[1];
			}
			
			else if (line.startsWith('tunable ')) {
				// Tunable declaration
				jsonMap.tunables[l[1]] = l[2];
			}

			else if (line.startsWith('type' )) {
				// Type declaration
				jsonMap.types[parseInt(l[1])] = l[2];
			}

			else if (line.startsWith('device ')) {
				// OSD declaration
				jsonMap.devices.push(parseInt(l[1]));
			}

			else if (line.startsWith('rule ')) {
				// Rule start
				inrule = l[1]
				rule = {}
				rule.name = inrule
				rule.step = [] // Must be an array to stay ORDERED
			}

			else {
				// It should be a bucket... I hope
				inbucket = l[1];
				jsonMap.buckets[inbucket] = {};
				jsonMap.buckets[inbucket].type = l[0];
				jsonMap.buckets[inbucket].item = [];
			}
		}
	};

	map.textMap = function(m){
		if (!arguments.length) return textMap;
		textMap = m;
		textMapToJson();
	};

	map.jsonMap = function(){
		return jsonMap;
	};
	return map;
};

// vim: set ts=4 sw=4 autoindent:
