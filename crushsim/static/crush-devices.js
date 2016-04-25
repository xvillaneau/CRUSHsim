
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// crush-devices.js - Javascript objet for CRUSH map devices
//

crush.devices = function() {
		// "Class" for managing devices in a map

		// Currently it doesn't make any difference between the id and
		// the name of a device, since it's always 'osd.<id>'.
		// Maybe this is a mistake... If it does cause you trouble,
		// please send me some feedback.

		var devsObj = {},
			devs = [];

		devsObj.parse = function(line) {
			var l = line.split(' ');
			var id = parseInt(l[1]);

			if (isNaN(id)) {
				// Expecting number as second field of the line
				return "Device - Expecting number as second field of the line"
			} else if (l[2].slice(0,4) == 'osd.') {
				// Third field is osd.N
				if (parseInt(l[2].slice(4)) == id) {
					// If the N is coherent, push to list of devices
					devs.push(parseInt(l[1]));
				} else {
					return "Device - Third field should be osd.N or deviceN";
				};
			} else if (l[2] != 'device'+id) {
				// If third field is deviceN, it's a placeholder for missing OSD
				// If anything else, raise error
				return "Device - Third field should be osd.N or deviceN";
			};
		};

		devsObj.dump = function() {
			var output = '', d = 0;
			for (var i = 0; i < devs.length; i++) {
				if (devs[i] != (i + d)) {
					// Missing device in the sequence
					output += 'device ' + (i+d) + ' device' + (i+d) + '\n' ;
					d++;
				}
				output += 'device ' + devs[i] + ' osd.' + devs[i] + '\n' ;
			}
			return output;
		};

		devsObj.json = function() {
			var output = [];
			for (var i = 0; i < devs.length; i++)
				output.push({'id': devs[i], 'name': 'osd.'+devs[i]});
			return output;
		};

		devsObj.rawList = function() {
			return devs;
		};

		devsObj.init = function() {
			devs = [];
		};

		return devsObj;
	};
