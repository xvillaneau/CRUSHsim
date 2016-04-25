
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-utils.js - Defines the CrushUtils object, which offer a few
// useful CRUSH-related methods such as:
//  - isOSD: simple test to see if a string is like 'osd.XX' (used a lot)
//  - mergeBuckets: performs a basic merge of two bucket lists
//
// Changelog:
// ----------
// May 4th 2015 - Initial release


!function(){ 
	
	var CrushUtils = {};
	
	function isOSD(s) {return s.substring(0,4) == 'osd.';};

	function arrayUnique(array) {
		var a = array.concat();
		for(var i=0; i<a.length; ++i) {
			for(var j=i+1; j<a.length; ++j) {
				if(a[i] === a[j]) a.splice(j--, 1);
			}
		}
		return a;
	};

	function makeTree(buckets) {
		// Converts a list of buckets into a (more practical) hierarchy

		var recursiveTreeBuild = function(node, buckets) {
			// Internal recursive function for building a tree from a bucket list

			var output = {};
			var b = buckets[node];

			// Set the basic properties of the node
			output.name = node;
			output.id = b.id;
			output.type = b.type;
			output.children = [];

			for (var i in b.item) {
				var c = b.item[i];
				if (isOSD(c.name)) {
					// If the child is an OSD
					output.children.push({
						name: c.name,
						type: 'osd',
						id: parseInt(c.name.substring(4)),
						size: c.weight * 1000
					});
				} else {
					// Else go further in recursion
					output.children.push(recursiveTreeBuild(c.name, buckets));
				};
			}

			return output;
		};

		var tree = {name: 'cluster', children:[]};

		// Find the roots of the topology
		var roots = [];
		for (var b in buckets) {
			// Get roots of first map
			if (buckets[b].type == 'root') {
				roots.push(b);
			};
		};

		// Now let's finally use this function
		for (var i in roots) {
			tree.children.push(recursiveTreeBuild(roots[i], buckets));
		};

		return tree;
	};

	function mergeCrushTrees(t1, t2) {
		
		var mergeAttributes = function(t1, t2) {
			var attr = ['name','id','type', 'size'];
			var output = {};
			for (var i in attr) {
				var a = attr[i];
				if (t2.hasOwnProperty(a)) {
					// If the second tree (the more "recent" one hopefully) has a property,
					// this one is chosen. We don't even care to know if the first tree has it.
					output[a] = t2[a];
				} else if (t1.hasOwnProperty(a)) {
					// Only the first tree has this property. In doubt, keep it.
					output[a] = t1[a];
				};
			}
			return output;
		}

		var mergeChildren = function(t1, t2) {
			var c1 = t1.children;
			var c2 = t2.children;

			var ids = {};
			var numIds = [];

			for (var i in c1) {
				var id = c1[i].id.toString();
				ids[id] = {in1: i};
				numIds.push(c1[i].id);
			};
			for (var i in c2) {
				var id = c2[i].id.toString();
				if (ids.hasOwnProperty(id)) {ids[id].in2 = i;}
				else {ids[id] = {in2: i}; numIds.push(c2[i].id);};
			};

			numIds.sort();
			var output = [];

			for (var i in numIds) {
				id = numIds[i].toString();
				if (! ids[id].hasOwnProperty('in1')) {
					output.push(c2[ids[id].in2]);
				} else if (! ids[id].hasOwnProperty('in2')) {
					output.push(c1[ids[id].in1]);
				} else {
					output.push(mergeCrushTrees(c1[ids[id].in1],c2[ids[id].in2]));
				};
			};

			return output;
		};

		var output = mergeAttributes(t1, t2);
		output.children = mergeChildren(t1, t2);
		return output;
	};

	function mergeBuckets(m1, m2) {
			
		var map={};

		function recursiveMerge(nodename) {
			var node = map[nodename] = {};
			
			// Merge bucket attributes
			var attr = ['name','id','type', 'weight'];
			for (var i = 0; i < attr.length; i++) {
				var a = attr[i];
				if (m2.hasOwnProperty(nodename) && m2[nodename].hasOwnProperty(a)) {
					node[a] = m2[nodename][a];
				} else if (m1.hasOwnProperty(nodename) && m1[nodename].hasOwnProperty(a)) {
					node[a] = m1[nodename][a];
				};
			};

			var children = [];
			var osd_weights = {};
			// Merge bucket items
			if (m1.hasOwnProperty(nodename)) {
				for (var i = 0; i < m1[nodename].item.length; i++) {
					var name = m1[nodename].item[i].name; 
					children.push(name);
					if (isOSD(name)) osd_weights[name] = m1[nodename].item[i].weight;
				};
			};
			if (m2.hasOwnProperty(nodename)) {
				for (var i = 0; i < m2[nodename].item.length; i++) {
					var name = m2[nodename].item[i].name; 
					children.push(name);
					if (isOSD(name)) osd_weights[name] = m2[nodename].item[i].weight;
				};
			};
			children = arrayUnique(children);

			children.sort(function(a,b) {
				// We want this list to be sorted in a specific way

				// Both elements are OSDs : sort by numeric ID
				if (isOSD(a) && isOSD(b)) {
					return parseInt(a.substring(4)) - parseInt(b.substring(4));

				// If only one of the names is an OSD, OSDs are before
				// (This shouldn't happen, but you never know)
				} else if (isOSD(a) && ! isOSD(b)) {
					return -1;
				} else if (isOSD(b) && ! isOSD(a)) {
					return 1;

				// Not OSDs : sort by name
				} else {
					return (a < b ? -1 : 1);
				};
			});
			
			node.item = []
			for (var i = 0; i < children.length; i++) {
				var name = children[i];
				if (isOSD(name)) {
					var osd = {};
					osd.name = name;
					osd.weight = osd_weights[name];
					node.item.push(osd);
				} else {
					node.item.push({name: name})
					recursiveMerge(name);
				};	
			};
		};

		// Find the roots of the topology
		var roots = [];
		for (var b in m1) {
			if (m1[b].type == 'root') roots.push(b);
		};
		for (var b in m2) {
			if (m2[b].type == 'root') roots.push(b);
		};
		roots = arrayUnique(roots);

		// Now let's finally use this function
		for (var i = 0; i < roots.length; i++) {
			recursiveMerge(roots[i]);
		};

		return map;
	};

	CrushUtils.isOSD = isOSD;
	CrushUtils.mergeBuckets = mergeBuckets;
	
	if (typeof define === "function" && define.amd) define(CrushUtils);
	else if (typeof module === "object" && module.exports) module.exports = CrushUtils;

	this.CrushUtils = CrushUtils;
}();



