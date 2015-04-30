$('document').ready(function(){
	
	var id_ini, id_fin,
		div_ini, div_fin;

	document.getElementById('pool-ini-rule').value = Cookies.get('rule_ini');
	document.getElementById('pool-ini-size').value = Cookies.get('size_ini');
	document.getElementById('pool-ini-minsize').value = Cookies.get('minsize_ini');
	document.getElementById('pool-fin-rule').value = Cookies.get('rule_fin');
	document.getElementById('pool-fin-size').value = Cookies.get('size_fin');
	document.getElementById('pool-fin-minsize').value = Cookies.get('minsize_fin');

	// Shortcut selections for display blocks
	div_ini = $('#crush-ini');
	div_fin = $('#crush-fin');
	var crush_ini = null;

	function updateCrushPreview(state, id) {
		var block, data;

		if (state == 'ini') id_ini = id;
		else if (state == 'fin') id_fin = id;
		else return "Please use 'ini' or 'fin' as an argument!";

		block = $('#crush-' + state);
		Cookies.set('id_' + state, id);
		$('#pool-' + state + '-rule').empty();

		if (!id) {
			block.children('h4').text("Undefined");
			block.children('pre').hide();
		} else {
			block.children('h4').text(id);
			displayCrush(id, block.children('pre').show());
			$.getJSON('/crushdata/' + id + '.json').success(function(data){
				var rulesets = [];
				for (var r in data.rules) {rulesets.push(parseInt(r))};
				rulesets.sort()
				for (var i = 0; i < rulesets.length; i++) {
					var r = data.rules[rulesets[i]];
					$('#pool-' + state + '-rule').append(
						"<option value="+ r.ruleset +">"+ r.ruleset +" - "+ r.name +"</option>"
					);
				};
			});
		};

		if (id_fin == id_ini) {
			div_fin.children('h4').text("Same has initial map");
			div_fin.children('pre').hide();
		} else if (id_fin) {
			div_fin.children('h4').text(id_fin);
			displayCrush(id_fin, div_fin.children('pre').show());
		};

	};

	// When loading the page, use the maps in the cookies if they exist
	updateCrushPreview('ini', Cookies.get('id_ini'));
	updateCrushPreview('fin', Cookies.get('id_fin'));

	// Handles click on the 'Init.' selection buttons
	$('.crush-map-avail .btn-ini').on('click', function() {
		updateCrushPreview("ini", $(this).parent().siblings('.crush-map-id').text());
		updateCrushIni(id_ini);
	});

	// Handles click on the 'Fin.' selection buttons
	$('.crush-map-avail .btn-fin').on('click', function() {
		updateCrushPreview("fin", $(this).parent().siblings('.crush-map-id').text());
	});

	function buttonCheck() {
		var rule = Cookies.get('rule_ini');
		var size = Cookies.get('size_ini');
		var minsize = Cookies.get('minsize_ini');

		if (rule != '' && size != '' && minsize != '') {
			$('form#launch-simulation button').removeClass('disabled');
		} else {
			$('form#launch-simulation button').addClass('disabled');
		};
	}

	// Handles changes in the initial pool form. Enables the button if all the data has been given
	$('form#pool-ini').on('change', function() {
		Cookies.set('rule_ini', document.getElementById('pool-ini-rule').value);
		Cookies.set('size_ini', document.getElementById('pool-ini-size').value);
		Cookies.set('minsize_ini', document.getElementById('pool-ini-minsize').value);
		buttonCheck();
	});

	$('form#pool-fin').on('change', function() {
		Cookies.set('rule_fin', document.getElementById('pool-fin-rule').value);
		Cookies.set('size_fin', document.getElementById('pool-fin-size').value);
		Cookies.set('minsize_fin', document.getElementById('pool-fin-minsize').value);
	});

	// Handles click on the "Launch simulation" button
	// TODO : forget JS, use a simple POST request and let Flask do the rest
	$('form#launch-simulation').on('submit', function() {
		$.post("/analyze", function(response){
			window.location.replace("/results");
		})
		.fail(function(response){
			displayAlert("HTTP " + response.status + " error: " + response.responseText,'error');
		});
	});

	buttonCheck();
});
