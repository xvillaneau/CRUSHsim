
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
			if (! isNaN(parseInt(l[1]))) devs.push(parseInt(l[1]));
		};

		devsObj.dump = function() {
			var output = '';
			for (var i = 0; i < devs.length; i++)
				output += 'device ' + devs[i] + ' osd.' + devs[i] + '\n' ;
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
