
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
  var test = crush.crushmap();
  test.init();
  res = test.parse(editor.codemirror.getValue());
  if (res) {
    // Reminder: parse returns error messages
    return false
  } else {
    app.map.init();
    app.map.parse(editor.codemirror.getValue());
    $('#appEditor').empty().hide();
    return true
  }
}

// vim: set ts=4 sw=4 autoindent:
