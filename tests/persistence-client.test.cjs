'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture, client, preview, groupTarget, request, clone, read, repo } = require('./helpers/persistence-fixture.cjs');

test('load envelope has stable catalog IDs, original record tokens, blank fields and separate location eligibility', () => {
  const data = preview(); data.groups[0].race = '';
  const f = fixture(data), c = client(f), loaded = c.initialState();
  assert.equal(loaded.groups[0].race, ''); assert.equal(loaded.groups[0].copies[0].currentLocation, 'Encounter Box');
  assert.deepEqual(clone(loaded.homeLocations), ['Drawer']);
  assert.ok(loaded.choiceRecords.race.every(choice => /^[a-f\d-]{36}$/.test(choice.id)));
  assert.match(groupTarget(c).baseline, /^[a-f\d]{64}$/);
  assert.equal(Object.hasOwn(f.load().snapshot, 'receipts'), false);
});

test('location-only save uses IDs and saved baselines; reload confirms its destination', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.copies['one-01'].currentLocation = 'Drawer';
  const result = await c.send(request(target)); assert.equal(result.ok, true, JSON.stringify(result)); c.accept(result.result.records);
  assert.equal(f.sent[0].kind, 'saveLocations'); assert.equal(f.sent[0].preconditions.groups[0].token, target.baseline);
  assert.equal(f.sent[0].payload.copies[0].currentLocationId, f.stored().choices.find(choice => choice.value === 'Drawer').id);
  assert.equal(client(f).initialState().groups[0].copies[0].currentLocation, 'Drawer');
});

for (const mode of ['lost', 'malformed', 'failure']) test(`${mode}: retry sends identical wire bytes and maps new group/copy IDs once`, async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.id = 'draft-group'; target.before = null; target.baseline = ''; target.value.rootId = target.id;
  target.value.copies = { 'draft-copy': { id: 'draft-copy', sticker: '', miniNumber: '01', note: '', currentLocation: 'Drawer' } };
  const req = request(target); f.mode = mode;
  const first = await c.send(req); assert.equal(first.ok, false);
  const second = await c.send(req); assert.equal(second.ok, true, JSON.stringify(second)); c.accept(second.result.records);
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.commits, 1);
  const record = second.result.records[0]; assert.equal(record.id, 'draft-group');
  assert.match(record.value.rootId, /^[a-f\d-]{36}$/); assert.match(record.copyIds['draft-copy'], /^[a-f\d-]{36}$/);
  assert.equal(f.stored().groups.length, 3); assert.equal(f.stored().copies.length, 3);
});

test('reusing a submitted request with altered content never sends a different write', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c), req = request(target);
  req.targets[0].value.notes = 'First'; f.mode = 'lost'; await c.send(req);
  req.targets[0].value.notes = 'Different';
  const result = await c.send(req); assert.equal(result.ok, false); assert.equal(f.sent.length, 1); assert.equal(f.commits, 1);
});

test('saving another group never rebases an older draft token', async () => {
  const f = fixture(), c = client(f), one = groupTarget(c), two = groupTarget(c, 'two');
  one.value.notes = 'My draft'; two.value.notes = 'Other save';
  f.external('saveLocations', { rootId: 'one', copies: [{ id: 'one-01', currentLocationId: f.stored().choices.find(choice => choice.value === 'Drawer').id }] });
  const result = await c.send(request(two)); assert.equal(result.ok, true); c.accept(result.result.records);
  assert.equal(c.capture(one).baseline, one.baseline);
  const stale = await c.send(request(one)); assert.equal(stale.code, 'STALE');
  assert.equal(stale.latest[0].value.copies['one-01'].currentLocation, 'Drawer');
  assert.equal(stale.latest[0].conflicted, true); assert.notEqual(stale.latest[0].baseline, one.baseline);
});

test('overwrite uses observed tokens, and another concurrent change still blocks it', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c), location = f.stored().choices.find(choice => choice.value === 'Drawer').id;
  target.value.notes = 'Mine';
  f.external('saveLocations', { rootId: 'one', copies: [{ id: 'one-01', currentLocationId: location }] });
  const stale = await c.send(request(target)), latest = stale.latest[0];
  const retry = { ...target, before: latest.value, baseline: latest.baseline, value: { ...latest.value, notes: 'Mine' } };
  f.external('saveLocations', { rootId: 'one', copies: [{ id: 'one-01', currentLocationId: f.stored().choices.find(choice => choice.value === 'Encounter Box').id }] });
  const again = await c.send(request(retry)); assert.equal(again.code, 'STALE'); assert.equal(f.commits, 2);
});

test('discard adopts only a selected saved baseline, without a write or changing unrelated drafts', async () => {
  const f = fixture(), c = client(f), one = groupTarget(c), two = groupTarget(c, 'two');
  f.external('saveLocations', { rootId: 'one', copies: [{ id: 'one-01', currentLocationId: f.stored().choices.find(choice => choice.value === 'Drawer').id }] });
  const stale = await c.send(request(one)); c.accept(stale.latest);
  assert.equal(c.capture(one).baseline, stale.latest[0].baseline); assert.equal(c.capture(two).baseline, two.baseline);
  assert.equal(f.commits, 1);
});

test('Save All is one atomic ID-based batch, including a newly created group', async () => {
  const f = fixture(), c = client(f), first = groupTarget(c), second = groupTarget(c, 'two'), added = groupTarget(c);
  first.value.notes = 'First'; second.value.notes = 'Second';
  added.id = 'new'; added.baseline = ''; added.before = null; added.value.rootId = 'new';
  added.value.copies = { temp: { id: 'temp', miniNumber: '01', sticker: 'A02', currentLocation: 'Drawer', note: '' } };
  const result = await c.send(request([first, second, added])); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.sent[0].kind, 'saveBatch'); assert.equal(f.commits, 1); assert.equal(f.stored().receipts.length, 1);
  assert.equal(result.result.records[2].id, 'new'); assert.notEqual(result.result.records[2].value.rootId, 'new');
});

test('duplicate-sticker failure leaves the entire batch and input unchanged', async () => {
  const f = fixture(), c = client(f), first = groupTarget(c), second = groupTarget(c, 'two');
  first.value.notes = 'Unsaved'; second.value.copies['two-01'].sticker = 'A00';
  const req = request([first, second]), before = JSON.stringify(req);
  const result = await c.send(req); assert.equal(result.code, 'STICKER_CONFLICT');
  assert.equal(f.commits, 0); assert.equal(JSON.stringify(req), before); assert.equal(f.stored().groups[0].notes, '');
});

test('catalog add, rename, remove and restore keep stable IDs and do not rewrite assignments', async () => {
  const f = fixture(), c = client(f), human = c.initialState().choiceRecords.race.find(choice => choice.value === 'Human');
  async function save(before, value, id = before?.id || 'temp-choice') {
    const result = await c.send(request(c.capture({ table: 'lists:race', id, before, value })));
    assert.equal(result.ok, true, JSON.stringify(result)); c.accept(result.result.records); return result.result.records[0].value;
  }
  const renamed = await save(human, { ...human, value: 'Humans' }); assert.equal(renamed.id, human.id);
  const groupBefore = f.stored().groups[0]; assert.equal(groupBefore.raceId, human.id);
  const removed = await save(renamed, { ...renamed, hidden: true });
  const reload = client(f).initialState(); assert.equal(reload.choiceRecords.race.find(choice => choice.id === human.id).hidden, true);
  assert.equal(reload.groups[0].race, 'Humans');
  await save(removed, { ...removed, hidden: false });
  const created = await save(null, { id: 'temp-choice', value: 'Elf', hidden: false, home: false, locked: false });
  assert.match(created.id, /^[a-f\d-]{36}$/); assert.equal(f.stored().groups[0].raceId, human.id);
});

test('newly saved catalog choices resolve by ID when authoring a group', async () => {
  const f = fixture(), c = client(f);
  const created = await c.send(request(c.capture({ table: 'lists:set', id: 'new-set', before: null,
    value: { id: 'new-set', value: 'New Set', home: false, hidden: false, locked: false } })));
  c.accept(created.result.records);
  const target = groupTarget(c); target.value.set = 'New Set';
  const result = await c.send(request(target)); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.stored().groups[0].setId, created.result.records[0].value.id);
});

test('deleted group restore targets the original ID and rechecks active sticker assignments', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c), before = clone(target.value);
  target.value = null;
  const deleted = await c.send(request(target)); assert.equal(deleted.ok, true); c.accept(deleted.result.records);
  assert.equal(client(f).initialState().groups.length, 1);
  const restored = await c.send(request(c.capture({ table: 'groups', id: 'one', before: null, value: before })));
  assert.equal(restored.ok, true, JSON.stringify(restored)); assert.equal(f.sent.at(-1).kind, 'restoreGroup');
  assert.equal(restored.result.records[0].value.rootId, 'one'); assert.equal(f.stored().copies[0].id, 'one-01');
});

test('hidden copy history changes conflict even when visible values are equal', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  const temp = clone(target); temp.value.copies.extra = { id: 'extra', miniNumber: '02', sticker: '', note: '', currentLocation: 'Drawer' };
  const other = client(f), added = await other.send(request(temp)); other.accept(added.result.records);
  const remove = other.capture({ table: 'groups', id: 'one', before: added.result.records[0].value, value: clone(target.value) });
  assert.equal((await other.send(request(remove))).ok, true);
  const stale = await c.send(request(target)); assert.equal(stale.code, 'STALE'); assert.equal(stale.latest[0].conflicted, true);
  assert.deepEqual(clone(stale.latest[0].value), clone(target.before));
});

test('unauthorized envelopes expose no records, tokens or workbook access', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c); f.trace.length = 0; f.caller = '';
  const result = await c.send(request(target)); assert.equal(result.code, 'FORBIDDEN');
  assert.equal(result.snapshot, undefined); assert.deepEqual(f.trace, []);
  assert.equal(f.load().code, 'FORBIDDEN');
});

test('wire contract stays private and the client delegates network access to its injected transport', () => {
  assert.equal(JSON.parse(read('.clasp.json')).rootDir, '.local/live/app');
  assert.match(read('.claspignore'), /^!PersistenceClient\.html$/m);
  assert.doesNotMatch(read('Index.html'), /PersistenceClient/);
  assert.doesNotMatch(read('PersistenceClient.html'), /google\.script|fetch\s*\(|localStorage|sessionStorage/);
  for (const match of read('PersistenceContract.js').matchAll(/^function\s+(\w+)\(/gm)) assert.ok(match[1].endsWith('_'));
});

for (const corrupt of ['collection', 'request', 'identity', 'tokens', 'copy-fields', 'new-copy-mapping']) {
  test(`malformed ${corrupt} acknowledgment keeps the exact retry rather than treating it as saved`, async () => {
    const f = fixture(); let first = true;
    const c = client(f, async req => {
      const response = await f.send(req);
      if (!first) return response; first = false;
      if (corrupt === 'collection') response.collectionId = 'wrong';
      if (corrupt === 'request') response.requestId = 'wrong';
      if (corrupt === 'identity') response.result.rootId = 'two';
      if (corrupt === 'tokens') response.snapshot.tokens.groups = [];
      if (corrupt === 'copy-fields') response.snapshot.copies[0].note = null;
      if (corrupt === 'new-copy-mapping') response.result.createdCopies = [];
      return response;
    });
    const target = groupTarget(c); target.value.copies.temp = { id: 'temp', miniNumber: '02', sticker: '', currentLocation: 'Drawer', note: '' };
    const req = request(target), firstResult = await c.send(req);
    assert.equal(firstResult.code, 'SAVE_UNCERTAIN'); assert.equal(f.commits, 1);
    const retry = await c.send(req); assert.equal(retry.ok, true); assert.equal(retry.replayed, true);
    assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.commits, 1);
  });
}

test('explicitly restoring a remotely deleted entry saves its draft edits atomically', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.notes = 'Do not lose this'; f.external('deleteGroup', { rootId: 'one' });
  const conflict = await c.send(request(target)); assert.equal(conflict.code, 'STALE'); assert.equal(conflict.latest[0].value, null);
  const result = await c.send(request({ ...target, before: null, baseline: conflict.latest[0].baseline }));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(f.commits, 2);
  assert.equal(f.sent.at(-1).kind, 'restoreGroupAndSave');
  assert.equal(f.stored().groups[0].deletedAt, ''); assert.equal(f.stored().groups[0].notes, 'Do not lose this');
  assert.equal(f.stored().copies[0].id, 'one-01');
});

test('restoring a deleted group blocks if an active miniature now owns its sticker', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c), value = clone(target.value);
  const deleted = await c.send(request({ ...target, value: null })); c.accept(deleted.result.records);
  const two = groupTarget(c, 'two'); two.value.copies['two-01'].sticker = 'A00';
  assert.equal((await c.send(request(two))).ok, true);
  const restore = await c.send(request(c.capture({ table: 'groups', id: 'one', before: null, value })));
  assert.equal(restore.code, 'STICKER_CONFLICT'); assert.equal(f.commits, 2); assert.ok(f.stored().groups[0].deletedAt);
});

const imported = path.join(repo, '.local/import/import-readback.json');
test('real imported collection saves all 496 groups through the client contract and preserves 612 copies and historical blanks', { skip: !fs.existsSync(imported) }, async () => {
  const server = vm.createContext({}); vm.runInContext(read('Storage.js'), server);
  const importedSnapshot = JSON.parse(fs.readFileSync(imported, 'utf8'));
  const data = server.parseSpreadsheetPreview_(Object.fromEntries(importedSnapshot.destination.sheets.map(sheet => [sheet.title, sheet.values])));
  data.collectionId = 'bridge-test';
  const f = fixture(data), before = f.stored(), c = client(f), loaded = c.initialState();
  assert.equal(loaded.groups.length, 496); assert.equal(loaded.groups.flatMap(group => group.copies).length, 612);
  const targets = loaded.groups.map(group => {
    const before = { ...group, copies: Object.fromEntries(group.copies.map(({ rootId, home, ...copy }) => [copy.id, copy])) };
    return c.capture({ table: 'groups', id: group.rootId, before, value: { ...before, notes: before.notes + '\nContract rehearsal only.' } });
  });
  const req = request(targets); f.mode = 'lost'; assert.equal((await c.send(req)).code, 'SAVE_UNCERTAIN');
  const result = await c.send(req); assert.equal(result.ok, true, JSON.stringify(result)); c.accept(result.result.records);
  const after = f.stored(); assert.equal(f.commits, 1); assert.equal(after.receipts.length, 1);
  assert.deepEqual(after.copies, before.copies); assert.deepEqual(after.choices, before.choices);
  after.groups.forEach((group, index) => assert.deepEqual({ ...group, notes: before.groups[index].notes }, before.groups[index]));
  assert.deepEqual(f.sent[0], f.sent[1]);
  const reloaded = client(f).initialState().groups;
  assert.equal(reloaded.flatMap(group => group.copies).filter(copy => copy.currentLocation !== copy.home).length, 19);
});
