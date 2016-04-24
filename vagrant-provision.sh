#!/bin/bash

# Install requirements
apt-get update
apt-get install -y ceph git python-pip
pip install Flask Flask-Uploads

bin_dir=/opt/CRUSHsim
data_dir=/srv/CRUSHsim
# Install CRUSHsim
if [ -d $bin_dir ]; then rm -rf $bin_dir; fi
mkdir -p $bin_dir
git clone https://github.com/xvillaneau/CRUSHsim.git $bin_dir

mkdir -p $data_dir
chown -R www-data:www-data $data_dir

# Configure CRUSHsim
key=$(head -c 20 /dev/urandom | sha1sum | cut -d' ' -f1)
cat > $bin_dir/crushsim.cfg <<EOF
SECRET_KEY = '$key'
SERVER_ADDR = '0.0.0.0'
SERVER_PORT = 7180
FILES_DIR = '$data_dir'
EOF

sudo -u www-data /usr/bin/python2.7 $bin_dir/crushsim.py &
