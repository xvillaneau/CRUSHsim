
function mapRowButton(row) {

	function onRenameClick() {
		var newname = $('.crush-maps-list input').prop('value');
		var crushid = row.prop('crushUuid');
		$.ajax(
			'/crushdata/'+crushid, 
			{
				'method': 'PUT',
				'contentType': 'application/json',
				'data': JSON.stringify({'name': newname}),
				'success': function(){
					row.children().first().text(newname);
					row.prop('crushName', newname);
					row.next().remove();
					row.find('button').show();
				}
			}
		);
	}

	function makeRenameRow() {
		$(this).hide();
		row.after('<tr>')
		 .next().addClass('active').append('<td>')
		 .children().attr('colspan',2).append('<input>')
		 .children().addClass('form-control').attr('type','text')
		  .attr('value', (typeof row.prop('crushName') != 'undefined' ? row.prop('crushName') : null))
		 .parent().after('<td>')
		 .next().append('<button>')
		 .children().attr('type','submit').addClass('btn btn-primary btn-xs').text('Rename').on('click', onRenameClick);
	};

	row.append('<td>')
	 .children().last().append('<button>')
	 .children().addClass('btn btn-default btn-xs').text('Rename').on('click', makeRenameRow);
	
};

// vim: set ts=4 sw=4 autoindent:
