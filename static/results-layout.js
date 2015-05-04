
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// results-layout.js - Custom D3 layout for displaying data migration
//  - Requires a data matrix, the list of buckets, and the list of
//	  collapsed buckets.
//	- Internally uses an improved version of the CRUSH bucket list
//  - Outputs:
//    * List of groups (angles for SVG arcs) and their metadata
//    * List of parents (same as above)
//    * List of chords (angles for SVG chord objects)
//
// Changelog:
// ----------
// May 4th 2015 - Initial release


d3.layout.crush = function() {
	// Custom D3 layout for displaying CRUSH results
	// It is a chord-based display, but all arcs are the same size and the
	// values for a->b and b->a are in seperate chords. The first half of
	// the arcs is for input chords, the second half for outputs. This works
	// best if the arcs are given a transparency depending on their value.
	
	var layout = {},
		betterBuckets,
		matrix,
		buckets,
		chords,
		groups,
		maxvalue,
		parents,
		collapsed = [];
	
	function improveCrushBuckets() {
		// Internal function for making the list of CRUSH buckets a bit more
		// practical for displaying the graph. Entries are created for the OSDs
		// and the "cluster", and all entries are given a "parent" property.

		var newb = {},
			parents = {},
			b,
			c,
			osd;
		
		// Create now an entry for the cluster
		newb['cluster'] = {children:[]};

		for (var bname in buckets) {
			// Iterate over all the existing buckets

			// Initialize new entry
			b = newb[bname] = {};

			b.id = buckets[bname].id;
			b.type = buckets[bname].type;

			// The object 'parents' contains all the parent -> child relations that
			// couldn't be created because the child didn't exist. So if there's a
			// in here, then let's use it.
			if (parents.hasOwnProperty(bname)) {
				b.parent = parents[bname];
				delete parents[bname];
			};
			
			// Special case for root: define 'cluster' as the parent
			// (we're making this up for practical purpose)
			if (b.type == 'root') {
				b.parent = 'cluster';
				newb['cluster'].children.push({name: bname});
			}

			b.children = [];
			for (var i = 0; i < buckets[bname].item.length; i++) {
				// Iterate over the children (items) of the bucket
				c = buckets[bname].item[i];

				// Add the item to the children
				b.children.push(c);

				if (CrushUtils.isOSD(c.name)) {
					// If it's an OSD, create an entry for it
					newb[c.name] = {
						id: parseInt(c.name.slice(4)),
						type: 'osd',
						size: c.weight * 1000,
						parent: bname
					};
				} else {
					// If it's not, check if the child already has an entry. If it
					// does, update the "parent" property, else add the relation
					// to the "parents" temporary list.
					if (newb.hasOwnProperty(c.name))
						newb[c.name].parent = bname;
					else
						parents[c.name] = bname;
				};
			};
		};

		// Save it as internal variable, so we dont't have to rebuild this each time we need it
		betterBuckets = newb;
	};

	function getOrderedList() {
		// Returns an ordered list of all the OSDs that are under the node "name".
		// By default, returns all the OSDs of the cluster. 
		// Will be used later when collapsing the graph (not implemented yet)

		var list = [],
			node,
			name,
			stop;

		name = 'cluster';
		stop = [];

		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] == 'string') name = arguments[i];
			else stop = arguments[i];
		}

		if (CrushUtils.isOSD(name) || stop.indexOf(name) >= 0) return [name];

		node = betterBuckets[name];
		for (var i = 0; i < node.children.length; i++) {
			// For all children of the node, call this function recursively
			list = list.concat(getOrderedList(node.children[i].name, stop));
		};
		return list;
	};

	function prepareMetaData() {
		// Returns an ordered list of all the metadata we need to include.
		// Right now, only gives the metada of the OSDs. Later, the data will
		// depend on which parts of the graph are collapsed.

		var osdlist,
			md = [],
			e,
			name,
			osds;

		treelist = getOrderedList(collapsed);

		for (var i = 0; i < treelist.length; i++) {
			name = treelist[i];
			if (CrushUtils.isOSD(name)) {
				md.push({
					name: name,
					id: betterBuckets[name].id,
					osds: 1,
					type: betterBuckets[name].type,
					size: betterBuckets[name].size,
					parent: betterBuckets[name].parent
				});
			} else {
				md.push({
					name: name,
					id: betterBuckets[name].id,
					osds: getOrderedList(name).length,
					type: betterBuckets[name].type,
					parent: betterBuckets[name].parent
				});
			}
		}
		
		return md;
	}

	function prepareMatrix() {
		// Returns the reordered and processed data matrix.
		// Right now, only reorders the rows and columns according to how the OSDs
		// are installed in the cluster, but will later also process the data
		// according to graph collapsing.

		var list,
			osdlist,
			transfmat,
			finalmat,
			m, n,
			id, name;

		list = getOrderedList(collapsed);
		m = matrix.valueOf().length;
		n = list.length;

		// We're using matrices to reorder the OSDs. It's a very simple form of base
		// changing. It's also very easy to process the matrix for a collapsed graph
		// with this method (coming soon!)
		// Each line of the matrix reprents an index in the wheel of the graph.
		// In each line, a 1 in column N (starting from 0) means osd.N should be
		// displayed in that position. If there are several 1s in a line, the
		// values of the corresponding OSDs will be added. Matrix Magic!
		transfmat = math.zeros(n, m);

		for (var i = 0; i < n; i++) {
			name = list[i];
			osdlist = CrushUtils.isOSD(name) ? [name] : getOrderedList(name);
			for (var j = 0; j < osdlist.length; j++) {
				id = parseInt(osdlist[j].slice(4));
				transfmat.set([i, id], 1);
			};
		};

		return math.multiply(math.multiply(transfmat, matrix), transfmat.transpose());
	};

	function makeLayout() {
		var m, n,
			k,	
			mat,
			md,
			g1,
			g2,
			chord,
			index,
			max,
			prevpid,
			pindex;

		mat = prepareMatrix();
		md = prepareMetaData();
		m = matrix.valueOf().length; // Total nb of OSDs
		n = md.length;

		// Angle per OSD
		k = (2 * Math.PI) / m / 1.1;

		groups = [];
		index = 0;
		parents = [];
		parentindex = -1;
		for (var i = 0; i < n; i++) {
			groups.push({
				index: i,
				startAngle: index * k * 1.1,
				endAngle: (index + md[i].osds) * k * 1.1 - 0.1 * k,
				name: md[i].name,
				type: md[i].type,
				parent: md[i].parent,
				parentid: betterBuckets[md[i].parent].id,
				id: md[i].id,
				value_in: 0,
				value_out: 0
			});
			if (parentindex < 0 || groups[i].parentid != parents[parentindex].id) {
				parentindex++;
				parents.push({
					name: groups[i].parent,
					id: groups[i].parentid,
					startAngle: groups[i].startAngle,
					endAngle: groups[i].endAngle
				})
			} else {
				parents[parentindex].endAngle = groups[i].endAngle;
			}
			index += md[i].osds;
		};

		chords = [];
		for (var i = 0; i < n; i++) {
			for (var j = i; j < n; j++) {
				if (i != j ) {
					// We're going to ignore internal movements for now. I still
					// haven't decided how to display those…
					g1 = groups[i];
					g2 = groups[j];

					chord = {};
					if (mat.get([j,i]) > 0) {
						chord.value = mat.get([j,i]);
						chord.source = {
							index: i,
							startAngle: (g1.startAngle + g1.endAngle) / 2,
							endAngle: g1.endAngle
						};
						chord.target = {
							index: j,
							startAngle: g2.startAngle,
							endAngle: (g2.startAngle + g2.endAngle) / 2
						};
						chords.push(chord);
						g1.value_out += chord.value;
						g2.value_in += chord.value;
					};

					chord = {};
					if (mat.get([i,j]) > 0) {
						chord.value = mat.get([i,j]);
						chord.source = {
							index: j,
							startAngle: (g2.startAngle + g2.endAngle) / 2,
							endAngle: g2.endAngle
						};
						chord.target = {
							index: i,
							startAngle: g1.startAngle,
							endAngle: (g1.startAngle + g1.endAngle) / 2
						};
						chords.push(chord);
						g2.value_out += chord.value;
						g1.value_in += chord.value;
					};
				};
			};
		};

		max = 0;
		for (var i = 0; i < n; i++) {
			if (groups[i].value_in > max) {max = groups[i].value_in; maxvalue = {id: i, dir: 'in'}; };
			if (groups[i].value_out > max) {max = groups[i].value_out; maxvalue = {id: i, dir: 'out'}; };
		};
	};

	layout.transpFactor = function() {
		// This is quite an odd one… Assuming we'll set the transparency of a chord
		// to (its value) / (sum of all transfers), then we want to know by how much
		// to correct these values so that the most dense part of the graph has an
		// opacity close to one. For this, we need to know the group with the highest
		// number of transfers, how many they are and what are their sum.

		if (!maxvalue) return 1;
		var sum, nb;
		
		if (maxvalue.dir == 'in') {
			sum = groups[maxvalue.id].value_in;
			nb = 0;
			for (var i = 0; i < chords.length; i++) {
				if (chords[i].target.index == maxvalue.id) nb++;
			};
		} else {
			sum = groups[maxvalue.id].value_out;
			nb = 0;
			for (var i = 0; i < chords.length; i++) {
				if (chords[i].source.index == maxvalue.id) nb++;
			};
		}

		// Now that we know how many transfers and to how much they add on the
		// "busiest" group, we can approximate the transparency the out/inbound
		// chords would have when overlapped.
		// The trick is that transparencies don't add up: they multiply each other!
		// However the exact way depends on how the blending works. But supposing
		// transparency overlapping is like a geometric law (not exactly true) we
		// can approximate the final transparency to T^N (where T in the transparency
		// of a layer and N the number of layers). Therefore our correction factor
		// for opacity is 1 / (1 - T^N). We can approximate T as 1 - Max / Sum / N
		// where Max is the sum of transfers in the busiest groupe, Sum the total sum
		// of all transfers, and N the number of transfers in the said group.
		// It kinda works...
		return 1 / (1 - Math.pow((1 - sum / nb / math.sum(matrix)), nb));
	};

	layout.matrix = function(m) {
		if (!arguments.length) return matrix;
		matrix = m;
		if (buckets) makeLayout();
		return layout;
	};

	layout.buckets = function(b) {
		if (!arguments.length) return buckets;
		(buckets = b) && improveCrushBuckets();
		if (matrix) makeLayout();
		return layout;
	};

	layout.collapsed = function(c) {
		if (!arguments.length) return collapsed;
		collapsed = c;
		makeLayout();
		return layout;
	};

	layout.groups = function() {
		if (!groups) makeLayout();
		return groups;
	};
	
	layout.chords = function() {
		if (!chords) makeLayout();
		return chords;
	};
	
	layout.parents = function() {
		if (!parents) makeLayout();
		return parents;
	};
	
	layout.betterBuckets = function() {
		// Allows access to the betterBuckets list. Only for debugging purpose
		return betterBuckets;
	};


	return layout;
};
