
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-modal-welcome.js - Functions for the welcome modal
//

function showWelcomeLoad() {
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
};


function initWelcomeModal() {

	document.getElementById('btnWelcomeInit').onclick = function() {
		Cookies.set('map_id', 'init', {'path': '/'});
		window.location = "/onepageapp";
	};

	document.getElementById('btnWelcomeNew').onclick = function() {
		$('#divWelcomeSelect').slideUp();
		$('#divWelcomeNew').slideDown();
	};

	document.getElementById('btnWelcomeLoad').onclick = showWelcomeLoad;

	document.getElementById('btnWelcomeNewCancel').onclick = function() {
		$('#divWelcomeSelect').slideDown();
		$('#divWelcomeNew').slideUp();
	};

	document.getElementById('btnWelcomeLoadCancel').onclick = function() {
		$('#divWelcomeSelect').slideDown();
		$('#divWelcomeLoad').slideUp();
	};

	document.getElementById('btnShowWelcome').onclick = function() {
		$('#welcomeModal').modal()
		 .find('.modal-header').hide();
	};

};

// vim: set ts=4 sw=4 autoindent:
