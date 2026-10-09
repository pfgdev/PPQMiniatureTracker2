'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { rehearsalFixture } = require('./helpers/rehearsal-fixture.cjs');
const { client, groupTarget, request } = require('./helpers/persistence-fixture.cjs');
const { buildFiles } = require('../tools/rehearsal/build.cjs');

test('build is isolated, owner-only, and contains no mock save fallback or simulated controls', () => {
  const f = rehearsalFixture();
  const manifest = JSON.parse(f.files['appsscript.json']);
  assert.equal(manifest.webapp.access, 'MYSELF');
  assert.deepEqual(manifest.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo.email']);
  assert(!f.files['Scripts.html'].includes('createSimulator'));
  assert(!f.files['Scripts.html'].includes('data-save-outcome aria-label'));
  assert(!f.files['Index.html'].match(/const INITIAL_STATE = (.+)/)[1].includes('saveTestMode'));
  assert.equal(f.files['Index.html'].split('<?!= snapshotJson ?>').length, 2);
  const assetOrder = ['Styles', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport', 'Scripts']
    .map(name => f.files['Index.html'].indexOf(`rehearsalInclude_("${name}", loadTiming)`));
  assert(assetOrder.every((position, i) => position >= 0 && (!i || position > assetOrder[i - 1])));
  assert(f.files['Code.js'].includes('createTemplateFromFile'));
  assert(f.files['Code.js'].includes("createTemplateFromFile('FastIndex').getRawContent()"));
  assert.equal(f.files['FastIndex.html'].split('/*REHEARSAL_SNAPSHOT*/null').length, 2);
  assert(!f.files['FastIndex.html'].includes('<?'));
  assert.match(f.files['Scripts.html'], /saves to test copy/);
  assert(!f.files['Scripts.html'].includes('no spreadsheet changes'));
  const names = Object.entries(f.files).filter(([file]) => file.endsWith('.js'))
    .flatMap(([, source]) => [...source.matchAll(/^function (\w+)\(/gm)].map(match => match[1])).filter(name => !name.endsWith('_'));
  assert.deepEqual(names, ['doGet', 'saveRehearsalChanges']);
  assert.throws(() => buildFiles({ ...f.settings, savesEnabled: false }));
});

for (const email of ['', 'not-owner@example.com']) test('unauthorized caller cannot read, request consent, or save: ' + (email || 'blank'), () => {
  const f = rehearsalFixture(); f.email = email;
  assert.match(f.server.doGet().html, /owner account/);
  assert.equal(f.send({}).code, 'FORBIDDEN');
  assert.deepEqual(f.base.trace, []);
  assert.equal(f.authChecks, 0);
});

test('wrong project or disabled save config rejects without touching Sheets', () => {
  const f = rehearsalFixture(); f.scriptId = 'original-project';
  assert.equal(f.send({}).code, 'FORBIDDEN');
  f.scriptId = f.settings.scriptId; f.enabled = false;
  assert.equal(f.send({}).code, 'DISABLED');
  assert.match(f.server.doGet().html, /Test saving is off/);
  assert.deepEqual(f.base.trace, []);
});

test('missing write consent yields an authorization page and refuses direct RPC saves before reads', () => {
  const f = rehearsalFixture(); f.consent = false;
  const page = f.server.doGet().html;
  assert.match(page, /Allow test saves/);
  assert.match(page, /Google grants spreadsheet-wide permission/);
  assert.match(page, /&amp;next=2/);
  assert.equal(f.send({}).code, 'FORBIDDEN');
  assert.deepEqual(f.base.trace, []);
});

test('RPC commits through the adapter and reloads the saved state', async () => {
  const f = rehearsalFixture(), c = client(f);
  const target = groupTarget(c); target.value.notes = 'Durable rehearsal note';
  const response = await c.send(request(target));
  assert.equal(response.ok, true);
  assert.equal(f.base.commits, 1);
  assert.equal(client(f).initialState().groups[0].notes, 'Durable rehearsal note');
  assert.equal(f.base.stored().receipts.length, 1);
});

test('RPC rejects another collection or injected destination fields', async () => {
  const f = rehearsalFixture(), c = client(f); const target = groupTarget(c); target.value.notes = 'Before';
  await c.send(request(target));
  const good = f.sent[0], count = f.base.commits;
  assert.equal(f.send({ ...good, requestId: 'wrong-collection', collectionId: 'other' }).code, 'INVALID');
  assert.equal(f.send({ ...good, requestId: 'injected', spreadsheetId: 'original' }).code, 'INVALID');
  assert.equal(f.base.commits, count);
  assert.throws(() => f.server.rehearsalRuntime_().read('original', {}), /Wrong rehearsal destination/);
  assert.throws(() => f.server.rehearsalRuntime_().commit('original', {}), /Wrong rehearsal destination/);
});

test('lost acknowledgment retries the identical request and does not commit twice', async () => {
  const f = rehearsalFixture(), c = client(f), target = groupTarget(c);
  target.value.notes = 'Only once'; const save = request(target);
  f.base.mode = 'lost';
  assert.equal((await c.send(save)).code, 'SAVE_UNCERTAIN');
  assert.equal(f.base.commits, 1);
  assert.equal((await c.send(save)).ok, true);
  assert.deepEqual(f.sent[0], f.sent[1]);
  assert.equal(f.base.commits, 1);
});

test('two clients still get stale-record conflict protection through the public wrapper', async () => {
  const f = rehearsalFixture(), a = client(f), b = client(f);
  const first = groupTarget(a), second = groupTarget(b);
  first.value.name = 'Other tab'; second.value.name = 'My tab';
  assert.equal((await a.send(request(first))).ok, true);
  assert.equal((await b.send(request(second))).code, 'STALE');
  assert.equal(f.base.commits, 1);
});

test('read diagnostics remain escaped and token-redacted behind owner checks', () => {
  const f = rehearsalFixture();
  f.base.runtime.read = () => { throw new Error('<script>bad</script> Bearer secret-value ya29.token-value'); };
  const page = f.server.doGet().html;
  assert.match(page, /READ_FAILED/);
  assert.match(page, /&lt;script&gt;/);
  assert(!page.includes('secret-value') && !page.includes('ya29.'));
  assert.equal(f.base.commits, 0);
});

test('fallback load timing includes template and include work without exposing collection data', () => {
  const f = rehearsalFixture(); let now = 0;
  const template = f.server.HtmlService.createTemplateFromFile;
  f.server.HtmlService.createTemplateFromFile = name => {
    if (name === 'FastIndex') throw new Error('Fast file unavailable');
    return template(name);
  };
  f.server.Date = { now: () => now };
  f.server.Session.getActiveUser = () => ({ getEmail() { now += 3; return f.settings.ownerEmail; } });
  const read = f.server.HtmlService.createHtmlOutputFromFile;
  const reads = [];
  f.server.HtmlService.createHtmlOutputFromFile = name => {
    reads.push(name);
    const output = read(name), getContent = output.getContent;
    output.getContent = function () { now += 7; return getContent.call(this); };
    return output;
  };
  const page = f.server.doGet();
  const raw = page.html.match(/MiniRehearsalStartup\.setServer\((\{[^\n]+\})\);/)[1];
  const report = JSON.parse(raw);
  assert.equal(report.authorizeMs, 3);
  assert.equal(report.includeAuthMs, 15);
  assert.equal(report.includeReadMs, 35);
  assert.equal(report.templateMs, 50);
  assert.equal(report.totalMs, 53);
  assert.equal(report.renderMethod, 'template-fallback');
  assert.equal(report.renderFallbackStage, 'raw-file-read');
  assert.deepEqual(reads, ['Styles', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport', 'Scripts']);
  assert.equal(report.operation, 'load');
  assert.equal(report.outcome, 'ok');
  assert(!raw.includes(f.settings.ownerEmail) && !raw.includes(f.settings.spreadsheetId) && !raw.includes('First Soldier'));
  assert.equal(f.base.commits, 0);
  assert(!page.html.includes('<?'));
});

test('fast rendering reads the raw file before processing and reports timings without native template evaluation', () => {
  const f = rehearsalFixture(); let now = 0, evaluated = 0;
  f.server.Date = { now: () => now };
  const template = f.server.HtmlService.createTemplateFromFile;
  f.server.HtmlService.createTemplateFromFile = name => {
    const output = template(name), raw = output.getRawContent;
    output.getRawContent = function () { now += 7; return raw.call(this); };
    output.evaluate = () => { evaluated++; throw new Error('Unexpected evaluation'); };
    return output;
  };
  f.server.HtmlService.createHtmlOutputFromFile = () => { throw new Error('Processed file content loses markers'); };
  const create = f.server.HtmlService.createHtmlOutput;
  f.server.HtmlService.createHtmlOutput = html => { now += 11; return create(html); };
  const page = f.server.doGet().html;
  const report = JSON.parse(page.match(/MiniRehearsalStartup\.setServer\((\{[^\n]+\})\);/)[1]);
  assert.equal(report.renderMethod, 'raw-template');
  assert.equal(report.pageReadMs, 7);
  assert.equal(report.pageBuildMs, 11);
  assert.equal(report.templateMs, 0);
  assert.equal(report.totalMs, 18);
  assert(!report.renderFallbackStage);
  assert.equal(evaluated, 0);
  assert.equal(f.base.commits, 0);
});

for (const broken of ['missing', 'duplicate', 'output']) test('fast rendering falls back safely after ' + broken + ' failure', () => {
  const f = rehearsalFixture();
  const original = f.files['FastIndex.html'];
  if (broken === 'missing') f.files['FastIndex.html'] = original.replace('/*REHEARSAL_SNAPSHOT*/null', 'null');
  if (broken === 'duplicate') f.files['FastIndex.html'] = original + '/*REHEARSAL_SNAPSHOT*/null';
  if (broken === 'output') {
    f.server.HtmlService.createHtmlOutput = () => { throw new Error('Malformed HTML <script>private-value Bearer secret</script>'); };
  }
  const page = f.server.doGet().html;
  const report = JSON.parse(page.match(/MiniRehearsalStartup\.setServer\((\{[^\n]+\})\);/)[1]);
  assert.equal(report.renderMethod, 'template-fallback');
  assert.equal(report.renderFallbackStage, broken === 'output' ? 'output-construction' : 'snapshot-slot');
  assert(!page.includes('private-value') && !page.includes('Bearer secret'));
  assert.equal(f.load().snapshot.groups[0].name, 'First Soldier');
  assert.equal(f.base.commits, 0);
});

test('fast and fallback rendering produce the same page before timing metadata', () => {
  const f = rehearsalFixture();
  const fast = f.server.doGet().html.split('<script>MiniRehearsalStartup.setServer(')[0];
  f.files['FastIndex.html'] = 'missing slot';
  const fallback = f.server.doGet().html.split('<script>MiniRehearsalStartup.setServer(')[0];
  assert.equal(fast, fallback);
  assert.equal(f.base.commits, 0);
});

test('snapshot embedding preserves script-like text, slot text and replacement characters literally', () => {
  const { preview } = require('./helpers/persistence-fixture.cjs');
  const data = preview();
  const note = '</script><script>window.__injected=true;</script> & <?!= hello ?>\n/*REHEARSAL_SNAPSHOT*/null $& $\' $` \u2028\u2029';
  data.groups[0].notes = note;
  const f = rehearsalFixture(data);
  assert.equal(f.load().snapshot.groups[0].notes, note);
  assert(!f.html().includes('</script><script>window.__injected'));
  assert.equal(f.base.commits, 0);
});

test('page assets cannot bypass denied owner or missing consent gates', () => {
  const f = rehearsalFixture(), reads = [], read = f.server.HtmlService.createHtmlOutputFromFile;
  f.server.HtmlService.createHtmlOutputFromFile = name => { reads.push(name); return read(name); };
  f.email = '';
  assert.match(f.server.doGet().html, /owner account/);
  assert.deepEqual(reads, []);
  f.email = f.settings.ownerEmail; f.consent = false;
  assert.match(f.server.doGet().html, /Allow test saves/);
  assert.deepEqual(reads, ['Styles']);
  assert.deepEqual(f.base.trace, []);
});

test('private template includes still require owner access and enforce their allowlist', () => {
  const f = rehearsalFixture();
  assert.throws(() => f.server.rehearsalInclude_('Code'), /Unknown template/);
  f.email = '';
  assert.throws(() => f.server.rehearsalInclude_('Styles'), /Owner access required/);
  assert.deepEqual(f.base.trace, []);
});

test('Google bridge delegates the watchdog to the UI and accepts delayed callbacks only once', async () => {
  const f = rehearsalFixture(); let success, failure, seen;
  const runner = { withSuccessHandler(fn) { success = fn; return this; }, withFailureHandler(fn) { failure = fn; return this; }, saveRehearsalChanges(req) { seen = req; } };
  const context = vm.createContext({ setTimeout() { throw new Error('The UI owns the watchdog'); },
    google: { script: { run: runner } }, MiniPersistenceClient: { createTransport: options => options } });
  vm.runInContext(f.files['RehearsalTransport.html'].replace(/<\/?script>/g, ''), context);
  const send = vm.runInContext('MiniRehearsalTransport.create({}).send', context);
  assert.equal(vm.runInContext('MiniRehearsalTransport.create({}).confirmationTimeoutMs', context), 90000);
  const wire = { requestId: 'unchanged' }; const pending = send(wire);
  assert.equal(seen, wire);
  await new Promise(resolve => setImmediate(resolve));
  success({ ok: true }); failure(new Error('late'));
  assert.equal((await pending).ok, true);
});

test('Google bridge resolves both successful and failed RPC callbacks', async () => {
  const f = rehearsalFixture(); let callback, fail;
  const runner = { withSuccessHandler(fn) { callback = fn; return this; }, withFailureHandler(fn) { fail = fn; return this; }, saveRehearsalChanges() {} };
  const context = vm.createContext({ setTimeout, clearTimeout, google: { script: { run: runner } }, MiniPersistenceClient: { createTransport: options => options } });
  vm.runInContext(f.files['RehearsalTransport.html'].replace(/<\/?script>/g, ''), context);
  const send = vm.runInContext('MiniRehearsalTransport.create({}).send', context);
  const a = send({}); callback({ ok: true }); assert.equal((await a).ok, true);
  const b = send({}); fail(new Error('network')); assert.equal((await b).code, 'SAVE_UNCERTAIN');
});
