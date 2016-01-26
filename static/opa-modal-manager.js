
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-modal-managet.js - Functions for the manager modal
//

function showManagerModal() {
	$.get('/api/crushmap', function(data){
		// Get the list of CRUSH maps and their metadata

		if (data.length == 0) {
			// If the list is empty, delete the table and write a message
			$('#managerModal modal-body').empty()
			 .append("<p>There is currently no saved CRUSH map</p>")

		} else {
			// If we're given data, first empty previous data
			$('#managerModal tbody').empty();

			for (var i = 0; i < data.length; i++) {

				// For each map, append a new row to the table
				var row = $('<tr>').appendTo('#managerModal tbody');

				// Store information that will be useful
				var rowtext = (typeof(data[i].name) != 'undefined' ? data[i].name : data[i].id);
				var rowdate = new Date(data[i].modtime * 1000);

				// The first cell contains the name in a <span>, and the renaming form
				$('<td>').appendTo(row)
					.append('<span>').children().text(rowtext)
					// The renaming form
					.after('<div>').next().addClass('form-inline mapRename').hide()
					 .append('<input>').children().addClass('form-control').attr('type','text')
					 .after('<button>').next().addClass('btn btn-primary btn-sm')
					  .text('Rename').prop('crushUuid', data[i].id)
					  .on('click', function() {
						var name = $(this).prev().prop('value');
						var form = $(this).parent();
						// When the Rename button is clicked, send a PUT query to the server
						$.ajax(
							'/api/crushmap/' + this.crushUuid,
							{
								'method': 'PUT',
								'contentType': 'application/json',
								'data': JSON.stringify({'name': name}),
								'success': function(){
									// If it worked, hide the form, update the name and show it again
									form.hide().prev().text(name).show();
								}
							});
					  })
					// The deleting form
					.parent().after('<div>').next().addClass('mapDelete').hide()
					 .append('<span>').children().text('Are you sure?')
					 .after('<button>').next().addClass('btn btn-danger btn-sm')
					  .text('Delete').prop('crushUuid', data[i].id)
					  .on('click', function() {
						var row = $(this).parent().parent().parent();
						$.ajax(
							'/api/crushmap/' + this.crushUuid,
							{
								'method': 'DELETE',
								'success': function() {row.slideUp().remove();}
							});
					  });

				$('<td>').text(rowdate.toLocaleString()).appendTo(row);

				$('<td>').appendTo(row)
					.append('<span>').children().addClass("glyphicon glyphicon-play")
					 .attr("aria-hidden","true").tooltip({'title':'Open'})
					 .prop('crushUuid', data[i].id)
					 .on('click', function() {
						Cookies.set('map_id', this.crushUuid, {'path': '/'});
						window.location = "/app";
					});

				$('<td>').appendTo(row)
					.append('<span>').children().addClass("glyphicon glyphicon-tag")
					 .attr("aria-hidden","true").tooltip({'title':'Rename'})
					 .on('click', function() {
						var cell = $(this).parent().parent().children().first();
						cell.children('.mapRename').toggle();
						cell.children('.mapDelete').hide();
						if (cell.children('.mapRename').css('display') == 'none') {
							cell.children('span').show();
						} else {
							cell.children('span').hide();
						}
					});

				$('<td>').appendTo(row)
					.append('<span>').children().addClass("glyphicon glyphicon-remove")
					 .attr("aria-hidden","true").tooltip({'title':'Delete'})
					 .on('click', function() {
						var cell = $(this).parent().parent().children().first();
						cell.children('.mapDelete').toggle();
						cell.children('.mapRename').hide();
						if (cell.children('.mapDelete').css('display') == 'none') {
							cell.children('span').show();
						} else {
							cell.children('span').hide();
						}
					});
			};
		};
		$('#managerModal').modal()
	});
};

function initManagerModal() {
	document.getElementById('btnShowManager').onclick = showManagerModal;
};

// vim: set ts=4 sw=4 autoindent:
