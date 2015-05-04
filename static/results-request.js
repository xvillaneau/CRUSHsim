
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// results-request.js - Script for displaying the results
//  - Fetches all the data we need
//  - Processes the result and makes a matrix out of it
//  - Calls the script that will build and display the graph
//  - Requires results-graph.js and math.js
//
// Changelog:
// ----------
// May 4th 2015 - Initial release


$('document').ready(function(){
	// This initializes the page, by loading the data
	var stats_ini, stats_fin,
		id_ini, id_fin,
		req_res_ini, req_res_fin,
		req_map_ini, req_map_fin,
		res_ini, res_fin,
		map_ini, map_fin,
		numOSDs, numSims,
		matrix, buckets,
		s_i, s_f, a_i, a_f,
		index, weight, coords;

	stats_ini = Cookies.get('stats_ini');
	stats_fin = Cookies.get('stats_fin');

	// Check if cookies are defined
	if (typeof stats_ini != 'undefined' && typeof stats_fin != 'undefined') {
		
		// The map ID is the first part of the stat ID (the rest are the options)
		id_ini = stats_ini.split('_')[0];
		id_fin = stats_fin.split('_')[0];

		req_res_ini = $.get('/simulation/'+stats_ini); 
		req_res_fin = $.get('/simulation/'+stats_fin); 
		req_map_ini = $.getJSON('/crushdata/'+id_ini+'.json'); 
		req_map_fin = $.getJSON('/crushdata/'+id_fin+'.json'); 

		// Wait for all the requests to finish
		$.when(req_res_ini, req_res_fin, req_map_ini, req_map_fin).then(
			function(resp_res_ini, resp_res_fin, resp_map_ini, resp_map_fin){
				// If the four requests are successful

				// Put the data into a more usable form
				res_ini = resp_res_ini[0].split('\n').slice(1,-2);
				res_fin = resp_res_fin[0].split('\n').slice(1,-2);
				map_ini = resp_map_ini[0];
				map_fin = resp_map_fin[0];

				// Get how many OSDs and simulations we'll have to process
				numOSDs = math.max(map_ini.devices.concat(map_fin.devices)) + 1;
				numSims = res_ini.length;

				// Initialize the data matrix
				matrix = math.zeros(numOSDs, numOSDs);

				for (var i = 0; i < numSims; i++) {
					// Go through the simulations, line by line

					// Get the part of the string that corresponds to the CRUSH result
					s_i = res_ini[i].split(' ')[5];
					s_f = res_fin[i].split(' ')[5];

					if (s_i != s_f) {
						// If the strings are the same, we don't care. Otherwise :

						// Parse the string into arrays
						a_i = JSON.parse(s_i);
						a_f = JSON.parse(s_f);

						// Remove all final OSDs that are also in the initial result
						for (var osd in a_i) {
							index = a_f.indexOf(a_i[osd]);
							if (index >= 0) {
								a_f = a_f.slice(0,index).concat(a_f.slice(index+1));
							};
						};

						// The "amount" of transfered data, 1 being one PG worth of data
						weight = 1 / a_i.length;

						for (var osd_f in a_f) {
							for (var osd_i in a_i) {
								// Finally, fill in the matrix
								coords = [a_f[osd_f], a_i[osd_i]];
								matrix.set(coords, matrix.get(coords) + weight);
							};
						};
					};
				};

				buckets = CrushUtils.mergeBuckets(map_ini.buckets, map_fin.buckets);
				
				// Our matrix is filled in, now let's display it.
				displayResultsGraph(matrix, buckets);
			},
			function(error){
				displayAlert('HTTP error '+error.status+': ' +
				'One of the requested CRUSH maps failed to be retrieved.',
				'error');
			}
		);
	} else {
		displayAlert("The IDs of the simulations are not in the session cookies; " +
		"you should <a href=\"/analyze\" class=\"alert-link\">launch an analysis</a> "+
		"before visiting this page.", 'warning');
	};
	
});

