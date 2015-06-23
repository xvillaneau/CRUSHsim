
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// d3-crushmap.js - D3 layout for a more comprehensive CRUSH display
//

d3.layout.crushmap = function() {
	var layout = {},
		data = [];

	layout.importMap = function(map) {
		var levels = map.jsonMap().types;
		var ltod = {};
		for (var i = 0; i < levels.length; i++) {
			ltod[levels[i].name] = i;
			data.push({'name': ltod[i], 'items':[]});
		}


		
	};	

	return layout;
};

// vim: set ts=4 sw=4 autoindent:
