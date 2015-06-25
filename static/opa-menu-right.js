
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-menu-right.js - Functions for the right menu
//

function updateCompStatRule() {
	var ruleset = document.getElementById('compStatRule').value,
		rule = map.rules.getByRuleset(ruleset);

	$('#compStatSize').attr("placeholder",rule.max_size)
	$('#compStatMinSize').attr("placeholder",rule.min_size)

	var size = document.getElementById('compStatSize').value;
	if (isNaN(parseInt(size)))
		$('#compStatPgs').attr("placeholder",map.suggestPgs(ruleset));
	else
		$('#compStatPgs').attr("placeholder",map.suggestPgs(ruleset, size));
};

function updateCompStatSize() {
	var ruleset = document.getElementById('compStatRule').value;
	$('#compStatPgs').attr("placeholder",map.suggestPgs(ruleset, this.value))
};

function compStatLaunchTests() {
	var rule, size, min_size, pgs,
		success = true;

	rule = map.rules.getByRuleset(document.getElementById('compStatRule').value);
	if (typeof rule == 'undefined') {
		$('#compStatRule').addClass('has-error');
		success = false;
	}

	size = document.getElementById('compStatSize').value;
	if (typeof size == 'undefined' || isNaN(parseInt(size)))
		size = $('#compStatSize').attr('placeholder');
	if (typeof size == 'undefined' || isNaN(parseInt(size))) {
		$('#compStatSize').addClass('has-error');
		success = false;
	}

	min_size = document.getElementById('compStatMinSize').value;
	if (typeof min_size == 'undefined' || isNaN(parseInt(min_size)))
		min_size = $('#compStatMinSize').attr('placeholder');
	if (typeof min_size == 'undefined' || isNaN(parseInt(min_size))) {
		$('#compStatMinSize').addClass('has-error');
		success = false;
	}

	pgs = document.getElementById('compStatPgs').value;
	if (typeof pgs == 'undefined' || isNaN(parseInt(pgs)))
		pgs = $('#compStatPgs').attr('placeholder');
	if (typeof pgs == 'undefined' || isNaN(parseInt(pgs))) {
		$('#compStatPgs').addClass('has-error');
		success = false;
	}

	if (success) return {'rule': rule, 'size': size, 'min_size': min_size, 'pgs': pgs};
	else return false;
};

function compStatLaunch() {
	var params = compStatLaunchTests();

	if (params) {
		map.simulate(params.rule.ruleset, params.size, params.pgs, function(res) {
			var sizes = {},
			    byOsd = {},
					lines = res.split('\n');

			for (var i = 0; i < lines.length; i++) {
				if (lines[i].startsWith('CRUSH')) {
					var Osds = lines[i].split(" ")[5].slice(1).slice(0,-1).split(',');
					var size = Osds.length;

					if (isNaN(sizes[size])) sizes[size] = 1;
					else sizes[size] += 1;

					for (var j = 0; j < Osds.length; j++) {
						if (isNaN(byOsd[Osds[j]])) byOsd[Osds[j]] = 1;
						else byOsd[Osds[j]] += 1
					}
				};
			};

			var qScale = d3.scale.quantile()
			   .domain([0, params.pgs * params.size / map.buckets.json().length])
			   .range(colorbrewer.RdBu[11]);

			d3.select('svg').selectAll('.node.type-osd')
				.style('fill', function(d) {
					if (isNaN(byOsd[d.id]))
						return qScale(0);
					else
						return qScale(byOsd[d.id]);
				});

			console.log(sizes);
			console.log(byOsd);
		});
	};
};

function initRightMenu() {
	d3.select('#compStatRule')
		.selectAll('option').data(map.rules.json())
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
