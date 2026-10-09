'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');

function replace(text, before, after, count = 1) {
  assert.equal(text.split(before).length - 1, count, 'Rehearsal template changed: ' + before.slice(0, 100));
  return text.split(before).join(after);
}

function buildFiles(config, { live = false } = {}) {
  assert(config.savesEnabled === true && ['scriptId', 'spreadsheetId', 'collectionId', 'ownerEmail'].every(key => typeof config[key] === 'string' && config[key]), 'Missing trusted rehearsal configuration');
  let scripts = read('Scripts.html');
  const oldBootstrap = scripts.slice(scripts.indexOf('    let persistenceTransport = null;'), scripts.indexOf('    if (INITIAL_STATE.loadError)'));
  assert(oldBootstrap.includes('Offline harness only') && oldBootstrap.includes('__miniPersistenceSend'));
  scripts = replace(scripts, oldBootstrap, `    let persistenceTransport = null;
    try {
      if (INITIAL_STATE.rehearsalMode !== true || !INITIAL_STATE.persistenceSnapshot) throw new Error("Rehearsal not configured");
      persistenceTransport = MiniRehearsalTransport.create(INITIAL_STATE.persistenceSnapshot);
      Object.assign(INITIAL_STATE, persistenceTransport.initialState());
    } catch (_) { INITIAL_STATE.loadError = true; }
`);
  const simulator = scripts.match(/    const saveTransport = persistenceTransport \|\| MiniSaveFlow\.createSimulator\([\s\S]*?\n    \]\);/g);
  assert.equal(simulator?.length, 1);
  scripts = replace(scripts, simulator[0], '    const saveTransport = persistenceTransport;');
  scripts = replace(scripts, '${previewMode ? "Preview" : "Demo"}<span>: ${previewMode ? "changes reset on reload" : "resets on reload"}</span>', 'Rehearsal<span>: saves to test copy</span>');
  scripts = replace(scripts, '${previewMode ? "Collection preview" : "Demo data"}: changes reset on reload. More information', 'Private rehearsal: saves go to the disposable test copy. More information');
  scripts = replace(scripts, '${previewMode ? "Real collection, temporary changes" : "Mock data only"}', 'Disposable test collection');
  const oldNotice = scripts.match(/          <p>\$\{previewMode \? "This preview reads[^\n]+<\/p>/g);
  assert.equal(oldNotice?.length, 1);
  scripts = replace(scripts, oldNotice[0], '          <p>Save, Create, Delete, Restore, and list changes persist in the disposable test copy. Your original collection is unchanged. Unsaved drafts are lost on reload.</p>');
  const trials = scripts.match(/          <details class="mini-v2-save-trials">[\s\S]*?<\/details>/g);
  assert.equal(trials?.length, 1);
  scripts = replace(scripts, trials[0], `          <button type="button" class="button" data-rehearsal-copy-timing>Copy load timing</button>
          <pre data-rehearsal-timing-text hidden tabindex="0" aria-label="Load timing report" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;font-size:11px"></pre>`);
  scripts = replace(scripts, 'Preview only. List changes reset on reload.', 'List changes save to the test collection.');
  scripts = replace(scripts, 'Apply all pending miniature changes in this page, including groups hidden by filters. Preview only; no spreadsheet changes.', 'Save all pending miniature changes to the test collection, including groups hidden by filters.');
  scripts = replace(scripts, 'Apply pending location changes in this browser until reload; no spreadsheet changes', 'Save pending location changes to the test collection');
  scripts = replace(scripts, 'Apply the shown group and copies in this browser until reload; no spreadsheet changes', 'Save this group and its copies to the test collection', 2);
  scripts = replace(scripts, 'Collection preview unavailable', 'Test collection unavailable');
  scripts = replace(scripts, 'The imported collection could not be loaded. No data was changed.', 'The test collection could not be loaded. No data was changed.');
  scripts = replace(scripts, 'check the Apps Script authorization and the 2.0 storage tabs.', 'check the rehearsal app authorization and its disposable storage tabs.');
  scripts = replace(scripts, 'Reload preview', 'Reload test app');
  const manifest = { timeZone: 'America/New_York', dependencies: { enabledAdvancedServices: [{ userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' }] },
    exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8', webapp: { executeAs: 'USER_DEPLOYING', access: 'MYSELF' },
    oauthScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo.email'] };
  const files = { 'appsscript.json': JSON.stringify(manifest, null, 2),
    'Code.js': replace(read('tools/rehearsal/Server.js'), '__REHEARSAL_CONFIG__', JSON.stringify(config)),
    'RehearsalHash.js': read('tools/rehearsal/Hash.js'),
    'RehearsalRead.js': read('tools/rehearsal/Read.js'),
    'Index.html': replace(read('tools/rehearsal/Index.html'), '<!--REHEARSAL_STARTUP-->', read('tools/rehearsal/Startup.html')),
    'RehearsalTransport.html': read('tools/rehearsal/Transport.html'),
    'Scripts.html': scripts, ...Object.fromEntries(['Styles.html', 'SaveFlow.html', 'PersistenceClient.html', 'Persistence.js', 'PersistenceAdapter.js', 'PersistenceContract.js'].map(name => [name, read(name)])) };
  let fastIndex = files['Index.html'];
  for (const name of ['Styles', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport', 'Scripts']) {
    fastIndex = replace(fastIndex, `<?!= rehearsalInclude_("${name}", loadTiming); ?>`, files[name + '.html']);
  }
  files['FastIndex.html'] = replace(fastIndex, '<?!= snapshotJson ?>', '/*REHEARSAL_SNAPSHOT*/null');
  assert.equal(files['FastIndex.html'].split('/*REHEARSAL_SNAPSHOT*/null').length, 2);
  assert(!files['FastIndex.html'].includes('<?'), 'Fast template has unexpanded scriptlets');
  return live ? require('./live.cjs').finishLive(files, read) : files;
}

module.exports = { buildFiles };
