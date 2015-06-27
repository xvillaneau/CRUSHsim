
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// onepageapp.js - Core of the CRUSHsim app, calls everything once the
// page is ready
//

var app = {};

app.resize = function() {
	// Gets the size of the window and applies it to the body and the graph
	// TODO: This is awful IMHO and there's certainly a better way to do it
	app.h = $(window).height()
	app.w = $(window).width()

	$('body').css('width', app.w);
	$('body').css('height', app.h);

	app.graph.attr('width', app.w).attr('height',app.h);
	app.force.size([app.w, app.h]);
}

app.init = function() {
	app.graph = d3.select("#appGraph").append("svg");
	app.maincolor = d3.scale.category20();
	app.force = d3.layout.force().charge(-120).linkDistance(30);

	app.resize();

	app.map = crush.crushmap();
}

app.draw = function() {
	var data = app.map.graphData();

	app.force
			.nodes(data.nodes)
			.links(data.links)
			.start();

		var link = app.graph.selectAll(".link")
		   .data(data.links)
		  .enter().append("line")
		   .attr("class", "link");

		var node = app.graph.selectAll(".node")
			.data(data.nodes)
		.enter().append("circle")
			.attr("class", function(d) {return "node type-" + d.type})
			.attr("r", 8)
			.style("fill", function(d) { return app.maincolor(d.type_id); })
			.call(app.force.drag)
			.on('mouseover', function(d){
				$(this).css("stroke", 'black');
				updateInfoPanel(d);
			})
			.on('mouseout', function(d){
				$(this).css("stroke", 'white');
			})

		node.append("title")
			.text(function(d) { return d.name; });

		app.force.on("tick", function() {
		link.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		node.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; });
	});

	initWelcomeModal();
	initManagerModal();
	initLeftMenu();
	initRightMenu();
};

$(document).ready(function(){
	app.init();

	var init_id = Cookies.get('map_id');

	if (typeof init_id == 'undefined') {
		app.map.init();
		app.draw();
		$('#welcomeModal').modal();
	} else if (init_id == 'init') {
		app.map.init();
		app.draw();
	} else {
		$.get('/api/crushmap/'+init_id, function(data) {
			app.map.textMap(data);
			app.draw();
		})
	};
});

// vim: set ts=4 sw=4 autoindent:
