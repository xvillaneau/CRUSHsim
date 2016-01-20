
// ====================================================================
// CRUSHsim - CRUSH Simulation web app for Ceph admins
// ---------------------------------------------------
//
// By Xavier Villaneau, 2015
// xvillaneau@gmail.com
// Claranet SAS, Rennes, France
// ====================================================================
// opa-modal-editor.js - Functions for the editor modal
//

function showEditorModal() {
  var editor = $('#editorModal pre');
  editor.html(app.map.textMap());
  $('#editorModal').modal()
};

function initEditorModal() {
  document.getElementById('btnShowEditor').onclick = showEditorModal;
};

// vim: set ts=4 sw=4 autoindent:
