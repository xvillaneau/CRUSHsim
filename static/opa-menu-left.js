
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
	d3.select('#appMenuL .legendPanel tbody')
		.selectAll('tr').data(app.map.types.json())
	    .enter().append('tr')
		.html(function(d) {
			return '<td><span style="color: '+app.maincolor(d.id_type)+'">&#9679;</span></td>'
				+ '<td>' + d.id_type + '</td>'
				+ '<td>' + d.name + '</td>';
		})
		.on('mouseover', function(d) {
			app.graph.selectAll('.node').style('stroke', 'white');
			app.graph.selectAll('.type-' + d.name).style('stroke', 'black');
		})
		.on('mouseout', function(d) {
			app.graph.selectAll('.node').style('stroke', 'white');
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
	if (document.getElementById('optOsdCircle').checked) {
		var osdList = app.map.devices.json(),
			radius = app.h / 2 * 0.9,
			baseAngle = 2 * Math.PI / osdList.length,
			angles = {};

		app.graph.insert('circle', ":first-child")
			.attr('class', 'circle-osd')
			.attr('r', radius)
			.attr('cx', app.w / 2)
			.attr('cy', app.h / 2)

		for (var i = 0; i < osdList.length; i++) angles[osdList[i].id] = i * baseAngle;

		var circledrag = d3.behavior.drag()
			.origin(function(d) {return d;})
			.on('drag', function(d){
				//this.x = radius * Math.sin(math.arg(math.complex(d3.event.x, d3.event.y)));
				//this.px = radius * Math.sin(math.arg(math.complex(d3.event.x, d3.event.y)));
				var x,y,
				    a = math.arg(math.complex(app.h/2 - d3.event.y, d3.event.x - app.w/2));

				a = baseAngle * math.floor(a / baseAngle + 0.5);
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

		app.graph.selectAll(".type-osd")
			.each(function(d) {
				d.px = radius * Math.sin(angles[d.id]) + app.w / 2;
				d.py = -radius * Math.cos(angles[d.id]) + app.h / 2;
				d.fixed = true;
			})
			.call(circledrag)

		app.force.resume()
	} else {
		app.graph.select('.circle-osd').remove()
		app.graph.selectAll(".type-osd")
			.each(function(d) {d.fixed = false;})
			.call(app.force.drag)
		app.force.resume()
	};

};

function initLeftMenu() {
	document.getElementById('optOsdCircle').onchange = function(){updateNodeCircle('osd')}
	initLegendPanel();
};

// vim: set ts=4 sw=4 autoindent:
