
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// results-graph.js - Displays the graph of transfers in a cluster from
// the data matrix and the list of buckets, using D3.js
//  - Uses the layout defined in results-layout.js
//  - The actual graph drawing is in a separate function since it will
//    be called each time a section is collapsed or expanded
//
// Changelog:
// ----------
// May 4th 2015 - Initial release


function displayResultsGraph(matrix, buckets) {
	// From a data matrix and a few bits of metadata, build the Chord graph
	// This graph is heavily inspired (well, copied) from Mike Bostock's 
	// "Uber Rides by Neighborhood" graph: http://bost.ocks.org/mike/uberdata/

	// Prepare the graph size parameters
	// Obviously, this works best when the document is fully loaded
	var canvasWidth = $('#results-graph').innerWidth(),
		innerRadius = canvasWidth * .41,
		wheelWidth = innerRadius * 0.1,
		wheelSpace = wheelWidth / 6;

	// Define the SVG element itself
	var svg = d3.select("#results-graph").append("svg")
		.attr("width", canvasWidth)
		.attr("height", canvasWidth)
	  .append("g")
		.attr("id", "circle")
		.attr("transform", "translate(" + canvasWidth / 2 + "," + canvasWidth / 2 + ")");

	var fill = d3.scale.category20c();

	var layout = d3.layout.crush()
		.matrix(matrix)
		.buckets(buckets);

	var collapsed = [];
	drawGraph();

	function drawGraph() {
		
		var groups, groupPaths, groupText,
			chords,
			parents, parentPaths, parentText;

		layout.collapsed(collapsed);

		// Reset the graph
		svg.text('');
		
		// Invisible circle (see CSS) so the hover is cleaner
		svg.append("circle")
			.attr("r", innerRadius + 2 * wheelWidth + wheelSpace);


		// Bucket groups
		// =============

		groups = svg.selectAll(".group")
			.data(layout.groups)
		  .enter().append("g")
			.attr("class","group");

		groups.style("cursor", function(d) {return ((d.type == 'osd') ? 'default' : 'pointer');})
			.on("mouseover", groupsMouseover)
			.on("click", function(d){
				if (d.type != 'osd') {
					var i = collapsed.indexOf(d.name);
					collapsed = collapsed.slice(0,i).concat(collapsed.slice(i+1));
					drawGraph();
				}
			});

		function groupsMouseover(d, i) {
			chords.classed("chord-hide", function(p) {
				return p.target.index != i && p.source.index != i
			});
			chords.classed("chord-in", function(p) { return p.source.index != i });
			chords.classed("chord-out", function(p) { return p.target.index != i });
		};
		
		// Basic mouseover label for groups
		groups.append("title").text(function(d) {
			var text = d.name + '\n' + 'In: ' + d.value_in + '  Out: ' + d.value_out;
			if (d.type != 'osd') text = text + "\nClick to expand";
			return text;
		});

		groupPaths = groups.append("path")
			.attr("id", function(d, i) { return "group" + i; })
			.attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(innerRadius + wheelWidth))
			.style("fill", function(d) { return fill(d.parentid)});

		// Add a text label.
		groupText = groups.append("text")
			.attr("x", 5)
			.attr("dy", wheelWidth - 5)
			.style("fill", "white");

		groupText.append("textPath")
			.attr("xlink:href", function(d, i) { return "#group" + i; })
			.text(function(d) { return d.name });

		// Remove the labels that don't fit
		groupText.filter(function(d, i) {
				var avail = groupPaths[0][i].getTotalLength() / 2 - wheelWidth;
				return avail < this.getComputedTextLength(); 
			})
			.remove();


		// Parent groups
		// =============

		var parents = svg.selectAll(".parent")
			.data(layout.parents)
		  .enter().append("g")
			.attr("class", "parent")
			.style("cursor", "pointer")
			.on('click', function(d){ 
				if(d.name != 'cluster'){
					collapsed.push(d.name);
					drawGraph();
				}
			});

		var parentPaths = parents.append("path")
			.attr("id", function(d, i) { return "parent" + i; })
			.attr("d", d3.svg.arc()
				.innerRadius(innerRadius + wheelSpace + wheelWidth)
				.outerRadius(innerRadius + wheelSpace + 2 * wheelWidth)
			)
			.style("fill", function(d) { return fill(d.id);});

		parents.filter(function(d) {return d.name == 'cluster';}).remove();

		parents.append("title").text(function(d) {
			return d.name + '\nClick to collapse';
		});
		
		// Add a text label.
		parentText = parents.append("text")
			.attr("x", 5)
			.attr("dy", wheelWidth - 5)
			.style("fill", "white");

		parentText.append("textPath")
			.attr("xlink:href", function(d, i) { return "#parent" + i; })
			.text(function(d) { return d.name });

		// Remove the labels that don't fit
		parentText.filter(function(d, i) {
				var avail = parentPaths[0][i].getTotalLength() / 2 - wheelWidth;
				return avail < this.getComputedTextLength(); 
			})
			.remove();


		// Chords
		// ======

		// Add chords to the diagram
		chords = svg.selectAll(".chord")
			.data(layout.chords)
		  .enter().append("path")
			.attr("class", "chord")
			.attr("d", d3.svg.chord().radius(innerRadius))
			.style("fill", d3.rgb("#2E2E82") )
			.style("fill-opacity", function(d){ return math.max(0.05, d.value / math.sum(matrix) * layout.transpFactor()) });

		// Basic mouseover label for chords
		chords.append("title").text(function(d) {
			return groups.data()[d.target.index].name + 
			" → " + groups.data()[d.source.index].name + 
			": " + d.value;
		});

		// Handles class selection on group mouseover
	};

};
