// Only the separately deployed rehearsal app includes this file.
var REHEARSAL_CONFIG_ = __REHEARSAL_CONFIG__;

function rehearsalAuthorize_() {
  if (ScriptApp.getScriptId() !== REHEARSAL_CONFIG_.scriptId) throw new Error('Wrong rehearsal project');
  var email = Session.getActiveUser().getEmail();
  if (!email || email.trim().toLowerCase() !== REHEARSAL_CONFIG_.ownerEmail) throw new Error('Owner access required');
}

function rehearsalConfig_() {
  return { enabled: true, spreadsheetId: REHEARSAL_CONFIG_.spreadsheetId,
    collectionId: REHEARSAL_CONFIG_.collectionId, ownerEmail: REHEARSAL_CONFIG_.ownerEmail, lockTimeoutMs: 5000 };
}

function rehearsalAuthInfo_() {
  return ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/spreadsheets']);
}

function rehearsalDiagnostic_(error) {
  return String(error && error.message ? error.message : 'No Google error detail was returned')
    .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '[redacted]').slice(0, 1200);
}

function rehearsalHtml_(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function rehearsalRuntime_(onReadError, timing) {
  var runtime = persistenceAdapterRuntime_(), commit = runtime.commit;
  runtime.services = Object.assign({}, runtime.services, { digest: function (text) {
    var start = Date.now();
    try { return rehearsalSha256_(text); }
    finally { if (timing) { timing.hashMs += Date.now() - start; timing.hashCalls++; } }
  } });
  runtime.read = function (id, options) {
    if (id !== REHEARSAL_CONFIG_.spreadsheetId) persistenceError_('FORBIDDEN', 'Wrong rehearsal destination');
    var start = Date.now();
    try { return rehearsalRead_(id, timing); }
    catch (error) { if (onReadError) onReadError(rehearsalDiagnostic_(error)); throw error; }
    finally { if (timing) timing.readMs += Date.now() - start; }
  };
  runtime.commit = function (id, batch) {
    rehearsalAuthorize_();
    if (REHEARSAL_CONFIG_.savesEnabled !== true) persistenceError_('DISABLED', 'Test saving is off');
    if (id !== REHEARSAL_CONFIG_.spreadsheetId) persistenceError_('FORBIDDEN', 'Wrong rehearsal destination');
    var start = Date.now();
    try { return commit(id, batch); }
    finally { if (timing) timing.writeMs += Date.now() - start; }
  };
  return runtime;
}

function rehearsalTiming_() { return { started: Date.now(), readMs: 0, writeMs: 0, hashMs: 0, hashCalls: 0 }; }

function rehearsalMeasure_(timing, key, action) {
  var started = Date.now();
  try { return action(); }
  finally { timing[key] = (timing[key] || 0) + Date.now() - started; }
}

function rehearsalReportTiming_(timing, operation, result) {
  var report = { operation: operation, totalMs: Date.now() - timing.started, readMs: timing.readMs,
    writeMs: timing.writeMs, hashMs: timing.hashMs, hashCalls: timing.hashCalls,
    readMethod: 'values-batch', metadataMs: timing.metadataMs || 0, valuesMs: timing.valuesMs || 0,
    formulaCheckMs: timing.formulaCheckMs || 0,
    outcome: result.ok ? 'ok' : result.code, replayed: !!result.replayed };
  if (operation === 'load') {
    ['authorizeMs', 'consentMs', 'loadMs', 'serializeMs', 'pageReadMs', 'pageBuildMs', 'templateMs', 'includeAuthMs', 'includeReadMs'].forEach(function (key) {
      report[key] = timing[key] || 0;
    });
    report.renderMethod = timing.renderMethod || 'template';
    if (timing.renderFallbackStage) report.renderFallbackStage = timing.renderFallbackStage;
  }
  // No record contents, identifiers, or credentials in execution timing logs.
  console.info(JSON.stringify(report));
  return report;
}

function rehearsalConsentPage_() {
  var auth = rehearsalAuthInfo_();
  if (auth.getAuthorizationStatus() !== ScriptApp.AuthorizationStatus.REQUIRED) return null;
  var url = auth.getAuthorizationUrl();
  if (!url || !/^https:\/\/(?:accounts|script)\.google\.com\//.test(url)) throw new Error('Google authorization link unavailable');
  return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><base target="_top">'
    + rehearsalInclude_('Styles') + '</head><body><div class="mini-v2" style="max-width:620px;margin:40px auto;padding:0 16px">'
    + '<section class="v2-card"><div class="v2-card-header">Allow test saves</div>'
    + '<div class="v2-card-body" style="display:flex;flex-direction:column;align-items:flex-start;gap:12px">'
    + '<p>The read check passed. Google now needs your permission to edit spreadsheets for the save rehearsal.</p>'
    + '<p>Google grants spreadsheet-wide permission, but this app is configured to write only to the disposable test copy. Your original collection is not connected.</p>'
    + '<a class="button" style="display:inline-block;text-decoration:none;padding:8px 14px;font-weight:700" target="_blank" rel="noopener noreferrer" href="'
    + rehearsalHtml_(url) + '">Allow test saves</a>'
    + '<p>After authorizing, return here and reload this tab.</p>'
    + '</div></section></div></body></html>').setTitle('PPQ Miniature Tracker - Test Save Access');
}

function doGet() {
  var timing = rehearsalTiming_();
  try { rehearsalMeasure_(timing, 'authorizeMs', rehearsalAuthorize_); }
  catch (_) { return HtmlService.createHtmlOutput('<h2>Private rehearsal</h2><p>Open this page with the collection owner account. No data was loaded or changed.</p>'); }
  if (REHEARSAL_CONFIG_.savesEnabled !== true) return HtmlService.createHtmlOutput('<h2>Test saving is off</h2><p>No data was loaded or changed.</p>');
  var consent = rehearsalMeasure_(timing, 'consentMs', rehearsalConsentPage_);
  if (consent) return consent;
  var detail = '';
  var result = rehearsalMeasure_(timing, 'loadMs', function () {
    return persistenceContractLoad_(rehearsalConfig_(), rehearsalRuntime_(function (message) { detail = message; }, timing));
  });
  if (!result.ok) {
    rehearsalReportTiming_(timing, 'load', result);
    return HtmlService.createHtmlOutput('<h2>Rehearsal load check failed</h2><p>No data was changed.</p><p>Code: '
      + rehearsalHtml_(result.code) + '</p>' + (detail ? '<h3>Google read detail</h3><pre style="white-space:pre-wrap">' + rehearsalHtml_(detail) + '</pre>' : ''));
  }
  var output = rehearsalPage_(result.snapshot, timing);
  var report = rehearsalReportTiming_(timing, 'load', result);
  output.append('<script>MiniRehearsalStartup.setServer(' + rehearsalJson_(report) + ');</script>');
  return output.setTitle('PPQ Miniature Tracker - Private Save Rehearsal');
}

function rehearsalPage_(snapshot, timing) {
  var json = rehearsalMeasure_(timing, 'serializeMs', function () { return rehearsalJson_(snapshot); });
  var stage = 'raw-file-read';
  try {
    // HtmlOutput processing removes the comment marker. Read raw template text first.
    var html = rehearsalMeasure_(timing, 'pageReadMs', function () {
      return HtmlService.createTemplateFromFile('FastIndex').getRawContent();
    });
    stage = 'snapshot-slot';
    var parts = html.split('/*REHEARSAL_SNAPSHOT*/null');
    if (parts.length !== 2) throw new Error('Expected exactly one snapshot slot');
    stage = 'output-construction';
    var output = rehearsalMeasure_(timing, 'pageBuildMs', function () {
      // Insert once: user text must not be interpreted as replacement syntax or HTML.
      return HtmlService.createHtmlOutput(parts[0] + json + parts[1]);
    });
    timing.renderMethod = 'raw-template';
    return output;
  } catch (_) {
    // Keep the independently working v9 loader; never log HTML-bearing exceptions.
    timing.renderMethod = 'template-fallback';
    timing.renderFallbackStage = stage;
  }
  var template = HtmlService.createTemplateFromFile('Index');
  template.snapshotJson = json;
  template.loadTiming = timing;
  return rehearsalMeasure_(timing, 'templateMs', function () { return template.evaluate(); });
}

// The request contains collection edits, never runtime, owner, or spreadsheet configuration.
function saveRehearsalChanges(request) {
  var timing = rehearsalTiming_();
  try { rehearsalAuthorize_(); }
  catch (_) { return { ok: false, code: 'FORBIDDEN', message: 'Only the collection owner can save in this test app.' }; }
  if (REHEARSAL_CONFIG_.savesEnabled !== true) return { ok: false, code: 'DISABLED', message: 'Test saving is off.' };
  if (rehearsalAuthInfo_().getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
    return { ok: false, code: 'FORBIDDEN', message: 'Google permission to save is missing. No write was attempted. Restore permission before retrying.' };
  }
  var result = persistenceContractSave_(request, rehearsalConfig_(), rehearsalRuntime_(null, timing));
  result.timing = rehearsalReportTiming_(timing, 'save', result);
  return result;
}

function rehearsalJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function rehearsalInclude_(name, timing) {
  timing = timing || {};
  rehearsalMeasure_(timing, 'includeAuthMs', rehearsalAuthorize_);
  if (['Styles', 'Scripts', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport'].indexOf(name) < 0) throw new Error('Unknown template');
  return rehearsalMeasure_(timing, 'includeReadMs', function () { return HtmlService.createHtmlOutputFromFile(name).getContent(); });
}
