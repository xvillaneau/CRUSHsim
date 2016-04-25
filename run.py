#!/usr/bin/python2.7

from __future__ import print_function
import os
from crushsim import app


config_tries = ['/etc/opt/crushsim.cfg', os.path.abspath('crushsim.cfg')]
for cfg_file in config_tries:
    try:
        app.config.from_pyfile(cfg_file)
        print("Found {}, importing settings.".format(cfg_file))
    except IOError:
        # Configuration file not found: ignore it
        pass
    except:
        # Something else happened
        raise

app.run(host=app.config['SERVER_ADDR'], port=app.config['SERVER_PORT'])
