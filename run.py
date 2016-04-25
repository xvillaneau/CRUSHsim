#!/usr/bin/python2.7

from crushsim import app

app.run(host=app.config['SERVER_ADDR'], port=app.config['SERVER_PORT'])
