
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
	$('html').css('width', $(window).width());
	$('html').css('height', $(window).height());
	
	var init_id = Cookies.get('map_id');
	map = crushsim.crushmap();

	if (typeof init_id == undefined) {
		map.init();

		$('#btn-welcome-new').on('click', function() {
			$('#welcomeModal .selector').hide();
			$('#welcomeModal .upload-form').show();
		});

		$('#welcomeModal').modal();
	} else {
		$.get('/api/crushmap/'+init_id, function(data) {
			map.textMap(data);
		})
	};
	
});

// vim: set ts=4 sw=4 autoindent:
