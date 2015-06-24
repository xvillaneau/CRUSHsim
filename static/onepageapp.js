
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

	$('#btnWelcomeInit').on('click', function() {
		Cookies.set('map_id', 'init');
		window.location = "/onepageapp";
	});

	$('#btnWelcomeNew').on('click', function() {
		$('#divWelcomeSelect').slideUp();
		$('#divWelcomeNew').slideDown();
	});

	$('#btnWelcomeNewCancel').on('click', function() {
		$('#divWelcomeSelect').slideDown();
		$('#divWelcomeNew').slideUp();
	});

	$('#btnWelcomeLoad').on('click', function() {
		$.get('/api/crushmap', function(data){
			// Get the list of CRUSH maps and their metadata

			if (data.length == 0) {
				// If the list is empty, delete the table and write a message
				$('#divWelcomeLoad').empty().append("<p>There is currently no saved CRUSH map</p>")
				$('#divWelcomeLoad').slideDown();

			} else {
				for (var i = 0; i < data.length; i++) {
					
					// For each map, append a new row to the table
					var row = $('<tr>').appendTo('#divWelcomeLoad tbody');
					var rowtext = (typeof(data[i].name) != 'undefined' ? data[i].name : data[i].id);
					var rowdate = new Date(data[i].modtime * 1000);

					// Add the appropriate class, the crush uuid and property the handler
					row.append('<td>').children().text(rowtext)
						.after('<td>').next().text(rowdate.toLocaleString())
						.after('<td>').next().append('<a>').children()
						.attr('href', '/onepageapp/'+data[i].id).text('Choose').addClass('btn btn-default btn-xs')
				};
				$('#divWelcomeSelect').slideUp();
				$('#divWelcomeLoad').slideDown();
			};
		});
	});

	$('#btnWelcomeLoadCancel').on('click', function() {
		$('#divWelcomeSelect').slideDown();
		$('#divWelcomeLoad').slideUp();
	});

	$('#btnShowWelcome').on('click', function() {
			
		$('#welcomeModal').modal()
		 .find('#welcomeModalLabel').hide();
	})


	var color = d3.scale.category20();

	force = d3.layout.force()
		.charge(-120)
		.linkDistance(30)
		.size([appw, apph]);

	var svg = d3.select("#appGraph").append("svg")
		.attr('width', appw).attr('height',apph);


	$('<style>').appendTo('head').text(
		 ".node {\n"
		+"  stroke: #fff;\n"
		+"  stroke-width: 1.5px;\n"
		+"}\n"
		+"\n"
		+".link {\n"
		+"  stroke: #999;\n"
		+"  stroke-opacity: .6;\n"
		+"}\n"
	);
	
	function initApp(id) {
		svg.selectAll('*').remove()

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
			  .attr("class", "node")
			  .attr("r", 8)
			  .style("fill", function(d) { return color(d.type_id); })
			  .call(force.drag)
			  .on('mouseover', updateInfoPanel);

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
	};

	function updateInfoPanel(d) {
		$('#appMenu .infoPanel .panel-body').empty()
			.append('<ul>').children()
			.append('<li>').children().html('<b>Name:</b> '+d.name)
			.after('<li>').next().html('<b>ID:</b> '+d.id)
			.after('<li>').next().html('<b>Type:</b> '+d.type);
    };

});

// vim: set ts=4 sw=4 autoindent:
