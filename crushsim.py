
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

# Flask functions we'll need
from flask import Flask, url_for, render_template, flash, request, send_from_directory, make_response, redirect, abort
# Flask-Uploads for easier uploads
from flask.ext import uploads
# Other used libraries
from subprocess import call, Popen, PIPE
import uuid
import json
import re
import os
from sys import exit
from datetime import datetime


app = Flask(__name__)


# Configuration management
# ------------------------

# Get configuration from file
app.config.from_pyfile('crushsim.cfg', silent= True)

# Require the SECRET_KEY to be set
if not app.config['SECRET_KEY']:
	print "Please set the SECRET_KEY in crushsim.cfg"
	exit(1)

# Default custom configuration (those are not defined in Flask/Werkzeug)
defaultconf = {
	'SERVER_ADDR': '127.0.0.1',
	'SERVER_PORT': 7180,
	'CRUSHTOOL_PATH': '/usr/bin/crushtool',
	'FILES_DIR': 'tmp'
}

# Apply default configuration if not defined in the configuration file
for c in defaultconf.keys():
	if not c in app.config.keys():
		app.config[c] = defaultconf[c]

# Create the directory for temporary files if it doesn't exist
if not os.path.exists(app.config['FILES_DIR']):
	os.makedirs(app.config['FILES_DIR'])

# Create the subdirectories and store their paths for easier access
filedir = {}
for d in ['txt_maps','json_maps','compiled_maps','test_results', 'simulate']:
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
	tfmt='%c'
	return d.strftime(tfmt)

# Flask Routing
# -------------

@app.route('/')
def page_home():
	return render_template('home.html')


@app.route('/editor', methods=['GET','POST'])
def page_editor_list():
	return render_template('editor-list.html', crushmaps= get_saved_maps())


@app.route('/editor/<crushid>')
def page_editor(crushid):

	# The Input CRUSH map is automatically set to the one used before editing
	# Maybe this behaviour isn't practical... Can't tell for now
	flash("Input CRUSH map set to " + crushid, category='info')
	resp = make_response(render_template('editor.html', crushid= crushid))
	resp.set_cookie('id_ini', value=crushid)

	return resp

@app.route('/analyze', methods=['GET', 'POST'])
def page_analyze():

	if request.method == 'GET':
		# Displays the Analyze page
		return render_template('analyze.html', crushmaps= get_saved_maps())

	if request.method == 'POST':
		# Will get all simulation parameters in the cookies and do
		# many server-side checks before launching the simulation.

		params_ini = {}
		params_fin = {}
		for prop in ['id', 'rule', 'size', 'minsize'] :
			params_ini[prop] = request.cookies.get(prop +'_ini')
			params_fin[prop] = request.cookies.get(prop +'_fin')
			if not params_ini[prop]:
				return "The parameter '"+prod+"' for the initial map is missing !", 400
			if not params_fin[prop]:
				params_fin[prop] = params_ini[prop]

		def check_params(params):
			# Check if maps exist
			if not (crush_exists(params['id'])):
				return "The given CRUSH map ("+params['id']+") does not exist!", 404

			# Check if rule exists
			data = crush_read_json(params['id'])
			if not params['rule'] in data['rules'].keys():
				return "There is no ruleset " + params['rule'] + " in the CRUSH map!", 400

			# Check if the given sizes are valid integers and have coherent values
			try:
				params['size'] = int(params['size'])
				params['minsize'] = int(params['minsize'])
			except ValueError:
				return "The nominal and minimal sizes should be integers!", 400

			if params['size'] < params['minsize'] or params['minsize'] < 1:
				return "The nominal and minimal sizes are invalid!", 400

			return "It went well !", 200

		res = check_params(params_ini)
		if res[1] != 200:
			return res
		res = check_params(params_fin)
		if res[1] != 200:
			return res

		# Everything was successful! Now the simulation can actually be launched

		def make_simulation(params):
			fileid = params['id']
			textpath = filedir['txt_maps'] + fileid + '.txt'
			comppath = filedir['compiled_maps'] + fileid

			# Compile the CRUSH map
			if not os.path.isfile(comppath):
				call([app.config['CRUSHTOOL_PATH'],'-c',textpath,'-o',comppath])

			# Check for options
			options = ''
			if 'rule' in params.keys():
				fileid += '_r' + params['rule']
				options += ' --rule ' + params['rule']
			if 'size' in params.keys():
				fileid += '_n' + str(params['size'])
				options += ' --num-rep ' + str(params['size'])

			statpath = filedir['test_results'] + fileid + '.txt'

			with open(str(statpath), 'w') as statfile:
				Popen(app.config['CRUSHTOOL_PATH'] + " --test --show-statistics -i " + comppath + options, shell=True, stdout=statfile).wait()
			return fileid

		stats_ini = make_simulation(params_ini)
		stats_fin = make_simulation(params_fin)

		resp = make_response("Success!")
		resp.set_cookie('stats_ini', value= stats_ini)
		resp.set_cookie('stats_fin', value= stats_fin)

		return resp


@app.route('/results')
def page_results():
	return render_template('results.html')


@app.route('/simulation/<sim_id>')
def page_simulation(sim_id):
	return send_from_directory(filedir['test_results'], sim_id + '.txt')


@app.route('/onepageapp')
def page_onepageapp():
	return render_template('onepageapp.html')


@app.route('/onepageapp/<crush_id>')
def page_onepageapp_id(crush_id):
	response = make_response(render_template('onepageapp.html'))
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
	simcompstr = app.config['CRUSHTOOL_PATH'] + ' -c ' + fntxtcrush + ' -o ' + fnbincrush
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
	simexecstr = app.config['CRUSHTOOL_PATH'] + " --test --show-statistics -i " + fnbincrush + options
	app.logger.debug("API/Simulate - Executing " + simexecstr)
	simproc = Popen(simexecstr, shell=True, stdout=PIPE)
	output = simproc.stdout.read()

	os.remove(fnbincrush)

	# Everything went well (I hope), let's send the results!
	return output


@app.route('/api/crushmap', methods=['GET','POST'])
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
			crushupload.save(request.files['crushTextFile'],name= fileid + '.')

			# Metadata handling
			metadata = {}
			if 'crushTextName' in request.form:
				metadata['name'] = request.form['crushTextName']

			redir = "/"
			if 'redirDest' in request.form:
				redir = request.form['redirDest']

			if len(metadata) > 0:
				with open(filedir['txt_maps'] + fileid + '.metadata.json','w') as mdf:
					mdf.write(json.dumps(metadata))

			#flash('CRUSH map uploaded with ID ' + fileid, category='success')

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

		if os.path.isfile(filedir['txt_maps'] + crush_id + ".metadata.json"):
			with open(filedir['txt_maps'] + crush_id + ".metadata.json") as mdfr:
				prevdata = json.loads(mdfr.read())
		else:
			prevdata = {}

		if "name" in inputdata:
			with open(filedir['txt_maps'] + crush_id + ".metadata.json", 'w') as mdfw:
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


@app.route('/crushdata', methods=['GET','POST'])
def page_crushdata_noid():
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
			crushupload.save(request.files['crushTextFile'],name= fileid + '.')

			# Metadata handling
			metadata = {}
			if 'crushTextName' in request.form:
				metadata['name'] = request.form['crushTextName']

			if len(metadata) > 0:
				with open(filedir['txt_maps'] + fileid + '.metadata.json','w') as mdf:
					mdf.write(json.dumps(metadata))

			# Generate JSON data in tmp/crushjsondata
			with open(filedir['txt_maps'] + fileid + '.txt') as crushfile:
				with open(filedir['json_maps'] + fileid + '.json','w') as jsonfile:
					crush_unwrap(crushfile, jsonfile)

			flash('CRUSH map uploaded with ID ' + fileid, category='success')

			return redirect('/')

		else:
			try:
				crushdata = json.loads(request.data)
			except TypeError:
				flash("Upload failed, data was not valid JSON", category='error')
				abort(415)

			fileid = str(uuid.uuid4())

			with open(filedir['json_maps'] + fileid + '.json','w') as crushjsonfile:
				crushjsonfile.write(request.data)

			if not os.path.isfile(filedir['txt_maps'] + fileid + '.txt'):
				# The raw CRUSH file doesn't exist, so we'll create it
				crush_wrap(request.data, filedir['txt_maps'] + fileid + '.txt')

			flash("New CRUSH map successfully uploaded with ID" + fileid)
			resp = make_response("It worked!") # TODO : Redirect to analyze page?
			resp.set_cookie('id_fin', value=fileid)
			return resp


@app.route('/crushdata/<crush_id>', methods=['GET','PUT'])
def crushdata_withid(crush_id):
	if request.method == "GET":
		if crush_id.endswith('.json'):
			return send_from_directory(filedir['json_maps'], crush_id)
		else:
			return send_from_directory(filedir['txt_maps'], crush_id + '.txt')

	if request.method == "PUT":
		try:
			inputdata = request.get_json()
		except:
			return "The given request is not valid JSON", 400


		if os.path.isfile(filedir['txt_maps'] + crush_id + ".metadata.json"):
			with open(filedir['txt_maps'] + crush_id + ".metadata.json") as mdfr:
				prevdata = json.loads(mdfr.read())
		else:
			prevdata = {}

		if "name" in inputdata:
			with open(filedir['txt_maps'] + crush_id + ".metadata.json", 'w') as mdfw:
				prevdata.update(inputdata)
				mdfw.write(json.dumps(prevdata))

		resp = make_response("It worked!")
		return resp


@app.route('/crushtree/<crush_id>')
def crushtree(crush_id):

	if crush_id.endswith('.json'):
		# The output is going to be JSON anyway...
		crush_id = crush_id[:-5]

	if not crush_exists(crush_id):
		abort(404)

	with open(filedir['json_maps'] + crush_id + '.json') as crushfile:
		crushdata = json.loads(crushfile.read())

	return json.dumps(crush_makejsontree(crushdata['buckets']))

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
			# The creation time of the map. TODO: Maybe put it in the metadata ?
			crushmap['modtime'] = int(os.path.getmtime(filedir['txt_maps'] + f))

			# Check if a metadata file exists, if it does add its data to the dictionnary
			if os.path.isfile(filedir['txt_maps'] + crushmap['id'] + ".metadata.json"):
				with open(filedir['txt_maps'] + crushmap['id'] + ".metadata.json") as md:
					crushmap.update(json.loads(md.read()))

			crushmaps.append(crushmap)

	# Finally, sort maps by creation time before returning the list
	return sorted(crushmaps, key=lambda k: k['modtime'])


# Parse functions
# ---------------

def crush_unwrap(crushfile, jsonfile):
	"""
	Converts a human-readable CRUSH map file into a more computer-friendly dictionnary.
	Required parameter : file object to write into
	Output : CRUSH map dictionnary
	"""

	# Empty data declaration
	crushtunables = {}
	crushtypes = {}
	crushdevices = []
	crushbuckets = {}
	crushrules = {}

	# Variables for rule/bucket mode
	inrule = ''
	inbucket = ''

	for line in crushfile:
		# Keep only the interesting part of lines
		m = re.search('^\s*([\w\-{}\. ]*)', line)
		line = m.group(1)
		tmp = line.split(' ')

		if line == '':
			# Skip whole process if there is no useful information
			continue

		elif line == '}':
			# Get out of rule/bucket mode
			if inrule:
				crushrules[int(rule['ruleset'])] = rule
			inrule = ''
			inbucket = ''

		elif inrule:
			# Rule mode
			if tmp[0] == 'step':
				rule['step'].append(' '.join(tmp[1:]))
			else:
				rule[tmp[0]] = ' '.join(tmp[1:])

		elif inbucket:
			# Bucket mode
			if tmp[0] == 'item':
				item = {}
				item['name'] = tmp[1]
				item['weight'] = float(tmp[3])
				crushbuckets[inbucket]['item'].append(item)
			elif tmp[0] == 'id':
				crushbuckets[inbucket]['id'] = int(tmp[1])
			else:
				crushbuckets[inbucket][tmp[0]] = tmp[1]

		elif line.startswith('tunable '):
			# Tunable declaration
			crushtunables[tmp[1]] = tmp[2]

		elif line.startswith('type' ):
			# Type declaration
			crushtypes[int(tmp[1])] = tmp[2]

		elif line.startswith('device '):
			# OSD declaration
			crushdevices.append(int(tmp[1]))

		elif line.startswith('rule '):
			# Rule start
			inrule = tmp[1]
			rule = {}
			rule['name'] = inrule
			rule['step'] = [] # Must be an array to stay ORDERED

		else:
			# It should be a bucket... I hope
			inbucket = tmp[1]
			crushbuckets[inbucket] = {}
			crushbuckets[inbucket]['type'] = tmp[0]
			crushbuckets[inbucket]['item'] = []

	crushdata = {}
	crushdata['tunables'] = crushtunables
	crushdata['devices'] = crushdevices
	crushdata['types'] = crushtypes
	crushdata['buckets'] = crushbuckets
	crushdata['rules'] = crushrules

	jsonfile.write(json.dumps(crushdata))


def crush_wrap (crushdata, crushfilename):
	"""Converts a JSON-ified CRUSH map into text that can be compiled by crushtool.
	Parameters: The JSON data and the file path."""
	# TODO : it might be cleaner to ask for a previously opened file object

	data = json.loads(crushdata)

	def recursive_bucket_write(bucketname, crushdata, crushfile):
		"""Internal recursive function used to write the buckets in a specific order.
		This is necessary because a bucket must be declared before used as item of
		another hierarchically higher bucket."""

		b = crushdata[str(bucketname)]
		if ('item' in b.keys() and len(b['item']) > 0):
			# If the bucket has items
			for item in b['item']:
				if not item['name'].startswith('osd.'):
					# If it's not as OSD, go deeper in recursion to write it first
					recursive_bucket_write(item['name'], crushdata, crushfile)

		# All 'children' buckets have been taken care of, now the bucket itself can be written
		crushfile.write(b['type'] + ' ' + bucketname + ' {\n')
		crushfile.write('\tid ' + str(b['id']) + '\t\t# do not change unnecessarily\n')
		crushfile.write('\talg ' + b['alg'] + '\n')
		crushfile.write('\thash ' + b['hash'] + '\t# rjenkins1\n')
		for i in b['item']:
			if i['name'].startswith('osd.'):
				crushfile.write('\titem ' + i['name'] + ' weight ' + str(i['weight']) + '\n')
			else:
				crushfile.write('\titem ' + i['name'] + '\n') # We'll leave the weight out for now
		crushfile.write('}\n')

	with open(crushfilename,'w') as f:
		f.write('# begin crush map\n')
		f.write('# This file was generated automatically by CRUSHsim\n')

		f.write('\n# tunables\n')
		for t in data['tunables'].keys():
			f.write('tunable ' + t + ' ' + data['tunables'][t] + '\n')

		f.write('\n# devices\n')
		for d in data['devices']:
			f.write('device ' + str(d) + ' osd.' + str(d) + '\n')

		f.write('\n# types\n')
		typeids = [int(it) for it in data['types'].keys()]
		typeids.sort()
		for t in typeids:
			f.write('type ' + str(t) + ' ' + data['types'][str(t)] + '\n')

		f.write('\n# buckets\n')
		for bn in data['buckets'].keys():
			# Let's look for roots in order to start the recursive search
			# This assumes "root" is the highest hierarchy level... I could allow
			# more sophisticated architectures, but it's annoying so I'll do that later.
			b = data['buckets'][bn]
			if b['type'] == 'root':
				recursive_bucket_write(bn, data['buckets'], f)

		f.write('\n# rules\n')
		# It turns out crushtool is sensitive to the order of the rules,
		# and ignores the ruleset number ! They have to be written in te right order
		rulesets = [int(i) for i in data['rules'].keys()]
		rulesets.sort()
		for ri in rulesets:
			r = data['rules'][str(ri)]
			f.write('rule ' + r['name'] + ' {\n')
			f.write('\truleset ' + str(ri) + '\n')
			f.write('\ttype ' + r['type'] + '\n')
			f.write('\tmin_size ' + r['min_size'] + '\n')
			f.write('\tmax_size ' + r['max_size'] + '\n')
			for s in r['step']:
				f.write('\tstep ' + s + '\n')
			f.write('}\n')

		f.write('\n# end crush map\n')

def crush_makejsontree(crushbuckets):
	"""
	Generates a tree of the cluster map from "raw" CRUSH buckets data.
	Required for display of the map with D3.
	"""

	# We're only going to add one entry, so a shallow copy is enough
	buckets = crushbuckets.copy()

	# Find the roots of the CRUSH map
	roots = []
	for b in buckets:
		if buckets[b]['type'] == 'root':
			roots.append(b)

	# Add a "cluster" element to the buckets, used as entry point for the recursive search
	buckets['cluster'] = {}
	buckets['cluster']['item'] = [{'name': r} for r in roots]

	def recursive_tree_build(buckets, target):
		"""
		Recursive function used to build a tree dictionnary of the CRUSH map.
		Given the list of the buckets and an entry point, returns the tree from this point.
		"""

		tree = {}
		tree['name'] = target
		tree['children'] = []

		if target != 'cluster':
			# The 'cluster' entry is different: it doesn't exist in the actual
			# CRUSH map so it doesn't have any data. Otherwise, copy this data.
			tree['id'] = buckets[target]['id']
			tree['type'] = buckets[target]['type']

		for i in buckets[target]['item']:
			# Walk through the children of the target
			if i['name'].startswith('osd.'):
				# If it's an OSD, generate the entry
				tmp = {}
				tmp['id'] = int(i['name'][4:])
				tmp['name'] = i['name']
				tmp['type'] = 'osd'
				tmp['size'] = int(i['weight'] * 1000)
			else:
				# Otherwise, go one step further in recursion
				tmp = recursive_tree_build(buckets, i['name'])
			tree['children'].append(tmp)

		return tree

	return recursive_tree_build(buckets, 'cluster')

# Flask application launch
# ------------------------

if __name__ == '__main__':
	app.run(host= app.config['SERVER_ADDR'], port= app.config['SERVER_PORT'])

# vim: set ts=4 sw=4 autoindent:
