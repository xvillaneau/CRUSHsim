# CRUSHSim

CRUSHSim is a small web-based tool intended for use by Ceph administrators, which builds a visualization of potential data movements in a Ceph cluster following any event that might change the output of the CRUSH algorithm: 
- topology update (new OSD, removed OSD)
- hardware failure
- modification of pool properties (CRUSH rule, number of replicas)
- modification of CRUSH rules

## Requirements

CRUSHSim has currently only been tested on **Ubuntu 14.04**. Feedback for any other system is welcome.

CRUSHSim requires :
- Python Flask
- Flask-Uploads
- the `crushtool` utility

The two firsts requirements can be installed with `pip`:
```
pip install Flask
pip install Flask-Uploads
```
You may want to run Flask in a virtual environment, as described in the [Flask documentation](http://flask.pocoo.org/docs/0.10/installation/). The `venv` directory is already set in `.gitignore`.

The `crushtool` binary executable is included with Ceph, and CRUSHSim will by default look for it in `/usr/bin`. However, it seems that `crushtool` works well as a standalone tool. Therefore, you may copy the binary from another system with the same architecture (or build it, whatever) and use it for CRUSHSim without having to install the entire Ceph software. See *Configuration*.

CRUSHSim includes the following libraries:
- Bootstrap
- jQuery
- D3.js
- Math.js
- js-cookie

## Usage

The _Edit_ page allows you to upload an existing decompiled CRUSH map. You may then edit it using the graphic editor (which is currently quite limited) or upload another CRUSH map.

The _Analyze_ page allows you to decide between which states you want to run the test. You may chose the same CRUSH map and change the pool settings, keep the pool settings and change the map, or both. Then, a graph will show you a visualization of CRUSH placement changes (in numbers of changes, among 1024 tests).

## Configuration

Right now, CRUSHSim allows a few things to be configured, and this is done by setting the appropriate Python variables in `crushsim.cfg` in the root directory of the project.

**Important:** You **MUST** set the `SECRET_KEY` variable before starting CRUSHSim. It will exit with an error if that's not the case.

The available options are:
- `SERVER_ADDR`: Defines the hostname for the server. I added this because Flask's `SERVER_NAME` doesn't allow a specific IP to be defined. Defaults to "127.0.0.1".
- `SERVER_PORT`: Defines the port for the server. This must be an integer. Defaults to 7180.
- `CRUSHTOOL_PATH`: Allows to specify the path to the `crushtool` executable. Defaults to `/usr/bin/crushtool`.
- `FILES_DIR`: Path to the directory that will hold all temporary files (CRUSH maps, test results...). Defaults to `tmp`.

Also, any other [Flask built-in variable](http://flask.pocoo.org/docs/0.10/config/) can also be set (`'DEBUG' = True` for example).

## What works and what doesn't

Currently, the graph only displays the differences between two sets of data placement. These placements are given by `crushtool test` and are simply compared. This is however not representative of the actual network traffic that might occur.

Also, only minor modifications of the CRUSH map are currently supported. Moving a bucket is not supported. Buckets or devices that are different in the final and initial states may not share the same names or IDs. And that's only a few exceptions to name.

This tool is a _Proof-of-Concept_ and not an actual reliable Ceph utility. You **MUST NOT** rely on it to disprove possibility of data loss on a running Ceph cluster. 

