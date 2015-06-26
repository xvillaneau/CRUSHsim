
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

var apph, appw, map;

$(document).ready(function(){
	apph = $(window).height()
	appw = $(window).width()
	// Fixes the size of the entire page
	// TODO: This is awful and there's certainly a better way to do it
	$('body').css('width', $(window).width());
	$('body').css('height', $(window).height());

	var init_id = Cookies.get('map_id');
	map = crushsim.crushmap();

	var color = d3.scale.category20();

	force = d3.layout.force()
		.charge(-120)
		.linkDistance(30)
		.size([appw, apph]);

	var svg = d3.select("#appGraph").append("svg")
		.attr('width', appw).attr('height',apph);

	function initApp(id) {
		if (typeof id == 'undefined') {
			map.init();
			initGraph();
			$('#welcomeModal').modal();
		} else if (id == 'init') {
			map.init();
			initGraph();
		} else {
			$.get('/api/crushmap/'+id, function(data) {
				map.textMap(data);
				initGraph();
			})
		};
	};
	initApp(init_id);

	function initGraph() {
		var data = map.graphData();

		force
			  .nodes(data.nodes)
			  .links(data.links)
			  .start();

		  var link = svg.selectAll(".link")
			  .data(data.links)
			.enter().append("line")
			  .attr("class", "link")
			  .style("stroke-width", function(d) { return 1/*Math.sqrt(d.value)*/; });

		  var node = svg.selectAll(".node")
			  .data(data.nodes)
			.enter().append("circle")
			  .attr("class", function(d) {return "node type-" + d.type})
			  .attr("r", 8)
			  .style("fill", function(d) { return color(d.type_id); })
			  .call(force.drag)
			  .on('mouseover', function(d){
			  	$(this).css("stroke", 'black');
			  	updateInfoPanel(d);
			  })
			  .on('mouseout', function(d){
			  	$(this).css("stroke", 'white');
			  })

		  node.append("title")
			  .text(function(d) { return d.name; });

		  force.on("tick", function() {
			link.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

			node.attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
		});

		initWelcomeModal();
		initManagerModal();
		initLeftMenu(svg, color, force);
		initRightMenu();
	};

});

// vim: set ts=4 sw=4 autoindent:
