
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-menu-left.js - Functions for the left menu
//

function initLegendPanel() {
	app.displayTypes = [];

	d3.select('#appMenuL .legendPanel tbody')
		.selectAll('tr').data(app.map.types.json())
	    .enter().append('tr')
		.html(function(d) {
			return '<td><span class="dot" style="color: '+app.maincolor(d.id_type)+'">&#9679;</span></td>'
				+ '<td>' + d.id_type + '</td>'
				+ '<td>' + d.name + '</td>'
				+ '<td><span crushtype="' + d.name + '" class="glyphicon glyphicon-record circle circle-' + d.name + ' text-muted" aria-hidden="true"></span></td>';
		})
		.each(function(d,i){app.displayTypes[i] = d.name})
		.on('mouseover', function(d) {
			app.graph.selectAll('.node').style('stroke', 'white');
			app.graph.selectAll('.type-' + d.name).style('stroke', 'black');
		})
		.on('mouseout', function(d) {
			app.graph.selectAll('.node').style('stroke', 'white');
		});

		$('.legendPanel span.circle').on('click', function() {
			$(this).toggleClass('text-muted').toggleClass('text-primary');
			updateNodeCircle($(this).attr('crushtype'))
		});
};

function updateInfoPanel(d) {
	$('#appMenuL .infoPanel .panel-body').empty()
		.append('<ul>').children()
		.append('<li>').children().html('<b>Name:</b> '+d.name)
		.after('<li>').next().html('<b>ID:</b> '+d.id)
		.after('<li>').next().html('<b>Type:</b> '+d.type);
};

function updateNodeCircle(type) {
	if ($('.legendPanel .circle-'+type).hasClass('text-primary')) {
		var radius, angle;

		if (type == 'osd') angle = 2 * Math.PI / app.map.devices.json().length;
		else angle = 2 * Math.PI / app.map.buckets.byType(type).length;

		radius = 0.9 - 0.8 * app.displayTypes.indexOf(type) / (app.displayTypes.length - 1);
		radius = app.h / 2 * radius;

		app.graph.insert('circle', ":first-child")
			.attr('class', 'node-circle circle-'+type)
			.attr('r', radius)
			.attr('cx', app.w / 2)
			.attr('cy', app.h / 2)

		var circledrag = d3.behavior.drag()
			.origin(function(d) {return d;})
			.on('drag', function(d){
				//this.x = radius * Math.sin(math.arg(math.complex(d3.event.x, d3.event.y)));
				//this.px = radius * Math.sin(math.arg(math.complex(d3.event.x, d3.event.y)));
				var x,y,
				    a = math.arg(math.complex(app.h/2 - d3.event.y, d3.event.x - app.w/2));

				a = angle * math.floor(a / angle + 0.5);
				x = app.w/2 + radius * Math.sin(a)
				y = app.h/2 - radius * Math.cos(a)
				d3.select(this)
					.attr('cx', x)
					.attr('cy', y)
					.each(function(d) {
						d.px = x;
						d.py = y;
					});
				app.force.resume();
			})

		app.graph.selectAll(".type-"+type)
			.each(function(d, i) {
				d.px = radius * Math.sin(i * angle) + app.w / 2;
				d.py = -radius * Math.cos(i * angle) + app.h / 2;
				d.fixed = true;
			})
			.call(circledrag)

		app.force.resume()
	} else {
		app.graph.select('.circle-'+type).remove()
		app.graph.selectAll(".type-"+type)
			.each(function(d) {d.fixed = false;})
			.call(app.force.drag)
		app.force.resume()
	};
};

function resetDisplay() {
	app.graph.selectAll(".node")
		.style("fill", function(d) { return app.maincolor(d.type_id); })
		.style('fill-opacity','1').style('stroke-opacity','1');
	app.graph.selectAll(".link")
		.style('stroke-opacity','1');
};

function switchMode() {
	if (app.active == 'graph') {
		app.graph.remove()
		$('#appEditor').show();
	}
};

function initLeftMenu() {
	initLegendPanel();
	document.getElementById("btnResetDisplay").onclick = resetDisplay;
	document.getElementById("btnSwitchMode").onclick = switchMode;
};

// vim: set ts=4 sw=4 autoindent:
