
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-menu-left.js - Functions for the left menu
//

function initLegendPanel(graph, color) {
	d3.select('#appMenuL .legendPanel tbody')
		.selectAll('tr').data(map.types.json())
	    .enter().append('tr')
		.html(function(d) {
			return '<td><span style="color: '+color(d.id_type)+'">&#9679;</span></td>'
				+ '<td>' + d.id_type + '</td>'
				+ '<td>' + d.name + '</td>';
		})
		.on('mouseover', function(d) {
			graph.selectAll('.node').style('stroke', 'white');
			graph.selectAll('.type-' + d.name).style('stroke', 'black');
		})
		.on('mouseout', function(d) {
			graph.selectAll('.node').style('stroke', 'white');
		});
};

function updateInfoPanel(d) {
	$('#appMenuL .infoPanel .panel-body').empty()
		.append('<ul>').children()
		.append('<li>').children().html('<b>Name:</b> '+d.name)
		.after('<li>').next().html('<b>ID:</b> '+d.id)
		.after('<li>').next().html('<b>Type:</b> '+d.type);
};

function updateNodeCircle(graph, force, type) {
	if (document.getElementById('optOsdCircle').checked) {
		var osdList = map.devices.json(),
			radius = apph / 2 * 0.9,
			baseAngle = 2 * Math.PI / osdList.length,
			angles = {};

		graph.insert('circle', ":first-child")
			.attr('class', 'circle-osd')
			.attr('r', radius)
			.attr('cx', appw / 2)
			.attr('cy', apph / 2)

		for (var i = 0; i < osdList.length; i++) angles[osdList[i].id] = i * baseAngle;

		graph.selectAll(".type-osd")
			.each(function(d) {
				d.px = radius * Math.sin(angles[d.id]) + appw / 2;
				d.py = -radius * Math.cos(angles[d.id]) + apph / 2;
				d.fixed = true;
			})
		force.resume()
	} else {
		graph.select('.circle-osd').remove()
		graph.selectAll(".type-osd")
			.each(function(d) {d.fixed = false;})
		force.resume()
	};
	
};

function initLeftMenu(graph, color, force) {
	document.getElementById('optOsdCircle').onchange = function(){updateNodeCircle(graph, force, 'osd')}
	initLegendPanel(graph, color);
};

// vim: set ts=4 sw=4 autoindent:
