
# ====================================================================
# CRUSHSim - CRUSH Simulation web app for Ceph admins
# ---------------------------------------------------
# 
# By Xavier Villaneau, 2015
# xavier.villaneau@fr.clara.net or xvillaneau@gmail.com
# Claranet SAS, Rennes, France
# ====================================================================
# crushsim.py - Core Python script for the server
#  - Handles everything server-side
#  - All pages and valid URLs are defined here
#  - Manages the stored files and how they are accessed
#  - Calls crushtool  to run the actual simulation
#
# Changelog:
# ----------
# May 4th 2015 - Initial release


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
from datetime import datetime


app = Flask(__name__)
app.config.from_pyfile('crushsim.cfg', silent= True)

# FlaskUpload configuration
app.config['UPLOADED_CRUSHUPLOAD_DEST'] = 'tmp/crushtxtfiles'
crushupload = uploads.UploadSet('crushupload', uploads.TEXT)
uploads.configure_uploads(app, (crushupload))

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
	if request.method == 'POST' and 'crushTextFile' in request.files:
		
		fileid = str(uuid.uuid4())
		
		# Upload text file to tmp/crushtxtfiles
		# The '.' at the end tells FlaskUpload to append file extension
		crushupload.save(request.files['crushTextFile'],name= fileid + '.')
		
		# Generate JSON data in tmp/crushjsondata
		with open('tmp/crushtxtfiles/'+fileid+'.txt') as crushfile:
			with open('tmp/crushjsondata/'+fileid+'.json','w') as jsonfile:
				crush_unwrap(crushfile, jsonfile)

		flash('CRUSH map uploaded with ID ' + fileid, category='success')
		
		return redirect('/editor/'+fileid)

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
			textpath = 'tmp/crushtxtfiles/' + fileid + '.txt'
			comppath = 'tmp/crushcompiled/' + fileid

			# Compile the CRUSH map
			if not os.path.isfile(comppath):
				call(['crushtool','-c',textpath,'-o',comppath])

			# Check for options
			options = ''
			if 'rule' in params.keys():
				fileid += '_r' + params['rule']
				options += ' --rule ' + params['rule']
			if 'size' in params.keys():
				fileid += '_n' + str(params['size'])
				options += ' --num-rep ' + str(params['size'])
 
			statpath = 'tmp/crushsimulations/' + fileid + '.txt'

			with open(str(statpath), 'w') as statfile:
				Popen("crushtool --test --show-statistics -i " + comppath + options, shell=True, stdout=statfile).wait()
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
	return send_from_directory('tmp/crushsimulations', sim_id + '.txt')
	

@app.route('/crushdata', methods=['GET','POST'])
def page_crushdata_noid():
	if request.method == 'GET':
		return "There should be a page here"

	if request.method == 'POST':

		# We'll force JSON input.
		# I might allow text CRUSH maps later, but I'm not sure about security here
		try:
			crushdata = json.loads(request.data)
		except TypeError:
			flash("Upload failed, data was not valid JSON", category='error')
			abort(415)

		fileid = str(uuid.uuid4())

		with open('tmp/crushjsondata/'+fileid+'.json','w') as crushjsonfile:
			crushjsonfile.write(request.data)

		if not os.path.isfile('tmp/crushtxtfiles/'+fileid+'.txt'):
			# The raw CRUSH file doesn't exist, so we'll create it
			crush_wrap(request.data, 'tmp/crushtxtfiles/'+fileid+'.txt')

		flash("New CRUSH map successfully uploaded with ID" + fileid)
		resp = make_response("It worked!") # TODO : Redirect to analyze page?
		resp.set_cookie('id_fin', value=fileid)
		return resp


@app.route('/crushdata/<crush_id>')
def crushdata_withid(crush_id): 
	if crush_id.endswith('.json'):
		return send_from_directory('tmp/crushjsondata', crush_id)
	else:
		return send_from_directory('tmp/crushtxtfiles', crush_id + '.txt')

@app.route('/crushtree/<crush_id>')
def crushtree(crush_id):

	if crush_id.endswith('.json'):
		# The output is going to be JSON anyway...
		crush_id = crush_id[:-5]
	
	if not crush_exists(crush_id):
		abort(404)
	
	with open('tmp/crushjsondata/' + crush_id + '.json') as crushfile:
		crushdata = json.loads(crushfile.read())

	return json.dumps(crush_makejsontree(crushdata['buckets']))

# Useful functions
# ----------------

def crush_exists(crushid):
	return os.path.isfile('tmp/crushtxtfiles/' + crushid + '.txt')

def crush_read_json(crushid):
	if not crush_exists(crushid):
		return False
	with open('tmp/crushjsondata/' + crushid + '.json') as f:
		return json.loads(f.read())

def get_saved_maps():
	files = os.listdir(app.config['UPLOADED_CRUSHUPLOAD_DEST'])
	crushmaps = []
	for f in files:
		crushmap = {}
		crushmap['id'] = f[:-4]
		crushmap['modtime'] = int(os.path.getmtime(app.config['UPLOADED_CRUSHUPLOAD_DEST'] + '/' + f))
		crushmaps.append(crushmap)
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
	server_addr = app.config['SERVER_ADDR'] if app.config['SERVER_ADDR'] else "127.0.0.1"
	server_port = app.config['SERVER_PORT'] if app.config['SERVER_PORT'] else 5000
	app.run(host= server_addr, port= server_port)

# EOF
