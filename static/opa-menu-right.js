
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

	$('.compStatPanel .form-group').removeClass('has-error');

	rule = map.rules.getByRuleset(document.getElementById('compStatRule').value);
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

	if (params) {
		$('.compStatResPanel').slideUp();
		map.simulate(params.rule.ruleset, params.size, params.pgs, function(res) {
			var sizes = {},
			    byOsd = {},
					lines = res.split('\n');

			for (var i = 0; i < lines.length; i++) {
				if (lines[i].startsWith('CRUSH')) {
					var Osds = lines[i].split(" ")[5].slice(1).slice(0,-1).split(',');
					var size = Osds.length;

					for (var j = 0; j < Osds.length; j++) {
						if (Osds[j] == '2147483647') size -= 1;
						else if (isNaN(byOsd[Osds[j]])) byOsd[Osds[j]] = 1;
						else byOsd[Osds[j]] += 1;
					}

					if (isNaN(sizes[size])) sizes[size] = 1;
					else sizes[size] += 1;
				};
			};

			var d3sizes = [];
			for (var s in sizes)
				d3sizes.push({'num': s, 'pgs': sizes[s]});

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
