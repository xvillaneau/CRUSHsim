
// ====================================================================
// CRUSHSim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
// 
// By Xavier Villaneau, 2015
// xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// editor.js - Interactivity for the editor page
//  - Fetches the CRUSH map and uses D3 to display it as a graph
//  - Handles all interactions with the graph, updates it and the
//    CRUSH map accordingly
//  - Allows the updated map to be submitted to the server
//
// Changelog:
// ----------
// May 4th 2015 - Initial release


// Image height and width calculation
var width = d3.select('#clustermap')[0][0].clientWidth - 30,
    height = 840,
    radius = Math.min(width, height) / 2;

// D3 ranges
// x -> Angle (linear)
var x = d3.scale.linear()
	.range([0, 2 * Math.PI]);
// y -> Radius (sqrt for nice effect, large in the center and narrows dows when going out)
var y = d3.scale.sqrt()
	.range([0, radius]);

var svg = d3.select("#clustermap").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var partition = d3.layout.partition()
    .sort(null)
    .value(function(d) { return 1; });

var arc = d3.svg.arc()
    .startAngle(function(d) { return x(d.x); })
    .endAngle(function(d) { return x(d.x + d.dx); })
    .innerRadius(function(d) { return y(d.y - 0.5 * d.dy); })
    .outerRadius(function(d) { return y(d.y + 0.5 * d.dy); });

var infopanel = d3.select('#node-info');
var actionpanel = d3.select('#node-actions');

var active = null;

var minIndex = -1;
var maxIndex = 0;
var crushTypes = [];
var crushData = {};

// Loads the json-ified raw CRUSH data
d3.json(crushDataUrl, function(error, dataCrush) {
    if (typeof dataCrush != 'undefined') {
        
        // Put all the data in the global variable
        crushData = dataCrush;

        // Let's get the highest OSD ID
        // We'll use it later when creating a new OSD
        maxIndex = Math.max.apply(null, dataCrush.devices);
        
        // Creating the list of bucket types
        // We'll assume the IDs are correctly ordered
        // But we'll sort them just in case
        var typesID = [];
        for (var k in dataCrush.types) {
            typesID.push(parseInt(k));
        };
        typesID.sort();

        for (var i in typesID) {
            crushTypes.push(dataCrush.types[i]);
        };

        // Now all we need is the smallest bucket index
        for (var b in dataCrush.buckets) {
            if (dataCrush.buckets[b].id < minIndex) {
                minIndex = dataCrush.buckets[b].id;
            };
        };
    };
});

// Loads the reorganized data, the tree structure is needed for D3.js
d3.json(crushTreeUrl, function(error, treeCrush) {
    if (typeof treeCrush != 'undefined' ) {
        svg.datum(treeCrush).selectAll("path")
            .data(partition.nodes)
          .enter().append("path")
            .attr("display", function(d) { return d.depth ? null : "none"; }) // hide inner ring
            .attr("d", arc)
            .style("stroke", "darkgrey")
            .style("fill", nodeColor)
            .on("click", click)
            .each(stash);
    };
});

// Centralized color management according to node status
function nodeColor(d) {
    if (typeof d.nodeStatus == 'undefined') {
        return d3.rgb("lightgrey")
    } else if (d.nodeStatus == 'new') {
        return d3.rgb("lightgreen")
    }
};

// Specific colors if node is selected
function nodeColorSelected(d) {
    if (typeof d.nodeStatus == 'undefined') {
        return d3.rgb("#a0a0a0")
    } else if (d.nodeStatus == 'new') {
        return d3.rgb("#47ee47")
    }
};

// Handles the updating of the graph
function updateGraph() {
    svg.selectAll('path')
        .data(partition.nodes)
      .enter().append("path")
        .style("stroke", "darkgrey")
        .on("click", click);
    path = svg.selectAll('path');
    path.attr("d", arc)
        .style("fill", nodeColor)
        .each(stash);
    path.data(partition.value(function(){return 1}).nodes)
      .transition() // The transition doesn't quite work right now, but it's not critical
        .duration(1500)
        .attrTween("d", arcTween);
};

// Handles click on a node
function click(d) {
    // Reset color of previous active node
    svg.selectAll("path")
        .filter(function(node) { return node == active })
        .style("fill", nodeColor);

    active = d;

    // Update control toolbar on the left
    infopanel.html('');
    infopanel.data(d);
    infopanel.append('h4').text(d.name);
    infopanel.append('ul');
    infopanel.select('ul').append('li').text("ID: "+d.id);
    infopanel.select('ul').append('li').text("Type: "+d.type);
    if (active.type == 'osd') {
        infopanel.select('ul').append('li').text("Size: "+d.size+"GB");
    };

    // Hide work forms, display buttons
    if (d.type != 'osd') {
        actionpanel.selectAll('.btn-add-node').classed('disabled', false);
    } else {
        actionpanel.selectAll('.btn-add-node').classed('disabled', true);
    }
    actionpanel.select('.form-add-bucket').style('display','none');
    actionpanel.select('.form-add-osd').style('display','none');

    //Set color of newly selected node
    svg.selectAll("path")
        .filter(function(node) { return node == active })   
        .style("fill", nodeColorSelected);
};

// Handles "Add child" button
// Displays "Add child" form and focuses the appropriate input
actionpanel.select('.btn-add-node').on('click', function() {
    d3.select('#btn-add-child').style('display','none');
    if (active.type == crushTypes[1]) {
        actionpanel.select('.form-add-osd').style('display','block');
        document.getElementById('new-osd-size').focus();
    } else {
        // Generate appropriate types options list
        var typeOptions = crushTypes.slice(1, crushTypes.indexOf(active.type));
        typeOptions.reverse();
        actionpanel.select('#new-bucket-type').html('');
        actionpanel.select('#new-bucket-type')
            .selectAll('option')
            .data(typeOptions)
          .enter().append('option')
            .attr('value', function(d) { return d })
            .text(function(d) { return d[0].toUpperCase() + d.slice(1); });

        actionpanel.select('.form-add-bucket').style('display','block');
        document.getElementById('new-bucket-name').focus();
    };
});

// Handles submit action on "Add bucket" form
actionpanel.select('.form-add-bucket').on('submit',function() {
    actionpanel.select('.form-add-bucket').style('display','none');
    minIndex -= 1;

    var treeObj = {};
    treeObj.nodeStatus = 'new';
    treeObj.type = document.getElementById('new-bucket-type').value;
    treeObj.name = document.getElementById('new-bucket-name').value; 
    treeObj.id = minIndex;
    if (typeof active.children == 'undefined') {
        active.children = [];
    }
    active.children.push(treeObj);

    var dataObj = {};
    dataObj.alg = 'straw'; // For future features
    dataObj.hash = '0'; // For future features
    dataObj.id = minIndex;
    dataObj.type = treeObj.type;
    dataObj.item = [];

    crushData.buckets[active.name].item.push({"name": treeObj.name});
    crushData.buckets[treeObj.name] = dataObj;

    updateGraph();
    d3.select('button.submit-changes').classed('disabled',false);
});

// Handles subit action on "Add OSD" form
actionpanel.select('.form-add-osd').on('submit', function() {
    actionpanel.select('.form-add-osd').style('display','none');
    maxIndex += 1;

    var treeObj = {};
    treeObj.nodeStatus = 'new';
    treeObj.type = 'osd';
    treeObj.size = parseInt(document.getElementById('new-osd-size').value); 
    treeObj.id = maxIndex;
    treeObj.name = "osd."+maxIndex;
    if (typeof active.children == 'undefined') {
        active.children = [];
    }
    active.children.push(treeObj);
    
    var dataObj = {};
    dataObj.name = treeObj.name;
    dataObj.weight = treeObj.size / 1000;
    crushData.buckets[active.name].item.push(dataObj);
    crushData.devices.push(maxIndex);
    // Not sure if all weights in the hierarchy should be updated...

    updateGraph();
    d3.select('button.submit-changes').classed('disabled',false);
});


d3.select('form.submit-changes').on('submit', function() {
    d3.xhr('/crushdata', 'application/json')
        .post(JSON.stringify(crushData), function(error, data) {return 0});
});

// Stash the old values for transition.
function stash(d) {
  d.x0 = d.x;
  d.dx0 = d.dx;
}

// Interpolate the arcs in data space.
function arcTween(a) {
  var i = d3.interpolate({x: a.x0, dx: a.dx0}, a);
  return function(t) {
    var b = i(t);
    a.x0 = b.x;
    a.dx0 = b.dx;
    return arc(b);
  };
}

//d3.select(self.frameElement).style("height", height + "px");

