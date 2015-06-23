
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

var apph, appw;

$(document).ready(function(){
	apph = $(window).height()
	appw = $(window).width()
	// Fixes the size of the entire page
	// TODO: This is awful and there's certainly a better way to do it
	$('html').css('width', $(window).width());
	$('html').css('height', $(window).height());
	
	$('#btn-welcome-new').on('click', function() {
		$('#welcomeModal .selector').hide();
		$('#welcomeModal .upload-form').show();
	});

	$('#welcomeModal').modal();

	
});

// vim: set ts=4 sw=4 autoindent:
