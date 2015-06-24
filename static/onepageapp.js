
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
		Cookies.set('map_id', 'init', {'path': '/'});
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
				$('#divWelcomeLoad tbody').empty();
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
		 .find('.modal-header').hide();
	});

	$('#btnShowManager').on('click', function() {
		$.get('/api/crushmap', function(data){
			// Get the list of CRUSH maps and their metadata

			if (data.length == 0) {
				// If the list is empty, delete the table and write a message
				$('#managerModal modal-body').empty()
				 .append("<p>There is currently no saved CRUSH map</p>")

			} else {
				// If we're given data, first empty previous data
				$('#managerModal tbody').empty();

				for (var i = 0; i < data.length; i++) {
					
					// For each map, append a new row to the table
					var row = $('<tr>').appendTo('#managerModal tbody');

					// Store information that will be useful
					var rowtext = (typeof(data[i].name) != 'undefined' ? data[i].name : data[i].id);
					var rowdate = new Date(data[i].modtime * 1000);

					// The first cell contains the name in a <span>, and the renaming form
					$('<td>').appendTo(row)
						.append('<span>').children().text(rowtext)
						// The renaming form
						.after('<div>').next().addClass('form-inline mapRename').hide()
						 .append('<input>').children().addClass('form-control').attr('type','text')
						 .after('<button>').next().addClass('btn btn-primary btn-sm')
						  .text('Rename').prop('crushUuid', data[i].id)
						  .on('click', function() {
						 	var name = $(this).prev().prop('value');
							var form = $(this).parent();
						  	// When the Rename button is clicked, send a PUT query to the server
							$.ajax(
								'/api/crushmap/' + this.crushUuid, 
								{
									'method': 'PUT',
									'contentType': 'application/json',
									'data': JSON.stringify({'name': name}),
									'success': function(){
										// If it worked, hide the form, update the name and show it again
										form.hide().prev().text(name).show();
									}
								});
						  })
						// The deleting form
						.parent().after('<div>').next().addClass('mapDelete').hide()
						 .append('<span>').children().text('Are you sure?')
						 .after('<button>').next().addClass('btn btn-danger btn-sm')
						  .text('Delete').prop('crushUuid', data[i].id)
						  .on('click', function() {
						  	var row = $(this).parent().parent().parent();
							$.ajax(
								'/api/crushmap/' + this.crushUuid, 
								{
									'method': 'DELETE',
									'success': function() {row.slideUp().remove();}
								});
						  });

					$('<td>').text(rowdate.toLocaleString()).appendTo(row);

					$('<td>').appendTo(row)
					    .append('<span>').children().addClass("glyphicon glyphicon-tag")
						 .attr("aria-hidden","true").tooltip({'title':'Rename'})
						 .on('click', function() {
							var cell = $(this).parent().parent().children().first();
							cell.children('.mapRename').toggle();
							cell.children('.mapDelete').hide();
							if (cell.children('.mapRename').css('display') == 'none') {
								cell.children('span').show();
							} else {
								cell.children('span').hide();
							}
						});

					$('<td>').appendTo(row)
						.append('<span>').children().addClass("glyphicon glyphicon-remove")
						 .attr("aria-hidden","true").tooltip({'title':'Delete'})
						 .on('click', function() {
							var cell = $(this).parent().parent().children().first();
							cell.children('.mapDelete').toggle();
							cell.children('.mapRename').hide();
							if (cell.children('.mapDelete').css('display') == 'none') {
								cell.children('span').show();
							} else {
								cell.children('span').hide();
							}
						});
				};
			};
			$('#managerModal').modal()
		});
		
	});

	$('#optOsdCircle').on('change', function() {
		if (this.checked) {
			var osdList = map.jsonMap().devices,
				radius = apph / 2 * 0.8,
				baseAngle = 2 * Math.PI / osdList.length,
				angles = {};

			for (var i = 0; i < osdList.length; i++) angles[osdList[i].id] = i * baseAngle;

			svg.selectAll(".type-osd")
				.each(function(d) {
					d.px = radius * Math.sin(angles[d.id]) + appw / 2;
					d.py = -radius * Math.cos(angles[d.id]) + apph / 2;
					d.fixed = true;
				})
			force.resume()
		} else {
			svg.selectAll(".type-osd")
				.each(function(d) {d.fixed = false;})
			force.resume()
		};
	});

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

		d3.select('.legendPanel tbody')
			.selectAll('tr').data(data.types)
			.enter().append('tr')
			.html(function(d) {
				return '<td><span style="color: '+color(d.id_type)+'">&#9679;</span></td>'
					+ '<td>' + d.id_type + '</td>'
					+ '<td>' + d.name + '</td>';
			})
			.on('mouseover', function(d) {
				svg.selectAll('.node').style('stroke', 'white');
				svg.selectAll('.type-' + d.name).style('stroke', 'black');
			})
			.on('mouseout', function(d) {
				svg.selectAll('.node').style('stroke', 'white');
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
