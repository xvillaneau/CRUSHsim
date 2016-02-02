
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// ====================================================================
// editor.js - Functions the live CRUSH editor
//

var editor = {}

editor.init = function() {
  $('#appEditor').show();
  editor.codemirror = CodeMirror(document.getElementById("appEditor"), {
    value: app.map.textMap()
  });
}

editor.close = function() {
  
}

// vim: set ts=4 sw=4 autoindent:
