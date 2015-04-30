
// jQuery functions for CRUSHsim homepage

$('document').ready(function(){

	$('.crush-map-avail').on('click', function(){
		// When an element in the "Saved CRUSH maps" is clicked...

		// The 'info' class is removed from the previous active <tr>
		$('.crush-map-avail.info').removeClass('info');
		$(this).addClass('info');

		// The preview panel is updated
		var id = $(this).children('.crush-map-id').text();
		$.get('/crushdata/'+id, function(data) {
			// Get data, REST is our friend !
			$('#crush-map-preview').text(data);
		});
	});

});
