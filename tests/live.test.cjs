'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rehearsalFixture } = require('./helpers/rehearsal-fixture.cjs');
const { client, groupTarget, request, preview } = require('./helpers/persistence-fixture.cjs');
const fixture = data => rehearsalFixture(data, { live: true });

test('production bundle is owner-only with only the intended public endpoints', () => {
  const f = fixture(), manifest = JSON.parse(f.files['appsscript.json']);
  assert.equal(manifest.webapp.access, 'MYSELF');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  const names = Object.entries(f.files).filter(([name]) => name.endsWith('.js'))
    .flatMap(([, source]) => [...source.matchAll(/^function (\w+)\(/gm)].map(m => m[1])).filter(n => !n.endsWith('_'));
  assert.deepEqual(names, ['doGet', 'saveCollectionChanges']);
  for (const [name, source] of Object.entries(f.files)) {
    assert(!/Rehearsal|rehearsal|__mini|saveTestMode|createSimulator|Copy load timing|console\.debug|data-save-outcome/.test(source), name);
  }
  assert(!f.files['Scripts.html'].includes('miniV2DemoNotice'));
  assert(!f.files['Scripts.html'].includes('saves to test copy'));
  assert.equal(f.files['FastIndex.html'].split('/*COLLECTION_SNAPSHOT*/null').length, 2);
  assert(!f.files['FastIndex.html'].includes('<?'));
});

for (const email of ['', 'stranger@example.com']) test('live owner gate rejects ' + (email || 'blank identity'), () => {
  const f = fixture(); f.email = email;
  assert.match(f.server.doGet().html, /owner account/);
  assert.equal(f.send({}).code, 'FORBIDDEN');
  assert.equal(f.authChecks, 0);
  assert.deepEqual(f.base.trace, []);
});

test('live project, save switch and consent gates fail closed before any data access', () => {
  const f = fixture(); f.scriptId = 'other';
  assert.equal(f.send({}).code, 'FORBIDDEN');
  f.scriptId = f.settings.scriptId; f.enabled = false;
  assert.equal(f.send({}).code, 'DISABLED');
  assert.match(f.server.doGet().html, /Saving is temporarily unavailable/);
  f.enabled = true; f.consent = false;
  assert.equal(f.send({}).code, 'FORBIDDEN');
  const html = f.server.doGet().html;
  assert.match(html, /Allow saving/);
  assert.match(html, /legacy spreadsheet is not changed/);
  assert(!/test copy|test saves|rehearsal/i.test(html));
  assert.deepEqual(f.base.trace, []);
});

test('live save persists through reload without returning debug timing', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.notes = 'First line\n\nSecond line';
  const response = await c.send(request(target));
  assert.equal(response.ok, true);
  assert.equal(f.base.commits, 1);
  assert.equal(f.sent.length, 1);
  assert(!('timing' in response));
  assert.equal(client(f).initialState().groups[0].notes, target.value.notes);
  assert.equal(f.base.stored().receipts.length, 1);
});

test('live request cannot select another destination or collection', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.notes = 'Saved'; await c.send(request(target));
  assert.equal(f.send({ ...f.sent[0], requestId: 'new', spreadsheetId: 'elsewhere' }).code, 'INVALID');
  assert.equal(f.send({ ...f.sent[0], requestId: 'new2', collectionId: 'elsewhere' }).code, 'INVALID');
  assert.throws(() => f.server.collectionRuntime_().read('elsewhere', {}), /Wrong collection destination/);
  assert.throws(() => f.server.collectionRuntime_().commit('elsewhere', {}), /Wrong collection destination/);
  assert.equal(f.base.commits, 1);
});

test('live lost acknowledgment retries identically, without duplicate commit', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.notes = 'Only once'; const save = request(target); f.base.mode = 'lost';
  assert.equal((await c.send(save)).code, 'SAVE_UNCERTAIN');
  assert.equal((await c.send(save)).ok, true);
  assert.deepEqual(f.sent[0], f.sent[1]);
  assert.equal(f.base.commits, 1);
});

test('live stale client cannot silently overwrite another tab', async () => {
  const f = fixture(), a = client(f), b = client(f), first = groupTarget(a), second = groupTarget(b);
  first.value.name = 'A'; second.value.name = 'B';
  assert.equal((await a.send(request(first))).ok, true);
  assert.equal((await b.send(request(second))).code, 'STALE');
  assert.equal(f.base.commits, 1);
});

test('live errors show a code without exposing the raw Google error', () => {
  const f = fixture();
  f.base.runtime.read = () => { throw new Error('<script>private-value</script> Bearer secret'); };
  const page = f.server.doGet().html;
  assert.match(page, /READ_FAILED/);
  assert(!/private-value|Bearer secret|Google read detail/.test(page));
  assert.equal(f.base.commits, 0);
});

test('live fast rendering avoids evaluate and produces the same page as fallback', () => {
  const f = fixture(), template = f.server.HtmlService.createTemplateFromFile;
  let evaluations = 0;
  f.server.HtmlService.createTemplateFromFile = name => {
    const output = template(name), evaluate = output.evaluate;
    output.evaluate = function () { evaluations++; return evaluate.call(this); }; return output;
  };
  const fast = f.html(); assert.equal(evaluations, 0);
  f.files['FastIndex.html'] = 'missing snapshot slot';
  const fallback = f.html(); assert.equal(evaluations, 1);
  assert.equal(fast, fallback);
  assert(!/Startup|setServer|Copy load timing/.test(fast));
});

for (const failure of ['duplicate', 'output']) test('live renderer falls back on ' + failure, () => {
  const f = fixture();
  if (failure === 'duplicate') f.files['FastIndex.html'] += '/*COLLECTION_SNAPSHOT*/null';
  else f.server.HtmlService.createHtmlOutput = () => { throw new Error('private render detail'); };
  assert.equal(f.load().snapshot.groups[0].name, 'First Soldier');
  assert(!f.html().includes('private render detail'));
  assert.equal(f.base.commits, 0);
});

test('live snapshot escaping preserves literal note text, including rehearsal and slot text', () => {
  const data = preview();
  data.groups[0].notes = '</script><script>bad()</script> rehearsal\n/*COLLECTION_SNAPSHOT*/null $& $` \u2028';
  const f = fixture(data);
  assert.equal(f.load().snapshot.groups[0].notes, data.groups[0].notes);
  assert(!f.html().includes('</script><script>bad()'));
});
