'use strict';
const assert = require('node:assert/strict');

function replace(source, before, after = '') {
  assert.equal(source.split(before).length, 2, 'Live build source changed: ' + before.slice(0, 80));
  return source.replace(before, () => after);
}
function removeMatch(source, pattern, label) {
  const matches = source.match(pattern);
  assert.equal(matches?.length, 1, 'Live build source changed: ' + label);
  return replace(source, matches[0]);
}

function finishLive(files, read) {
  let scripts = files['Scripts.html'];
  scripts = removeMatch(scripts, /              <button type="button" class="mini-v2-demo-note"[\s\S]*?              <\/button>\n/g, 'rehearsal notice trigger');
  scripts = removeMatch(scripts, /        <div id="miniV2DemoNotice"[\s\S]*?        <\/div>\n(?=      `;)/g, 'rehearsal notice body');
  scripts = replace(scripts, '      root.querySelector(\'[data-summary-panel="demo"]\').setAttribute("aria-expanded", expanded("demo"));\n');
  scripts = removeMatch(scripts, /    if \(INITIAL_STATE.saveTestMode === true\) window\.__miniSaveTest = \{[\s\S]*?\n    \};\n/g, 'test hook');
  scripts = replace(scripts, '    let nextSaveOutcome = "success";\n');
  scripts = replace(scripts, '      saveTransport.setOutcome?.(nextSaveOutcome); nextSaveOutcome = "success";\n');
  scripts = removeMatch(scripts, /      if \(node\.matches\('\[data-save-outcome\]'\)\) \{[\s\S]*?\n      \}\n/g, 'simulator handler');
  scripts = scripts.replaceAll('List changes save to the test collection.', 'List changes save to your collection.')
    .replaceAll('Save all pending miniature changes to the test collection, including groups hidden by filters.', 'Save all pending miniature changes, including groups hidden by filters.')
    .replaceAll('Save pending location changes to the test collection', 'Save pending location changes')
    .replaceAll('Save this group and its copies to the test collection', 'Save this group and its copies')
    .replaceAll('Test collection unavailable', 'Collection unavailable')
    .replaceAll('The test collection could not be loaded. No data was changed.', 'Your collection could not be loaded. No data was changed.')
    .replaceAll('check the rehearsal app authorization and its disposable storage tabs.', 'check Google authorization and the collection storage tabs.')
    .replaceAll('Reload test app', 'Reload collection');
  files['Scripts.html'] = scripts;

  let flow = files['SaveFlow.html'];
  const start = flow.indexOf('    function createSimulator('), end = flow.indexOf('    function differences(');
  assert(start > 0 && end > start);
  flow = flow.slice(0, start) + flow.slice(end);
  flow = replace(flow, ', createSimulator');
  flow = replace(flow, '    const keyOf = target => JSON.stringify([target.table, target.id]);\n');
  files['SaveFlow.html'] = flow.replace('Browser-only transport rehearsal. No Google calls or persistent browser storage.', 'Shared change comparison and conflict-resolution helpers.');

  let code = files['Code.js'];
  const reportStart = code.indexOf('function rehearsalReportTiming_('), reportEnd = code.indexOf('function rehearsalConsentPage_(');
  assert(reportStart > 0 && reportEnd > reportStart);
  code = code.slice(0, reportStart) + code.slice(reportEnd);
  code = replace(code, "  var detail = '';\n");
  code = replace(code, 'rehearsalRuntime_(function (message) { detail = message; }, timing)', 'rehearsalRuntime_(null, timing)');
  code = replace(code, "    rehearsalReportTiming_(timing, 'load', result);", "    console.warn('Collection load failed: ' + result.code);");
  code = replace(code, " + (detail ? '<h3>Google read detail</h3><pre style=\"white-space:pre-wrap\">' + rehearsalHtml_(detail) + '</pre>' : '')");
  code = replace(code, "  var report = rehearsalReportTiming_(timing, 'load', result);\n  output.append('<script>MiniRehearsalStartup.setServer(' + rehearsalJson_(report) + ');</script>');\n");
  code = replace(code, "  result.timing = rehearsalReportTiming_(timing, 'save', result);\n");
  code = code.replaceAll('Only the separately deployed rehearsal app includes this file.', 'Owner-only collection application. Configuration is generated server-side.')
    .replaceAll('Wrong rehearsal project', 'Wrong application project')
    .replaceAll('Test saving is off', 'Saving is temporarily unavailable')
    .replaceAll('Allow test saves', 'Allow saving')
    .replaceAll('The read check passed. Google now needs your permission to edit spreadsheets for the save rehearsal.', 'Google needs your permission to load and save your miniature collection.')
    .replaceAll('Google grants spreadsheet-wide permission, but this app is configured to write only to the disposable test copy. Your original collection is not connected.', 'Google grants spreadsheet-wide permission, but this app saves only to PPQ Miniature Tracker 2.0. Your legacy spreadsheet is not changed.')
    .replaceAll('PPQ Miniature Tracker - Test Save Access', 'PPQ Miniature Tracker - Allow Saving')
    .replaceAll('Private rehearsal', 'Private collection')
    .replaceAll('Rehearsal load check failed', 'Collection unavailable')
    .replaceAll('PPQ Miniature Tracker - Private Save Rehearsal', 'PPQ Miniature Tracker')
    .replaceAll('Only the collection owner can save in this test app.', 'Only the collection owner can save.');
  files['Code.js'] = code;
  files['RehearsalTransport.html'] = replace(files['RehearsalTransport.html'], "          if (response?.timing) console.debug('Rehearsal save timing', response.timing);\n");
  files['Index.html'] = replace(files['Index.html'], read('tools/rehearsal/Startup.html'));
  files['Index.html'] = replace(files['Index.html'], '    <script>MiniRehearsalStartup.ready();</script>\n');
  delete files['FastIndex.html'];
  const renamed = {};
  for (const [name, source] of Object.entries(files)) {
    renamed[name.replace('Rehearsal', 'Collection')] = source.replaceAll('Rehearsal', 'Collection')
      .replaceAll('rehearsal', 'collection').replaceAll('REHEARSAL', 'COLLECTION');
  }
  let fast = renamed['Index.html'];
  for (const name of ['Styles', 'SaveFlow', 'PersistenceClient', 'CollectionTransport', 'Scripts']) {
    fast = replace(fast, `<?!= collectionInclude_("${name}", loadTiming); ?>`, renamed[name + '.html']);
  }
  renamed['FastIndex.html'] = replace(fast, '<?!= snapshotJson ?>', '/*COLLECTION_SNAPSHOT*/null');
  for (const source of Object.values(renamed)) {
    assert(!/__mini|saveTestMode|data-save-outcome|createSimulator|MiniCollectionStartup|Copy load timing|saves to test copy|console\.debug/.test(source), 'Test-only feature leaked into live build');
  }
  return renamed;
}

module.exports = { finishLive };
