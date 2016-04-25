# ====================================================================
# CRUSHsim - CRUSH Simulation web app for Ceph admins
# ---------------------------------------------------
#
# By Xavier Villaneau, 2015
# xvillaneau@gmail.com
# Claranet SAS, Rennes, France
# ====================================================================
# crushsim.py - Core Python script for the server
#  - Handles everything server-side
#  - All pages and valid URLs are defined here
#  - Manages the stored files and how they are accessed
#  - Calls crushtool to run the actual simulation
#


# Imports and initialization
# --------------------------

from __future__ import print_function
# Flask functions we'll need
from flask import Flask, render_template, request, \
                  send_from_directory, make_response, redirect
# Flask-Uploads for easier uploads
from flask.ext import uploads
# Other used libraries
from subprocess import Popen, PIPE
import uuid
import json
import os
from datetime import datetime
from . import default_cfg

app = Flask(__name__)


# Configuration management
# ------------------------

# Apply default configuration
app.config.from_object(default_cfg)

# Create the directory for temporary files if it doesn't exist
if not os.path.exists(app.config['FILES_DIR']):
    os.makedirs(app.config['FILES_DIR'])

# Create the subdirectories and store their paths for easier access
filedir = {}
for d in ['txt_maps', 'simulate']:
    filedir[d] = app.config['FILES_DIR'] + '/' + d + '/'
    if not os.path.exists(filedir[d]):
        os.makedirs(filedir[d])


# FlaskUpload configuration
app.config['UPLOADED_CRUSHUPLOAD_DEST'] = filedir['txt_maps']
crushupload = uploads.UploadSet('crushupload', uploads.TEXT)
uploads.configure_uploads(app, (crushupload))


# strftime filter for Jinja, for easier time handling
@app.template_filter('strftime')
def _jinja2_filter_datetime(timestamp, fmt=None):
    d = datetime.fromtimestamp(timestamp)
    tfmt = '%c'
    return d.strftime(tfmt)

# Flask Routing
# -------------


@app.route('/')
def page_home():
    return redirect('/app')


@app.route('/app')
def page_app():
    return render_template('app.html')


@app.route('/app/<crush_id>')
def page_app_id(crush_id):
    response = make_response(render_template('app.html'))
    response.set_cookie('map_id', crush_id)
    return response


@app.route('/api/simulate', methods=['PUT'])
def api_simulate():
    """
    Will run a simulation on the sent crushmap.
    So we're writing a file on the server then using an executable on it.
    Do I *really* have to explain why it can be dangerous ?
    But for now there's no way around it.
    """

    # Test the request and its payload
    # Is it text? Can it be read? Is it empty?
    if request.mimetype != "text/plain":
        return "Bad request, expecting CRUSH map", 400
    try:
        crushmap = request.get_data()
    except:
        return "Bad request, expecting CRUSH map", 400
    if (crushmap == ""):
        return "Bad request, expecting CRUSH map", 400

    # Now try to get the arguments
    try:
        args = request.args
    except:
        return "URL argument parsing has failed for some reason", 500

    # Test if rule and size are given. Otherwise, refuse to process
    if not ('rule' in args and args['rule'].isdigit()):
        return "Please specify a valid rule number to apply", 400
    if not ('size' in args and args['size'].isdigit()):
        return "Please specify a valid size to apply", 400

    # Assign a random uuid for the operation, build two filenames from it
    tid = str(uuid.uuid4())
    fntxtcrush = filedir['simulate'] + tid + '.txt'
    fnbincrush = filedir['simulate'] + tid + '.bin'

    # Now write the input we were given in the file
    with open(fntxtcrush, 'w') as ftxtcrush:
        ftxtcrush.write(crushmap)

    # Make it into a binary CRUSH map.
    # TODO: catch compilation error
    simcompstr = app.config['CRUSHTOOL_PATH'] + ' -c ' + fntxtcrush + \
        ' -o ' + fnbincrush
    app.logger.debug("API/Simulate - Executing " + simcompstr)
    Popen(simcompstr, shell=True).wait()

    os.remove(fntxtcrush)

    # Build options for the simulation
    options = ''
    options += ' --rule ' + args['rule']
    options += ' --num-rep ' + args['size']

    # If a certain number of PGs is asked, include it
    if 'pgs' in args and args['pgs'].isdigit():
        options += ' --min-x 0'
        options += ' --max-x ' + str(int(args['pgs']) - 1)

    # Now, only weights should remain
    for a in args.keys():
        if (a.startswith('osd.') and a[4:].isdigit()):
            # If argument is an OSD
            try:
                w = float(args[a])
            except ValueError:
                # If the value is not a float, go to next argument
                # TODO: send back 400 error, maybe ?
                continue
            if (w >= 0 and w <= 1):
                # If weight is valid
                options += ' --weight ' + a[4:] + ' ' + args[a]

    # Execute the simulation itself
    # TODO: catch simulation error
    simexecstr = app.config['CRUSHTOOL_PATH'] + " --test --show-mappings -i " \
        + fnbincrush + options
    app.logger.debug("API/Simulate - Executing " + simexecstr)
    simproc = Popen(simexecstr, shell=True, stdout=PIPE)
    output = simproc.stdout.read()

    os.remove(fnbincrush)

    # Everything went well (I hope), let's send the results!
    return output


@app.route('/api/crushmap', methods=['GET', 'POST'])
def api_crushmap():
    if request.method == 'GET':
        # Return JSON list of all maps and their metadata
        resp = make_response(json.dumps(get_saved_maps()))
        resp.mimetype = "application/json"
        return resp

    if request.method == 'POST':

        if 'crushTextFile' in request.files:
            # The request we're getting is for a brand new CRUSH map

            fileid = str(uuid.uuid4())

            # Upload text file to tmp/crushtxtfiles
            # The '.' at the end tells FlaskUpload to append file extension
            crushupload.save(request.files['crushTextFile'], name=fileid + '.')

            # Metadata handling
            metadata = {}
            if 'crushTextName' in request.form:
                metadata['name'] = request.form['crushTextName']

            redir = "/"
            if 'redirDest' in request.form:
                redir = request.form['redirDest']

            if len(metadata) > 0:
                md_json_path = filedir['txt_maps'] + fileid + '.metadata.json'
                with open(md_json_path, 'w') as mdf:
                    mdf.write(json.dumps(metadata))

            # flash('CRUSH map uploaded with ID ' + fileid, category='success')

            response = redirect(redir)
            response.set_cookie('map_id', fileid)

            return response


@app.route('/api/crushmap/<crush_id>', methods=['GET', 'PUT', 'DELETE'])
def api_crushmap_id(crush_id):
    if request.method == "GET":
        return send_from_directory(filedir['txt_maps'], crush_id + '.txt')

    if request.method == "PUT":
        try:
            inputdata = request.get_json()
        except:
            return "The given request is not valid JSON", 400

        md_json_path = filedir['txt_maps'] + crush_id + ".metadata.json"
        if os.path.isfile(md_json_path):
            with open(md_json_path) as mdfr:
                prevdata = json.loads(mdfr.read())
        else:
            prevdata = {}

        if "name" in inputdata:
            with open(md_json_path, 'w') as mdfw:
                prevdata.update(inputdata)
                mdfw.write(json.dumps(prevdata))

        resp = make_response("It worked!")
        return resp

    if request.method == "DELETE":
        filename = filedir['txt_maps'] + crush_id
        if os.path.isfile(filename + ".txt"):
            os.remove(filename + ".txt")
        if os.path.isfile(filename + ".metadata.json"):
            os.remove(filename + ".metadata.json")
        return 'Success, I think?'


# Useful functions
# ----------------

def crush_exists(crushid):
    return os.path.isfile(filedir['txt_maps'] + crushid + '.txt')


def crush_read_json(crushid):
    if not crush_exists(crushid):
        return False
    with open(filedir['json_maps'] + crushid + '.json') as f:
        return json.loads(f.read())


def get_saved_maps():
    """
    Returns a list of all stored CRUSH maps as dictionnaries.
    If a metadata file is present, its data will be included.
    """

    crushmaps = []

    files = os.listdir(filedir['txt_maps'])
    for f in files:
        if f.endswith('.txt'):
            # Take only the data files, not the metadata
            crushmap = {}

            # The most important: the UUID of the map
            crushmap['id'] = f[:-4]
            # The creation time of the map. TODO: Put it in the metadata ?
            file_path = filedir['txt_maps'] + f
            crushmap['modtime'] = int(os.path.getmtime(file_path))

            # Check if metadata file exists, if yes add data to the dictionnary
            md_json_path = filedir['txt_maps'] + crushmap['id'] \
                + ".metadata.json"
            if os.path.isfile(md_json_path):
                with open(md_json_path) as md:
                    crushmap.update(json.loads(md.read()))

            crushmaps.append(crushmap)

    # Finally, sort maps by creation time before returning the list
    return sorted(crushmaps, key=lambda k: k['modtime'])


# vim: set ts=4 sw=4 autoindent:
