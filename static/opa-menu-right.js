
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-menu-right.js - Functions for the right menu
//

function updateCompStatRule() {
	var ruleset = document.getElementById('compStatRule').value,
		rule = app.map.rules.getByRuleset(ruleset);

	$('#compStatSize').attr("placeholder",rule.max_size)
	$('#compStatMinSize').attr("placeholder",rule.min_size)

	var size = document.getElementById('compStatSize').value;
	if (isNaN(parseInt(size)))
		$('#compStatPgs').attr("placeholder",app.map.suggestPgs(ruleset));
	else
		$('#compStatPgs').attr("placeholder",app.map.suggestPgs(ruleset, size));
};

function updateCompStatSize() {
	var ruleset = document.getElementById('compStatRule').value;
	$('#compStatPgs').attr("placeholder",app.map.suggestPgs(ruleset, this.value))
};

function compStatLaunchTests() {
	var rule, size, min_size, pgs,
		success = true;

	$('.compStatPanel .form-group').removeClass('has-error');

	rule = app.map.rules.getByRuleset(document.getElementById('compStatRule').value);
	if (typeof rule == 'undefined') {
		$('#compStatRule').parent().addClass('has-error');
		success = false;
	}

	size = document.getElementById('compStatSize').value;
	if (typeof size == 'undefined' || isNaN(parseInt(size)))
		size = $('#compStatSize').attr('placeholder');
	if (typeof size == 'undefined' || isNaN(parseInt(size))) {
		$('#compStatSize').parent().addClass('has-error');
		success = false;
	}

	min_size = document.getElementById('compStatMinSize').value;
	if (typeof min_size == 'undefined' || isNaN(parseInt(min_size)))
		min_size = $('#compStatMinSize').attr('placeholder');
	if (typeof min_size == 'undefined' || isNaN(parseInt(min_size))) {
		$('#compStatMinSize').parent().addClass('has-error');
		success = false;
	}

	pgs = document.getElementById('compStatPgs').value;
	if (typeof pgs == 'undefined' || isNaN(parseInt(pgs)))
		pgs = $('#compStatPgs').attr('placeholder');
	if (typeof pgs == 'undefined' || isNaN(parseInt(pgs))) {
		$('#compStatPgs').parent().addClass('has-error');
		success = false;
	}

	if (parseInt(size) > rule.max_size) {
		$('#compStatSize').parent().addClass('has-error');
		success = false;
	};
	if (parseInt(min_size) < rule.min_size) {
		$('#compStatMinSize').parent().addClass('has-error');
		success = false;
	};
	if (parseInt(min_size) > parseInt(size)) {
		$('#compStatMinSize').parent().addClass('has-error');
		$('#compStatSize').parent().addClass('has-error');
		success = false;
	};

	if (success) return {'rule': rule, 'size': size, 'min_size': min_size, 'pgs': pgs};
	else return false;
};

function compStatLaunch() {
	var params = compStatLaunchTests();

	if (params) { // False if any if the tests fails
		app.map.simulate(params.rule.ruleset, params.size, params.pgs, function(res) {
			// Callback function after simulation success
			var sizes = {},
			    byOsd = {},
					lines = res.split('\n');

			for (var i = 0; i < lines.length; i++) {
				// Iterate through the lines to compute results
				if (lines[i].startsWith('CRUSH')) {
					// For each line, get the assigned OSDs
					var Osds = lines[i].split(" ")[5].slice(1).slice(0,-1).split(',');
					var size = Osds.length;

					for (var j = 0; j < Osds.length; j++) {
						// Iterate through the OSDs
						if (Osds[j] == '2147483647') size -= 1; // Missing OSD in EC placement
						// Else increment or initiate count of PGs per OSD
						else if (isNaN(byOsd[Osds[j]])) byOsd[Osds[j]] = 1;
						else byOsd[Osds[j]] += 1;
					}

					// initiate or increment count of PGs per sze
					if (isNaN(sizes[size])) sizes[size] = 1;
					else sizes[size] += 1;
				};
			};

			// For the list of PGs per size, D3 requires an array instead of an object
			var d3sizes = [];
			for (var s in sizes)
				d3sizes.push({'num': s, 'pgs': sizes[s]});

			// Display the list of PGs per size
			d3.select('#appMenuR .compStatResPanel tbody').html('')
				.selectAll('tr').data(d3sizes)
				.enter().append('tr')
				.attr('class', function(d){
					if (d.num == params.size) return 'success text-success';
					else if (d.num >= params.min_size) return 'warning text-warning';
					else return 'danger text-danger';
				})
				.html( function(d, i) {
					return '<td>n = ' + d.num + '</td>'
						+ '<td>' + d.pgs + '/' + params.pgs + '</td>'
				});
			$('.compStatResPanel').slideDown();

			// Color scale for PGs per OSD on graph
			var osdsInRule = app.map.rules.osdsInRule(params.rule.ruleset, app.map.buckets);
			var qScale = d3.scale.quantile()
			   .domain([0, 2* params.pgs * params.size / osdsInRule.length])
			   .range(colorbrewer.RdBu[11]);

			app.graph.selectAll('.node.type-osd')
				.style('fill', function(d) {
					if (isNaN(byOsd[d.id]) || ! d.name in osdsInRule)
						return 'lightgrey';
					else
						return qScale(byOsd[d.id]);
				});
		});
	};
};

function initRightMenu() {
	d3.select('#compStatRule')
		.selectAll('option').data(app.map.rules.json())
		.enter().append('option')
		.attr('value', function(d){return d.ruleset})
		.attr('selected', function(d,i){if (i==0) return 'selected'; else return null;})
		.text(function(d){return d.ruleset + ' - ' + d.rule_name});

	document.getElementById('compStatRule').onchange = updateCompStatRule;
	document.getElementById('compStatSize').onchange = updateCompStatSize;
	document.getElementById('btnCompStat').onclick = compStatLaunch;
	updateCompStatRule();
}

// vim: set ts=4 sw=4 autoindent:
