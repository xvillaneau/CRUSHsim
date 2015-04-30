# CRUSHSim

CRUSHSim is a small web-based tool intended for use by Ceph administrators, which builds a visualization of potential data movements in a Ceph cluster following any event that might change the output of the CRUSH algorithm: 
- topology update (new OSD, removed OSD)
- hardware failure
- modification of pool properties (CRUSH rule, number of replicas)
- modification of CRUSH rules

## Requirements

CRUSHSim requires :
- Python Flask
- FlaskUpload
- the `crushtool` utility

CRUSHSim includes the following libraries
- Bootstrap
- jQuery
- D3.js
- Math.js
- js-cookie

## Usage

Before first use, the upload directories have to be created (I should really fix that)

The _Edit_ page allows you to upload an existing decompiled CRUSH map. You may then edit it using the graphic editor (which is currently quite limited) or upload another CRUSH map.

The _Analyze_ page allows you to decide between which states you want to run the test. You may chose the same CRUSH map and change the pool settings, keep the pool settings and change the map, or both. Then, a graph will show you a visualization of CRUSH placement changes (in numbers of changes, among 1024 tests).

## What works and what doesn't

Currently, the graph only displays the differences between two sets of data placement. These placements are given by `crushtool test` and are simply compared. This is however not representative of the actual network trafic that might occur.

Also, only minor modifications of the CRUSH map are currently supported. Moving a bucket is not supported. Buckets or devices that are different in the final and initial states may not share the same names or IDs. And that's only a few exceptions to name.

This tool is _Proof-of-Concept_ and not an actual reliable Ceph utility. You *MUST NOT* rely on it to disprove possibility of data loss on a running Ceph cluster.

