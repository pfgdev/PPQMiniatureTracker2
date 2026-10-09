// Diagnostic deployment only. No collection reader, writer, or save RPC is included.
var RENDER_PROBE_CONFIG_ = __RENDER_PROBE_CONFIG__;

function renderProbeAuthorize_() {
  if (ScriptApp.getScriptId() !== RENDER_PROBE_CONFIG_.scriptId) throw new Error('Wrong project');
  var email = Session.getActiveUser().getEmail();
  if (!email || email.trim().toLowerCase() !== RENDER_PROBE_CONFIG_.ownerEmail) throw new Error('Owner required');
}

function renderProbeError_(error) {
  // Google can include the entire HTML input in an exception. Never return it.
  var message = String(error && error.message || '');
  var code = /malformed.*html|html.*malformed/i.test(message) ? 'MALFORMED_HTML'
    : /snapshot slot/i.test(message) ? 'SNAPSHOT_SLOT'
    : /not found|no html file/i.test(message) ? 'FILE_NOT_FOUND'
    : /too large|limit exceeded|maximum/i.test(message) ? 'LIMIT'
    : /permission|authorization/i.test(message) ? 'PERMISSION' : 'UNCLASSIFIED';
  var line = message.match(/\bline\s*[:#]?\s*(\d{1,7})\b/i);
  return { code: code, messageLength: message.length, line: line ? Number(line[1]) : null };
}

function renderProbeStep_(trial, name, action) {
  var step = { name: name }, started = Date.now();
  trial.steps.push(step);
  try { var value = action(); step.ok = true; return value; }
  catch (error) { step.ok = false; step.error = renderProbeError_(error); throw error; }
  finally { step.ms = Date.now() - started; }
}

function renderProbeTrial_(report, name, action) {
  var trial = { name: name, steps: [] }, started = Date.now();
  report.trials.push(trial);
  try { action(trial); trial.ok = true; }
  catch (_) { trial.ok = false; }
  trial.totalMs = Date.now() - started;
}

function renderProbeJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function renderProbeEmbed_(html, json) {
  var parts = html.split('/*REHEARSAL_SNAPSHOT*/null');
  if (parts.length !== 2) throw new Error('Expected exactly one snapshot slot');
  return parts[0] + json + parts[1];
}

// Matches the working template's include boundary, without any persistence code.
function rehearsalInclude_(name) {
  renderProbeAuthorize_();
  if (['Styles', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport', 'Scripts'].indexOf(name) < 0) throw new Error('Unknown asset');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function renderProbeCompare_(trial, actual, expected, working) {
  trial.outputChars = actual.length;
  trial.matchesExpected = actual === expected;
  if (working !== undefined) {
    trial.matchesWorking = actual === working;
    if (actual !== working) trial.workingDelta = renderProbeWhitespaceDelta_(actual, working);
  }
  if (actual !== expected) {
    var at = 0, limit = Math.min(actual.length, expected.length);
    while (at < limit && actual.charCodeAt(at) === expected.charCodeAt(at)) at++;
    trial.firstDifference = at;
  }
}

function renderProbeWhitespaceDelta_(actual, working) {
  var a = 0, b = 0, edits = [], safe = true;
  while (a < actual.length && b < working.length) {
    if (actual.charCodeAt(a) === working.charCodeAt(b)) { a++; b++; continue; }
    var step = 0;
    for (var n = 1; n <= 8; n++) {
      if (/^[\t\r\n ]+$/.test(actual.slice(a, a + n)) && actual.slice(a + n, a + n + 80) === working.slice(b, b + 80)) { step = n; break; }
      if (/^[\t\r\n ]+$/.test(working.slice(b, b + n)) && working.slice(b + n, b + n + 80) === actual.slice(a, a + 80)) { step = -n; break; }
    }
    if (!step || edits.length >= 10) {
      return { whitespaceOnly: false, offset: a, workingOffset: b,
        candidateContext: actual.slice(Math.max(0, a - 24), a + 40), workingContext: working.slice(Math.max(0, b - 24), b + 40) };
    }
    var before = actual.slice(0, a);
    var inScript = before.lastIndexOf('<script') > before.lastIndexOf('</script>');
    var inStyle = before.lastIndexOf('<style') > before.lastIndexOf('</style>');
    safe = safe && !inScript && !inStyle;
    edits.push({ candidateOffset: a, workingOffset: b, added: step > 0 ? actual.slice(a, a + step) : '',
      removed: step < 0 ? working.slice(b, b - step) : '', outsideScriptAndStyle: !inScript && !inStyle,
      context: actual.slice(Math.max(0, a - 24), a + 40) });
    if (step > 0) a += step; else b -= step;
  }
  return { whitespaceOnly: a === actual.length && b === working.length, outsideScriptAndStyle: safe, edits: edits };
}

function renderProbeRun_() {
  renderProbeAuthorize_();
  var started = Date.now();
  var report = { probe: 3, scope: 'Synthetic HTML construction only; no collection reads or writes.',
    note: 'One pass per method; timings are not full page-load times. Baseline repeated last to expose warm-up effects.', trials: [] };
  var json, raw, expected, working;
  renderProbeTrial_(report, 'prepare', function (trial) {
    json = renderProbeStep_(trial, 'synthetic-serialization', function () {
      var data = { groups: [], copies: [] };
      var note = Array(641).join('x') + '\nSynthetic second line. </script> & $& $\' $` \u2028\u2029';
      for (var i = 0; i < 496; i++) data.groups.push({ id: 'synthetic-group-' + i, name: 'Synthetic group ' + i, notes: note });
      for (var j = 0; j < 612; j++) data.copies.push({ id: 'synthetic-copy-' + j, groupId: 'synthetic-group-' + (j % 496), sticker: '', notes: 'Synthetic copy' });
      return renderProbeJson_(data);
    });
    raw = renderProbeStep_(trial, 'read-unprocessed-static', function () {
      return HtmlService.createTemplateFromFile('Static').getRawContent();
    });
    expected = renderProbeStep_(trial, 'embed-synthetic-snapshot', function () { return renderProbeEmbed_(raw, json); });
    report.staticChars = raw.length;
    report.syntheticJsonChars = json.length;
    report.expectedChars = expected.length;
  });
  if (expected !== undefined) {
    var baseline = function (trial) {
      var template = renderProbeStep_(trial, 'create-template', function () { return HtmlService.createTemplateFromFile('Baseline'); });
      template.snapshotJson = json;
      template.loadTiming = {};
      var output = renderProbeStep_(trial, 'evaluate-template', function () { return template.evaluate(); });
      var content = renderProbeStep_(trial, 'get-content', function () { return output.getContent(); });
      if (working === undefined) working = content;
      renderProbeCompare_(trial, content, expected, working);
    };
    renderProbeTrial_(report, 'working-v9-template', baseline);
    renderProbeTrial_(report, 'failed-v10-static', function (trial) {
      var output = renderProbeStep_(trial, 'create-output-from-file', function () { return HtmlService.createHtmlOutputFromFile('Static'); });
      var html = renderProbeStep_(trial, 'get-content', function () { return output.getContent(); });
      trial.staticUnchanged = html === raw;
      trial.snapshotSlots = html.split('/*REHEARSAL_SNAPSHOT*/null').length - 1;
      var content = renderProbeStep_(trial, 'embed-snapshot', function () { return renderProbeEmbed_(html, json); });
      renderProbeStep_(trial, 'set-content', function () { output.setContent(content); });
      var actual = renderProbeStep_(trial, 'read-result', function () { return output.getContent(); });
      renderProbeCompare_(trial, actual, expected, working);
    });
    renderProbeTrial_(report, 'raw-then-create-output', function (trial) {
      var source = renderProbeStep_(trial, 'read-unprocessed-static', function () { return HtmlService.createTemplateFromFile('Static').getRawContent(); });
      var content = renderProbeStep_(trial, 'embed-snapshot', function () { return renderProbeEmbed_(source, json); });
      var output = renderProbeStep_(trial, 'create-output', function () { return HtmlService.createHtmlOutput(content); });
      var actual = renderProbeStep_(trial, 'read-result', function () { return output.getContent(); });
      renderProbeCompare_(trial, actual, expected, working);
    });
    renderProbeTrial_(report, 'single-print-template', function (trial) {
      var source = renderProbeStep_(trial, 'read-unprocessed-static', function () { return HtmlService.createTemplateFromFile('Static').getRawContent(); });
      var content = renderProbeStep_(trial, 'embed-snapshot', function () { return renderProbeEmbed_(source, json); });
      var template = renderProbeStep_(trial, 'create-print-template', function () { return HtmlService.createTemplate('<?!= pageHtml ?>'); });
      template.pageHtml = content;
      var output = renderProbeStep_(trial, 'evaluate-template', function () { return template.evaluate(); });
      var actual = renderProbeStep_(trial, 'read-result', function () { return output.getContent(); });
      renderProbeCompare_(trial, actual, expected, working);
    });
    renderProbeTrial_(report, 'manual-template-assembly', function (trial) {
      var source = renderProbeStep_(trial, 'read-unprocessed-baseline', function () { return HtmlService.createTemplateFromFile('Baseline').getRawContent(); });
      var content = renderProbeStep_(trial, 'expand-original-slots', function () {
        // Substitute only the original template, never the inserted data or assets.
        var slots = /<\?!= rehearsalInclude_\("(\w+)", loadTiming\); \?>|<\?!= snapshotJson \?>/g;
        return source.replace(slots, function (_, asset) { return asset ? rehearsalInclude_(asset) : json; });
      });
      var output = renderProbeStep_(trial, 'create-output', function () { return HtmlService.createHtmlOutput(content); });
      var actual = renderProbeStep_(trial, 'read-result', function () { return output.getContent(); });
      renderProbeCompare_(trial, actual, expected, working);
    });
    renderProbeTrial_(report, 'working-v9-template-repeat', baseline);
  }
  report.totalMs = Date.now() - started;
  return report;
}

function renderProbePage_(report) {
  var json = JSON.stringify(report, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><base target="_top">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1"><style>'
    + 'body{margin:0;background:#edf3f8;color:#20354f;font:15px Calibri,sans-serif}main{max-width:780px;margin:24px auto;padding:20px;background:#fafdff;border:1px solid #c5d7eb;border-radius:12px}'
    + 'h1{margin:0 0 12px;font-size:24px}button{padding:8px 14px;color:#20354f;background:#e8f0f8;border:1px solid #bfd1e6;border-radius:8px;cursor:pointer;font:inherit}'
    + 'pre{background:#f0f5fa;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}button:focus-visible,pre:focus-visible{outline:2px solid #3e73d9}@media(max-width:600px){main{margin:12px;padding:14px}}'
    + '</style></head><body><main><h1>Startup diagnostic</h1><p>No collection data was read or changed. Your regular app is unchanged.</p>'
    + '<button type="button" id="copy">Copy results</button><p id="status" role="status">Send these results back in chat. No Console needed.</p>'
    + '<pre id="report" tabindex="0">' + json + '</pre></main><script>'
    + 'document.getElementById("copy").addEventListener("click",async()=>{const report=document.getElementById("report");try{await navigator.clipboard.writeText(report.textContent);document.getElementById("status").textContent="Copied. Paste the results in chat.";}catch(_){report.focus();const range=document.createRange();range.selectNodeContents(report);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.getElementById("status").textContent="Results selected. Press Ctrl+C, then paste in chat.";}});'
    + '</script></body></html>').setTitle('PPQ - Private Startup Diagnostic');
}

function doGet() {
  try { renderProbeAuthorize_(); }
  catch (_) { return HtmlService.createHtmlOutput('<h2>Private diagnostic</h2><p>Open with the owner account. No data was accessed.</p>'); }
  return renderProbePage_(renderProbeRun_());
}
