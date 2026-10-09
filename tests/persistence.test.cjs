'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID, createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const services = () => ({ makeId: randomUUID, digest: text => createHash('sha256').update(text).digest('hex'),
  now: () => '2026-10-08T20:00:00.000Z' });

function fixture() {
  const server = vm.createContext({});
  vm.runInContext(read('Persistence.js'), server);
  const preview = { collectionId: 'local-rehearsal', stickerCatalog: ['A00', 'A01', 'A02', 'A03'],
    catalogs: { size: ['Medium'], creatureType: ['Humanoid'], sex: ['Male'], race: ['Human', 'n/a'],
      role: ['Melee'], home: ['Drawer'], currentLocation: ['Drawer', 'Encounter Box'],
      paint: ['Painted', 'Unpainted', 'Work in Progress'], set: ['Owned Set', 'Unused Set', 'n/a'] },
    groups: [{ rootId: 'old-root', name: 'Original mini', size: 'Medium', creatureType: 'Humanoid', sex: 'Male',
      race: '', role: 'Melee', home: 'Drawer', paint: 'Painted', set: 'Owned Set', setNumber: '4a', notes: '',
      copies: [{ id: 'old-01', rootId: 'old-root', miniNumber: '01', sticker: 'A00', currentLocation: 'Encounter Box', home: 'Drawer', note: 'Purple' },
        { id: 'old-02', rootId: 'old-root', miniNumber: '02', sticker: 'n/a', currentLocation: 'Drawer', home: 'Drawer', note: '' }] }] };
  const state = server.migratePreviewForPersistence_(preview, randomUUID);
  return { server, preview, state };
}
function choice(state, field, value) { return state.choices.find(item => item.field === field && item.value === value).id; }
function payload(state, rootId = 'old-root') {
  const group = state.groups.find(item => item.rootId === rootId);
  const { deletedAt, rootId: id, ...fields } = clone(group);
  return { rootId: id, fields, copies: state.copies.filter(copy => copy.rootId === id && !copy.deletedAt)
    .map(({ id, sticker, currentLocationId, note }) => ({ id, clientKey: id, sticker, currentLocationId, note })) };
}
function newGroup(state) {
  const value = payload(state);
  value.rootId = ''; value.fields.raceId = choice(state, 'race', 'Human');
  value.copies = [{ id: '', clientKey: 'draft-1', sticker: '', note: '', currentLocationId: choice(state, 'location', 'Drawer') }];
  return value;
}
function request(state, kind, payload, extra = {}) {
  return { collectionId: state.collectionId, expectedRevision: state.revision, requestId: randomUUID(), kind, payload, ...extra };
}
function change(server, state, kind, payload, extra) {
  return server.preparePersistenceChange_(state, request(state, kind, payload, extra), services());
}
function rejectsUnchanged(server, state, req, code, suppliedServices = services()) {
  const before = JSON.stringify(state), beforeRequest = JSON.stringify(req);
  assert.throws(() => server.preparePersistenceChange_(state, req, suppliedServices), error => error.code === code);
  assert.equal(JSON.stringify(state), before, 'failure must leave stored data untouched');
  assert.equal(JSON.stringify(req), beforeRequest, 'failure must leave the draft untouched');
}
function scopedRequest(server, state, kind, value) {
  return request(state, kind, value, { preconditions: server.persistencePreconditions_(state, kind, value, services()) });
}
function batchItem(clientKey, value, kind = 'saveGroup') { return { clientKey, kind, payload: value }; }
function twoGroups() {
  const { server, state } = fixture(), value = newGroup(state);
  value.copies[0].sticker = 'A01';
  const second = change(server, state, 'saveGroup', value);
  return { server, state: second.state, second: second.result.rootId };
}

test('migration preserves every imported field and identity; adds stable catalog references without mutating input', () => {
  const { server, state, preview } = fixture();
  assert.deepEqual(clone(server.projectPersistencePreview_(state)), preview.groups);
  assert.equal(state.revision, 0); assert.equal(state.receipts.length, 0);
  assert.ok(state.choices.every(item => /^[a-f\d-]{36}$/i.test(item.id)));
  assert.equal(state.groups[0].raceId, '');
  assert.ok(state.choices.some(item => item.field === 'race' && item.value === 'Not specified'));
  assert.equal(state.choices.filter(item => item.field === 'location').length, 2);
  assert.equal(state.choices.find(item => item.value === 'Encounter Box').home, false);
  const before = JSON.stringify(preview);
  server.migratePreviewForPersistence_(preview, randomUUID);
  assert.equal(JSON.stringify(preview), before);
});

test('Save changes only its group; omissions, literal notes, current locations and opaque IDs survive', () => {
  const { server, state } = fixture(), value = payload(state), before = JSON.stringify(state);
  value.fields.name = 'Renamed mini'; value.fields.notes = '=SUM(1,2) <script> literal note';
  const result = change(server, state, 'saveGroup', value);
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.state.groups[0].rootId, 'old-root');
  assert.equal(result.state.groups[0].raceId, '');
  assert.equal(result.state.groups[0].notes, value.fields.notes);
  assert.equal(result.state.copies[0].currentLocationId, state.copies[0].currentLocationId);
  assert.equal(result.result.revision, 1);
  assert.equal(result.state.receipts.length, 1);
});

test('creation generates independent UUIDs and permits same-name variants, blank stickers, and explicit n/a', () => {
  const { server, state } = fixture(), value = newGroup(state);
  value.fields.paintId = choice(state, 'paint', 'Unpainted');
  value.copies.push({ ...value.copies[0], clientKey: 'draft-2', sticker: 'n/a' });
  const result = change(server, state, 'saveGroup', value);
  assert.equal(result.state.groups.length, 2);
  assert.equal(result.state.groups[0].name, result.state.groups[1].name);
  assert.notEqual(result.state.groups[0].paintId, result.state.groups[1].paintId);
  assert.match(result.result.rootId, /^[a-f\d-]{36}$/i);
  assert.equal(result.result.createdCopies.length, 2);
  assert.deepEqual(result.result.createdCopies.map(copy => copy.clientKey).join(','), 'draft-1,draft-2');
  assert.equal(result.state.copies[2].miniNumber, '01');
  assert.equal(result.state.copies[3].miniNumber, '02');
});

test('a discarded new draft has no stored record, request receipt, or tombstone', () => {
  const { server, state } = fixture(), before = JSON.stringify(state), value = newGroup(state);
  value.copies[0].sticker = 'A01';
  // No command is submitted by Close/Discard. Preparing also cannot write a record.
  change(server, state, 'saveGroup', value);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.groups.length, 1); assert.equal(state.receipts.length, 0);
  assert.ok(state.copies.every(copy => !copy.deletedAt));
});

for (const field of ['sizeId', 'creatureTypeId', 'raceId', 'sexId', 'roleId', 'homeId', 'paintId', 'setId', 'name', 'setNumber']) {
  test(`new group rejects blank ${field} without losing its draft`, () => {
    const { server, state } = fixture(), value = newGroup(state); value.fields[field] = '';
    rejectsUnchanged(server, state, request(state, 'saveGroup', value), 'INVALID');
  });
}
test('explicit no-set choices need no number, while historical missing/long Set # stays untouched', () => {
  const { server, state } = fixture(), value = newGroup(state);
  value.fields.setId = choice(state, 'set', 'n/a'); value.fields.setNumber = '';
  assert.equal(change(server, state, 'saveGroup', value).state.groups[1].setNumber, '');
  for (const number of ['', '12345']) {
    state.groups[0].setNumber = number;
    const updated = payload(state); updated.fields.notes = 'Unrelated';
    assert.equal(change(server, state, 'saveGroup', updated).state.groups[0].setNumber, number);
  }
  value.fields.setId = choice(state, 'set', 'Owned Set'); value.fields.setNumber = 'bad';
  rejectsUnchanged(server, state, request(state, 'saveGroup', value), 'INVALID');
});

test('location Save preserves unrelated fields and cannot move another group or deleted copy', () => {
  const { server, state } = fixture();
  const value = { rootId: 'old-root', copies: [{ id: 'old-01', currentLocationId: choice(state, 'location', 'Drawer') }] };
  const next = change(server, state, 'saveLocations', value).state;
  assert.deepEqual(clone(next.groups), clone(state.groups));
  assert.equal(next.copies[0].currentLocationId, value.copies[0].currentLocationId);
  value.copies[0].id = 'someone-elses-copy';
  rejectsUnchanged(server, state, request(state, 'saveLocations', value), 'INVALID');
});

test('Home changes do not teleport checked-out copies; current-location-only choices cannot be Home', () => {
  const { server, state } = fixture();
  const added = change(server, state, 'saveChoice', { id: '', field: 'location', value: 'New drawer', home: true });
  const value = payload(added.state); value.fields.homeId = added.result.choiceId;
  const next = change(server, added.state, 'saveGroup', value).state;
  assert.deepEqual(clone(next.copies), clone(state.copies));
  value.fields.homeId = choice(state, 'location', 'Encounter Box');
  rejectsUnchanged(server, added.state, request(added.state, 'saveGroup', value), 'INVALID');
});

test('duplicate assigned stickers are rejected case-insensitively, but sibling swaps are atomic', () => {
  const { server, state } = fixture(), value = payload(state);
  value.copies[1].sticker = ' a00 ';
  rejectsUnchanged(server, state, request(state, 'saveGroup', value), 'STICKER_CONFLICT');
  value.copies[0].sticker = 'n/a'; value.copies[1].sticker = 'A00';
  const next = change(server, state, 'saveGroup', value).state;
  assert.equal(next.copies[0].sticker, 'n/a'); assert.equal(next.copies[1].sticker, 'A00');
  value.copies[1].sticker = 'Z99';
  rejectsUnchanged(server, state, request(state, 'saveGroup', value), 'INVALID');
});

test('a stale second-tab Save fails rather than overwriting the first one', () => {
  const { server, state } = fixture(), value = payload(state);
  const stale = request(state, 'saveGroup', value);
  const committed = change(server, state, 'saveLocations', { rootId: 'old-root', copies: [{ id: 'old-01', currentLocationId: choice(state, 'location', 'Drawer') }] }).state;
  rejectsUnchanged(server, committed, stale, 'STALE');
});

test('retrying a lost response replays its receipt, never creates another group or replaces later state', () => {
  const { server, state } = fixture(), req = request(state, 'saveGroup', newGroup(state));
  const first = server.preparePersistenceChange_(state, req, services());
  const later = change(server, first.state, 'saveLocations', { rootId: 'old-root', copies: [{ id: 'old-01', currentLocationId: choice(state, 'location', 'Drawer') }] });
  const replay = server.preparePersistenceChange_(later.state, req, { ...services(), makeId() { throw new Error('Must not generate another ID'); } });
  assert.equal(replay.replayed, true);
  assert.deepEqual(clone(replay.result), clone(first.result));
  assert.deepEqual(clone(replay.state), clone(later.state));
  req.payload.fields.name = 'Different request';
  rejectsUnchanged(server, later.state, req, 'REQUEST_REUSED');
});

test('reordered JSON keys do not change the retry fingerprint', () => {
  const { server, state } = fixture(), req = request(state, 'saveGroup', payload(state));
  const first = server.preparePersistenceChange_(state, req, services());
  req.payload.fields = Object.fromEntries(Object.entries(req.payload.fields).reverse());
  assert.equal(server.preparePersistenceChange_(first.state, req, services()).replayed, true);
});

test('copy removal is a tombstone only on Save; numbers and IDs are never recycled', () => {
  const { server, state } = fixture(), value = payload(state);
  value.copies.pop();
  const removed = change(server, state, 'saveGroup', value).state;
  assert.ok(removed.copies[1].deletedAt); assert.equal(state.copies[1].deletedAt, '');
  const next = payload(removed);
  next.copies.push({ id: '', clientKey: 'new', sticker: 'A01', currentLocationId: choice(state, 'location', 'Drawer'), note: '' });
  const added = change(server, removed, 'saveGroup', next).state;
  assert.equal(added.copies[2].miniNumber, '03');
  assert.notEqual(added.copies[2].id, 'old-02');
});

test('group restoration preserves IDs but never resurrects a previously removed copy', () => {
  const { server, state } = fixture(), value = payload(state); value.copies.pop();
  const oneCopy = change(server, state, 'saveGroup', value).state;
  const deleted = change(server, oneCopy, 'deleteGroup', { rootId: 'old-root' }).state;
  assert.equal(server.projectPersistencePreview_(deleted).length, 0, 'last group can be deleted');
  const restored = change(server, deleted, 'restoreGroup', { rootId: 'old-root' }).state;
  assert.equal(restored.copies[0].id, 'old-01'); assert.equal(restored.copies[0].deletedAt, '');
  assert.ok(restored.copies[1].deletedAt); assert.equal(restored.copies[1].deletedWithGroup, '');
});

test('deleted groups release stickers, and restore refuses to steal a reused sticker', () => {
  const { server, state } = fixture(), value = newGroup(state); value.copies[0].sticker = 'A00';
  const deleted = change(server, state, 'deleteGroup', { rootId: 'old-root' }).state;
  const reused = change(server, deleted, 'saveGroup', value);
  rejectsUnchanged(server, reused.state, request(reused.state, 'restoreGroup', { rootId: 'old-root' }), 'STICKER_CONFLICT');
  const release = payload(reused.state, reused.result.rootId); release.copies[0].sticker = '';
  const released = change(server, reused.state, 'saveGroup', release).state;
  assert.equal(change(server, released, 'restoreGroup', { rootId: 'old-root' }).state.groups[0].deletedAt, '');
});

test('list renames retain stable references, including deleted history and separate Home/current eligibility', () => {
  const { server, state } = fixture(), id = choice(state, 'location', 'Drawer');
  const renamed = change(server, state, 'saveChoice', { id, field: 'location', value: 'Home drawer', home: true }).state;
  assert.deepEqual(clone(renamed.groups), clone(state.groups));
  assert.deepEqual(clone(renamed.copies), clone(state.copies));
  assert.equal(server.projectPersistencePreview_(renamed)[0].home, 'Home drawer');
  rejectsUnchanged(server, renamed, request(renamed, 'saveChoice', { id, field: 'location', value: 'Home drawer', home: false }), 'INVALID');
});

test('removed choices remain assigned, cannot be newly selected, and restore does not undo reassignment', () => {
  const { server, state } = fixture(), id = choice(state, 'set', 'Owned Set');
  const removed = change(server, state, 'removeChoice', { id }).state;
  assert.equal(server.projectPersistencePreview_(removed)[0].set, 'Owned Set');
  assert.equal(change(server, removed, 'saveGroup', payload(removed)).state.groups[0].setId, id);
  rejectsUnchanged(server, removed, request(removed, 'saveGroup', newGroup(removed)), 'INVALID');
  const value = payload(removed); value.fields.setId = choice(state, 'set', 'Unused Set');
  const reassigned = change(server, removed, 'saveGroup', value).state;
  const restored = change(server, reassigned, 'restoreChoice', { id }).state;
  assert.equal(server.projectPersistencePreview_(restored)[0].set, 'Unused Set');
  assert.equal(restored.choices.find(item => item.id === id).removedAt, '');
});

test('re-adding a removed choice restores its ID; duplicate/reserved labels and category changes are rejected', () => {
  const { server, state } = fixture(), id = choice(state, 'set', 'Unused Set');
  const removed = change(server, state, 'removeChoice', { id }).state;
  const restored = change(server, removed, 'saveChoice', { id: '', field: 'set', value: 'Unused Set', home: false });
  assert.equal(restored.result.choiceId, id); assert.equal(restored.state.choices.length, state.choices.length);
  for (const value of ['Unused Set', 'unused set', 'Not entered', 'n/a', 'Not specified']) {
    rejectsUnchanged(server, state, request(state, 'saveChoice', { id: '', field: 'set', value, home: false }), 'INVALID');
  }
  rejectsUnchanged(server, state, request(state, 'removeChoice', { id: choice(state, 'set', 'n/a') }), 'INVALID');
  rejectsUnchanged(server, state, request(state, 'saveChoice', { id, field: 'race', value: 'Different category', home: false }), 'INVALID');
});

for (const [name, mutate] of [
  ['wrong collection', req => { req.collectionId = 'another-workbook'; }],
  ['unknown operation', req => { req.kind = 'purgeEverything'; }],
  ['extra UI draft field', req => { req.payload.fields.pendingLocations = {}; }],
  ['client-supplied group identity', req => { req.payload.rootId = 'invented'; }],
  ['client-supplied copy identity', req => { req.payload.copies[0].id = 'invented'; }],
  ['duplicate copy', req => { req.payload.copies.push(req.payload.copies[0]); }],
  ['no copies', req => { req.payload.copies = []; }],
  ['wrong-category reference', req => { req.payload.fields.homeId = req.payload.fields.sizeId; }],
  ['missing location', req => { req.payload.copies[0].currentLocationId = ''; }],
  ['malformed name', req => { req.payload.fields.name = {}; }],
  ['overlong cell', req => { req.payload.fields.notes = 'x'.repeat(45001); }]
]) test(`save rejects ${name} without changing stored records`, () => {
  const { server, state } = fixture(), req = request(state, 'saveGroup', payload(state)); mutate(req);
  rejectsUnchanged(server, state, req, 'INVALID');
});

test('UUID collisions fail closed rather than reusing a stored or deleted identity', () => {
  const { server, state } = fixture();
  rejectsUnchanged(server, state, request(state, 'saveGroup', newGroup(state)), 'INVALID',
    { ...services(), makeId: () => state.choices[0].id });
});

test('an uncommitted attempt can be retried; only the committed receipt reserves its result', () => {
  const { server, state } = fixture(), req = request(state, 'saveGroup', newGroup(state));
  const abandoned = server.preparePersistenceChange_(state, req, services());
  const retry = server.preparePersistenceChange_(state, req, services());
  assert.equal(state.revision, 0); assert.equal(state.receipts.length, 0);
  assert.equal(retry.replayed, false);
  assert.notEqual(retry.result.rootId, abandoned.result.rootId);
  assert.equal(retry.state.groups.length, 2);
  const acknowledged = server.preparePersistenceChange_(retry.state, req, services());
  assert.equal(acknowledged.replayed, true); assert.equal(acknowledged.result.rootId, retry.result.rootId);
});

test('copy removal releases its sticker for a new copy in the same atomic Save', () => {
  const { server, state } = fixture(), value = payload(state);
  value.copies = [value.copies[1], { ...value.copies[0], id: '', clientKey: 'replacement' }];
  const next = change(server, state, 'saveGroup', value).state;
  assert.ok(next.copies[0].deletedAt);
  assert.equal(next.copies[2].sticker, 'A00');
  assert.equal(server.projectPersistencePreview_(next)[0].copies.length, 2);
});

test('storage-table round trip preserves deletion history, literal cell text, IDs, and retry receipts', () => {
  const { server, state } = fixture(), value = newGroup(state);
  value.fields.notes = '=HYPERLINK("https://example.invalid", "literal")';
  value.copies[0].note = '+not a formula';
  const req = request(state, 'saveGroup', value);
  const added = server.preparePersistenceChange_(state, req, services());
  const deleted = change(server, added.state, 'deleteGroup', { rootId: 'old-root' }).state;
  const tables = server.persistenceTables_(deleted), before = JSON.stringify(tables);
  assert.ok(Object.values(tables).flat(2).every(value => typeof value === 'string'));
  assert.deepEqual(clone(server.parsePersistenceTables_(tables)), clone(deleted));
  assert.equal(JSON.stringify(tables), before);
  const reloaded = server.parsePersistenceTables_(tables);
  assert.equal(server.projectPersistencePreview_(reloaded)[0].notes, value.fields.notes);
  assert.equal(server.preparePersistenceChange_(reloaded, req, services()).result.rootId, added.result.rootId);
  // Receipts identify old creations without resurrecting their deleted parent.
  assert.ok(reloaded.groups[0].deletedAt);
});

for (const title of ['Metadata', 'Groups', 'Copies', 'Lists', 'Stickers', 'Requests']) {
  test(`new schema maps ${title} by headers rather than physical positions`, () => {
    const { server, state } = fixture();
    const added = change(server, state, 'saveGroup', newGroup(state)).state;
    const tables = clone(server.persistenceTables_(added));
    tables[title] = tables[title].map(row => row.slice().reverse());
    assert.deepEqual(clone(server.parsePersistenceTables_(tables)), clone(added));
  });
}

for (const [name, mutate] of [
  ['duplicate header', tables => { tables.Groups[0][1] = tables.Groups[0][0]; }],
  ['missing header', tables => { tables.Copies[0].pop(); }],
  ['extra header', tables => { tables.Lists[0].push('unknown'); }],
  ['extra row data', tables => { tables.Lists[1].push('extra'); }],
  ['non-string cell', tables => { tables.Stickers[1][0] = 42; }],
  ['missing revision', tables => { tables.Metadata.pop(); }],
  ['duplicate metadata', tables => { tables.Metadata.push(tables.Metadata[1]); }],
  ['broken foreign key', tables => { tables.Copies[1][4] = 'nonexistent'; }],
  ['duplicate sticker order', tables => { tables.Stickers[2][1] = tables.Stickers[1][1]; }],
  ['invalid stored boolean', tables => { tables.Lists[1][4] = 'maybe'; }],
  ['false deletion membership', tables => { tables.Copies[1][7] = 'old-root'; }],
  ['invalid schema version', tables => { tables.Metadata[1][1] = '999'; }],
  ['unknown metadata key', tables => { tables.Metadata[1][0] = '__proto__'; }],
  ['bad receipt JSON', tables => { tables.Requests[1][2] = 'not json'; }],
  ['missing receipt', tables => { tables.Requests.pop(); }]
]) test(`new storage reader rejects ${name}`, () => {
  const { server, state } = fixture();
  const next = change(server, state, 'saveGroup', newGroup(state)).state;
  const tables = clone(server.persistenceTables_(next)); mutate(tables);
  assert.throws(() => server.parsePersistenceTables_(tables), error => error.code === 'INVALID');
});

test('a retired choice must be restored explicitly before it can be renamed', () => {
  const { server, state } = fixture(), id = choice(state, 'set', 'Unused Set');
  const removed = change(server, state, 'removeChoice', { id }).state;
  rejectsUnchanged(server, removed, request(removed, 'saveChoice', { id, field: 'set', value: 'Renamed', home: false }), 'INVALID');
});

test('storage also rejects invalid timestamps and fabricated receipt responses', () => {
  const { server, state } = fixture();
  rejectsUnchanged(server, state, request(state, 'deleteGroup', { rootId: 'old-root' }), 'INVALID',
    { ...services(), now: () => '2026-02-31T20:00:00.000Z' });
  const next = change(server, state, 'saveGroup', newGroup(state)).state;
  next.receipts[0].result.createdCopies[0].id = 'fabricated';
  assert.throws(() => server.validatePersistenceState_(next), error => error.code === 'INVALID');
});

test('all preparation functions remain private, excluded from clasp, with no network/storage effects', () => {
  const source = read('Persistence.js');
  for (const match of source.matchAll(/^function\s+(\w+)\(/gm)) assert.ok(match[1].endsWith('_'), match[1]);
  assert.doesNotMatch(source, /SpreadsheetApp|DriveApp|UrlFetchApp|PropertiesService|\.setValues?\(|\bfetch\s*\(/);
  assert.doesNotMatch(read('.claspignore'), /^!Persistence\.js\s*$/m);
  assert.doesNotMatch(read('Code.js') + read('Scripts.html'), /preparePersistenceChange_|migratePreviewForPersistence_/);
});

test('batch combines group edits, locations and creation into one revision/receipt without mutating inputs', () => {
  const { server, state, second } = twoGroups();
  const edited = payload(state), added = newGroup(state);
  edited.fields.notes = '=Literal batch note';
  edited.copies.push({ ...added.copies[0], clientKey: 'new-copy', sticker: 'A02' });
  added.copies[0].sticker = 'A03';
  const moved = { rootId: second, copies: [{ id: state.copies.at(-1).id, currentLocationId: choice(state, 'location', 'Encounter Box') }] };
  const req = scopedRequest(server, state, 'saveBatch', { changes: [
    batchItem('edited', edited), batchItem('moved', moved, 'saveLocations'), batchItem('created', added)
  ] });
  const before = JSON.stringify(state), draft = JSON.stringify(req);
  const result = server.preparePersistenceChange_(state, req, services());
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(result.state.receipts.length, state.receipts.length + 1);
  assert.equal(result.result.changes.length, 3);
  assert.deepEqual(clone(result.result.changes.map(item => item.clientKey)), ['edited', 'moved', 'created']);
  assert.equal(result.result.changes[0].createdCopies[0].clientKey, 'new-copy');
  assert.equal(result.state.groups[0].notes, edited.fields.notes);
  assert.equal(result.state.groups[0].raceId, '', 'legacy omissions survive unrelated repairs');
  assert.equal(result.state.copies[0].currentLocationId, state.copies[0].currentLocationId, 'checked-out copy stays checked out');
  assert.equal(result.state.copies.find(copy => copy.id === moved.copies[0].id).currentLocationId, moved.copies[0].currentLocationId);
  assert.equal(result.state.groups.length, 3);
  assert.equal(JSON.stringify(state), before); assert.equal(JSON.stringify(req), draft);
  assert.deepEqual(clone(server.parsePersistenceTables_(server.persistenceTables_(result.state))), clone(result.state));
});

test('invalid last item leaves every earlier batch item, ID and receipt uncommitted', () => {
  const { server, state } = fixture(), edited = payload(state), valid = newGroup(state), invalid = newGroup(state);
  edited.fields.notes = 'Must not be applied'; invalid.fields.name = '';
  const req = scopedRequest(server, state, 'saveBatch', { changes: [
    batchItem('edited', edited), batchItem('valid', valid), batchItem('invalid', invalid)
  ] });
  rejectsUnchanged(server, state, req, 'INVALID');
  assert.equal(state.revision, 0); assert.equal(state.groups.length, 1);
});

test('batch validates sticker swaps in the final collection in either operation order', () => {
  const { server, state, second } = twoGroups();
  const firstValue = payload(state), secondValue = payload(state, second);
  firstValue.copies[0].sticker = ' a01 '; secondValue.copies[0].sticker = 'A00';
  for (const changes of [[batchItem('one', firstValue), batchItem('two', secondValue)],
    [batchItem('two', secondValue), batchItem('one', firstValue)]]) {
    const req = scopedRequest(server, state, 'saveBatch', { changes });
    const result = server.preparePersistenceChange_(state, req, services());
    assert.equal(result.state.copies[0].sticker, 'a01');
    assert.equal(result.state.copies.find(copy => copy.rootId === second).sticker, 'A00');
    assert.equal(result.state.receipts.length, state.receipts.length + 1);
  }
});

test('batch detects collisions within the batch and with untouched groups, ignoring repeated blank/n/a stickers', () => {
  const { server, state, second } = twoGroups();
  const edited = payload(state), added = newGroup(state);
  for (const sticker of ['A00', ' a01 ']) {
    added.copies[0].sticker = sticker;
    rejectsUnchanged(server, state, scopedRequest(server, state, 'saveBatch', {
      changes: [batchItem('edit', edited), batchItem('new', added)]
    }), 'STICKER_CONFLICT');
  }
  for (const sticker of ['', 'n/a', ' N/A ']) {
    const value = payload(state, second); value.copies[0].sticker = sticker;
    added.copies[0].sticker = sticker;
    const result = server.preparePersistenceChange_(state, scopedRequest(server, state, 'saveBatch', {
      changes: [batchItem('edit', value), batchItem('new', added)]
    }), services());
    assert.equal(result.state.groups.length, 3);
  }
});

test('a copy removed by one group save releases its sticker to another group in that same batch', () => {
  const { server, state, second } = twoGroups(), firstValue = payload(state), secondValue = payload(state, second);
  firstValue.copies.shift(); secondValue.copies[0].sticker = 'A00';
  const result = server.preparePersistenceChange_(state, scopedRequest(server, state, 'saveBatch', {
    changes: [batchItem('claim', secondValue), batchItem('release', firstValue)]
  }), services());
  assert.ok(result.state.copies[0].deletedAt);
  assert.equal(result.state.copies.find(copy => copy.rootId === second).sticker, 'A00');
  assert.equal(state.copies[0].deletedAt, '');
});

for (const [name, mutate] of [
  ['empty batch', value => { value.changes = []; }],
  ['non-array items', value => { value.changes = {}; }],
  ['duplicate group', value => { value.changes.push(batchItem('other-key', value.changes[0].payload)); }],
  ['separate location operation for the same group', value => { value.changes.push(batchItem('locations', { rootId: 'old-root', copies: [] }, 'saveLocations')); }],
  ['duplicate client key', value => { value.changes.push({ ...value.changes[0] }); }],
  ['missing client key', value => { delete value.changes[0].clientKey; }],
  ['invented root ID', value => { value.changes[0].payload.rootId = 'invented'; }],
  ['new location-only group', value => { value.changes[0].kind = 'saveLocations'; value.changes[0].payload.rootId = ''; }],
  ['list operation', value => { value.changes[0].kind = 'saveChoice'; }],
  ['deletion operation', value => { value.changes[0].kind = 'deleteGroup'; }],
  ['restoration operation', value => { value.changes[0].kind = 'restoreGroup'; }],
  ['nested batch', value => { value.changes[0].kind = 'saveBatch'; }]
]) test(`batch rejects ${name} without side effects`, () => {
  const { server, state } = fixture(), value = { changes: [batchItem('group', payload(state))] };
  mutate(value); rejectsUnchanged(server, state, request(state, 'saveBatch', value), 'INVALID');
});

test('record-scoped saves allow unrelated newer groups and catalog labels while retaining their changes', () => {
  const { server, state, second } = twoGroups(), edited = payload(state);
  edited.fields.notes = 'From an older tab';
  const req = scopedRequest(server, state, 'saveBatch', { changes: [batchItem('first', edited)] });
  const other = payload(state, second); other.fields.notes = 'Newer unrelated edit';
  const updated = change(server, state, 'saveGroup', other).state;
  const renamed = change(server, updated, 'saveChoice', { id: choice(state, 'set', 'Owned Set'), field: 'set', value: 'Renamed Set', home: false }).state;
  const result = server.preparePersistenceChange_(renamed, req, services());
  assert.equal(result.state.groups.find(group => group.rootId === second).notes, 'Newer unrelated edit');
  assert.equal(result.state.groups[0].notes, edited.fields.notes);
  assert.equal(server.projectPersistencePreview_(result.state)[0].set, 'Renamed Set');
  assert.equal(result.result.revision, renamed.revision + 1);
  assert.ok(req.expectedRevision < renamed.revision);
});

for (const kind of ['metadata', 'copy note', 'location', 'copy added', 'copy removed', 'deleted']) {
  test(`a concurrent ${kind} change blocks the entire affected batch and identifies the group`, () => {
    const { server, state, second } = twoGroups(), original = payload(state);
    const req = scopedRequest(server, state, 'saveBatch', {
      changes: [batchItem('first', original), batchItem('second', payload(state, second)), batchItem('new', newGroup(state))]
    });
    let newer;
    if (kind === 'deleted') newer = change(server, state, 'deleteGroup', { rootId: 'old-root' }).state;
    else {
      const value = payload(state);
      if (kind === 'metadata') value.fields.notes = 'Changed elsewhere';
      if (kind === 'copy note') value.copies[0].note = 'Changed elsewhere';
      if (kind === 'location') value.copies[0].currentLocationId = choice(state, 'location', 'Drawer');
      if (kind === 'copy added') value.copies.push({ ...newGroup(state).copies[0], clientKey: 'added' });
      if (kind === 'copy removed') value.copies.pop();
      newer = change(server, state, 'saveGroup', value).state;
    }
    rejectsUnchanged(server, newer, req, 'STALE', { ...services(), makeId() { assert.fail('conflicts must be checked before allocating IDs'); } });
    assert.throws(() => server.preparePersistenceChange_(newer, req, services()), error => {
      assert.deepEqual(clone(error.details), { groups: ['old-root'], choices: [] }); return true;
    });
  });
}

test('single-group, location, deletion and list actions can use the same record-scoped contract', () => {
  const { server, state, second } = twoGroups();
  const newer = change(server, state, 'saveGroup', { ...payload(state, second), fields: { ...payload(state, second).fields, notes: 'Other group' } }).state;
  const setId = choice(state, 'set', 'Unused Set');
  for (const [kind, value] of [
    ['saveGroup', payload(state)], ['saveLocations', { rootId: 'old-root', copies: [{ id: 'old-01', currentLocationId: choice(state, 'location', 'Drawer') }] }],
    ['deleteGroup', { rootId: 'old-root' }], ['removeChoice', { id: setId }],
    ['saveChoice', { id: setId, field: 'set', value: 'Renamed unused set', home: false }]
  ]) {
    const req = scopedRequest(server, state, kind, value);
    assert.equal(server.preparePersistenceChange_(newer, req, services()).state.revision, newer.revision + 1);
  }
});

test('same-choice conflicts block list edits but unrelated choices do not, including restoring a removed label', () => {
  const { server, state } = fixture(), id = choice(state, 'set', 'Unused Set');
  const req = scopedRequest(server, state, 'saveChoice', { id, field: 'set', value: 'My renamed set', home: false });
  const unrelated = change(server, state, 'saveChoice', { id: choice(state, 'set', 'Owned Set'), field: 'set', value: 'Other set rename', home: false }).state;
  assert.equal(server.preparePersistenceChange_(unrelated, req, services()).result.choiceId, id);
  const removed = change(server, state, 'removeChoice', { id }).state;
  rejectsUnchanged(server, removed, req, 'STALE');
  const readd = scopedRequest(server, removed, 'saveChoice', { id: '', field: 'set', value: 'Unused Set', home: false });
  assert.equal(readd.preconditions.choices[0].id, id);
  const restored = change(server, removed, 'restoreChoice', { id }).state;
  rejectsUnchanged(server, restored, readd, 'STALE');
});

test('stale group tokens do not ignore current catalog eligibility or newly occupied stickers', () => {
  const { server, state } = fixture(), added = newGroup(state);
  added.fields.setId = choice(state, 'set', 'Unused Set'); added.copies[0].sticker = 'A01';
  const req = scopedRequest(server, state, 'saveBatch', { changes: [batchItem('new', added)] });
  const removed = change(server, state, 'removeChoice', { id: added.fields.setId }).state;
  rejectsUnchanged(server, removed, req, 'INVALID');
  const taken = change(server, state, 'saveGroup', added).state;
  rejectsUnchanged(server, taken, req, 'STICKER_CONFLICT');
});

test('a catalog removed after drafting permits unchanged assignments but not new assignments in a batch', () => {
  const { server, state } = fixture(), edited = payload(state);
  edited.fields.notes = 'Repair unrelated details';
  const req = scopedRequest(server, state, 'saveBatch', { changes: [batchItem('edit', edited)] });
  const removed = change(server, state, 'removeChoice', { id: edited.fields.setId }).state;
  assert.equal(server.preparePersistenceChange_(removed, req, services()).state.groups[0].notes, edited.fields.notes);
  const newChoice = change(server, state, 'saveChoice', { id: '', field: 'location', value: 'Temporary Home', home: true });
  const added = newGroup(newChoice.state); added.fields.homeId = newChoice.result.choiceId;
  const create = scopedRequest(server, newChoice.state, 'saveBatch', { changes: [batchItem('new', added)] });
  const noLongerHome = change(server, newChoice.state, 'saveChoice', {
    id: newChoice.result.choiceId, field: 'location', value: 'Temporary Home', home: false
  }).state;
  rejectsUnchanged(server, noLongerHome, create, 'INVALID');
});

test('one batch can report several changed groups without touching unaffected drafts', () => {
  const { server, state, second } = twoGroups();
  const req = scopedRequest(server, state, 'saveBatch', { changes: [batchItem('one', payload(state)), batchItem('two', payload(state, second))] });
  let newer = state;
  for (const rootId of ['old-root', second]) {
    const edit = payload(newer, rootId); edit.fields.notes = 'Concurrent edit';
    newer = change(server, newer, 'saveGroup', edit).state;
  }
  rejectsUnchanged(server, newer, req, 'STALE');
  assert.throws(() => server.preparePersistenceChange_(newer, req, services()), error => {
    assert.deepEqual(new Set(error.details.groups), new Set(['old-root', second])); return true;
  });
});

for (const [name, mutate] of [
  ['missing affected record', req => { req.preconditions.groups = []; }],
  ['duplicate baseline', req => { req.preconditions.groups.push(req.preconditions.groups[0]); }],
  ['extra unrelated record', req => { req.preconditions.choices.push({ id: 'unrelated', token: '0'.repeat(64) }); }],
  ['malformed token', req => { req.preconditions.groups[0].token = 'bad'; }],
  ['missing category', req => { delete req.preconditions.choices; }],
  ['extra baseline field', req => { req.preconditions.groups[0].overwrite = true; }]
]) test(`record preconditions reject ${name}`, () => {
  const { server, state } = fixture(), req = scopedRequest(server, state, 'saveGroup', payload(state));
  mutate(req); rejectsUnchanged(server, state, req, 'INVALID');
});

test('record preconditions are checked even at the current revision, and future revisions cannot be used', () => {
  const { server, state } = fixture(), req = scopedRequest(server, state, 'saveGroup', payload(state));
  const wrong = clone(req); wrong.preconditions.groups[0].token = '0'.repeat(64);
  rejectsUnchanged(server, state, wrong, 'STALE');
  req.expectedRevision = state.revision + 1;
  rejectsUnchanged(server, state, req, 'STALE');
});

test('record tokens ignore physical row order but cover deleted-copy history and sequence allocation', () => {
  const { server, state } = fixture(), value = payload(state);
  value.copies.pop(); const removed = change(server, state, 'saveGroup', value).state;
  const req = scopedRequest(server, removed, 'saveGroup', payload(removed));
  const reordered = clone(removed); reordered.copies.reverse(); reordered.choices.reverse();
  assert.equal(server.preparePersistenceChange_(reordered, req, services()).result.rootId, 'old-root');
  reordered.copies.find(copy => copy.deletedAt).miniNumber = '10';
  rejectsUnchanged(server, reordered, req, 'STALE');
});

test('batch lost-response replay survives reload and later deletion without regenerating IDs or reverting newer state', () => {
  const { server, state } = fixture();
  const req = scopedRequest(server, state, 'saveBatch', { changes: [
    batchItem('existing', payload(state)), batchItem('new-one', newGroup(state)), batchItem('new-two', newGroup(state))
  ] });
  const committed = server.preparePersistenceChange_(state, req, services());
  const deleted = change(server, committed.state, 'deleteGroup', { rootId: committed.result.changes[1].rootId }).state;
  const reloaded = server.parsePersistenceTables_(server.persistenceTables_(deleted));
  const replay = server.preparePersistenceChange_(reloaded, req, { ...services(), makeId() { assert.fail('must reuse receipt'); } });
  assert.equal(replay.replayed, true);
  assert.deepEqual(clone(replay.result), clone(committed.result));
  assert.deepEqual(clone(replay.state), clone(reloaded));
  req.payload.changes[0].payload.fields.notes = 'Not the same request';
  rejectsUnchanged(server, reloaded, req, 'REQUEST_REUSED');
});

test('batch failure during ID allocation and failure before commit leave no partial save or deletion history', () => {
  const { server, state } = fixture(), value = payload(state); value.copies.pop();
  const req = scopedRequest(server, state, 'saveBatch', { changes: [batchItem('remove', value), batchItem('new', newGroup(state))] });
  const before = JSON.stringify(state), draft = JSON.stringify(req); let calls = 0;
  assert.throws(() => server.preparePersistenceChange_(state, req, { ...services(), makeId() {
    if (++calls === 2) throw new Error('Simulated ID service failure'); return randomUUID();
  } }), /Simulated ID service failure/);
  assert.equal(JSON.stringify(state), before); assert.equal(JSON.stringify(req), draft);
  const abandoned = server.preparePersistenceChange_(state, req, services());
  const retry = server.preparePersistenceChange_(state, req, services());
  assert.equal(JSON.stringify(state), before, 'preparing is not committing');
  assert.notEqual(retry.result.changes[1].rootId, abandoned.result.changes[1].rootId);
  assert.equal(retry.state.revision, 1); assert.equal(retry.state.receipts.length, 1);
  assert.equal(server.preparePersistenceChange_(retry.state, req, services()).replayed, true);
});

test('large batches split one receipt across bounded cells and reject missing, duplicate or inconsistent parts', () => {
  const { server, state } = fixture();
  const changes = Array.from({ length: 350 }, (_, i) => batchItem(`new-${i}`, newGroup(state)));
  const req = scopedRequest(server, state, 'saveBatch', { changes });
  const committed = server.preparePersistenceChange_(state, req, services());
  const tables = clone(server.persistenceTables_(committed.state));
  assert.ok(tables.Requests.length > 2, 'batch receipt must actually span multiple cells');
  assert.ok(Object.values(tables).flat(2).every(value => typeof value === 'string' && value.length <= 45000));
  assert.equal(committed.state.receipts.length, 1);
  const reordered = clone(tables); reordered.Requests = [reordered.Requests[0], ...reordered.Requests.slice(1).reverse()];
  assert.deepEqual(clone(server.parsePersistenceTables_(reordered)), clone(committed.state));
  for (const mutate of [
    value => value.Requests.splice(1, 1),
    value => value.Requests.push(value.Requests[1]),
    value => { value.Requests[1][3] = '0'; },
    value => { value.Requests[1][3] = '99'; },
    value => { value.Requests[1][1] = '0'.repeat(64); },
    value => { value.Requests[1][2] = 'invalid json'; }
  ]) {
    const invalid = clone(tables); mutate(invalid);
    assert.throws(() => server.parsePersistenceTables_(invalid), error => error.code === 'INVALID');
  }
  const loaded = server.parsePersistenceTables_(tables);
  assert.deepEqual(clone(server.preparePersistenceChange_(loaded, req, services()).result), clone(committed.result));
});

test('stored batch receipts reject invented mappings and duplicate group or client keys', () => {
  const { server, state } = fixture();
  const committed = server.preparePersistenceChange_(state, request(state, 'saveBatch', {
    changes: [batchItem('one', newGroup(state)), batchItem('two', newGroup(state))]
  }), services()).state;
  for (const mutate of [
    value => { value.receipts[0].result.changes[1].clientKey = 'one'; },
    value => { value.receipts[0].result.changes[1] = { ...value.receipts[0].result.changes[0], clientKey: 'two' }; },
    value => { value.receipts[0].result.changes[0].createdCopies[0].id = 'invented'; },
    value => { value.receipts[0].result.changes[0] = null; },
    value => { value.receipts[0].result.changes = []; }
  ]) {
    const invalid = clone(committed); mutate(invalid);
    assert.throws(() => server.validatePersistenceState_(invalid), error => error.code === 'INVALID');
  }
});

const imported = path.join(repo, '.local/import/import-readback.json');
test('optional real-data rehearsal preserves 612 copies, 496 groups, all away locations and six blanks', { skip: !fs.existsSync(imported) }, () => {
  const server = vm.createContext({});
  vm.runInContext(read('Storage.js'), server); vm.runInContext(read('Persistence.js'), server);
  const snapshot = JSON.parse(fs.readFileSync(imported, 'utf8'));
  const tables = Object.fromEntries(snapshot.destination.sheets.map(sheet => [sheet.title, sheet.values]));
  const preview = server.parseSpreadsheetPreview_(tables), before = JSON.stringify(preview);
  const state = server.migratePreviewForPersistence_(preview, randomUUID);
  assert.deepEqual(clone(server.parsePersistenceTables_(server.persistenceTables_(state))), clone(state));
  const projected = server.projectPersistencePreview_(state);
  assert.deepEqual(clone(projected), clone(preview.groups));
  assert.equal(JSON.stringify(preview), before);
  assert.equal(state.groups.length, 496); assert.equal(state.copies.length, 612);
  assert.equal(projected.flatMap(group => group.copies).filter(copy => copy.currentLocation !== copy.home).length, 19);
  const missing = projected.flatMap(group => ['size', 'creatureType', 'sex', 'race', 'role', 'home', 'paint', 'set', 'setNumber']
    .filter(field => field === 'setNumber' ? !['n/a', 'Not specified', ''].includes(group.set) && !group[field] : !group[field]));
  assert.equal(missing.length, 6);
  const rootId = state.groups[0].rootId, value = payload(state, rootId);
  value.fields.notes += '\nLocal rehearsal, never sent to Google.';
  const updated = change(server, state, 'saveGroup', value).state;
  assert.equal(updated.groups.find(group => group.rootId === rootId).notes, value.fields.notes);
  assert.equal(JSON.stringify(preview), before);
});

test('optional imported 496-group Save All is one receipt and preserves every copy, blank and away location', { skip: !fs.existsSync(imported) }, () => {
  const server = vm.createContext({});
  vm.runInContext(read('Storage.js'), server); vm.runInContext(read('Persistence.js'), server);
  const snapshot = JSON.parse(fs.readFileSync(imported, 'utf8'));
  const tables = Object.fromEntries(snapshot.destination.sheets.map(sheet => [sheet.title, sheet.values]));
  const preview = server.parseSpreadsheetPreview_(tables);
  const state = server.migratePreviewForPersistence_(preview, randomUUID), before = JSON.stringify(state);
  const changes = state.groups.map(group => {
    const value = payload(state, group.rootId); value.fields.notes += '\nLocal batch rehearsal.';
    return batchItem(group.rootId, value);
  });
  const req = scopedRequest(server, state, 'saveBatch', { changes });
  const committed = server.preparePersistenceChange_(state, req, services());
  assert.equal(committed.state.revision, 1); assert.equal(committed.state.receipts.length, 1);
  assert.equal(committed.result.changes.length, 496);
  assert.deepEqual(clone(committed.state.copies), clone(state.copies));
  const restoredNotes = clone(committed.state.groups).map((group, i) => ({ ...group, notes: state.groups[i].notes }));
  assert.deepEqual(restoredNotes, clone(state.groups), 'no other metadata was inferred, cleared or normalized');
  const savedTables = server.persistenceTables_(committed.state);
  assert.ok(savedTables.Requests.slice(1).every(row => row[2].length <= 40000));
  const reloaded = server.parsePersistenceTables_(savedTables);
  assert.deepEqual(clone(reloaded), clone(committed.state));
  assert.equal(server.projectPersistencePreview_(reloaded).flatMap(group => group.copies).filter(copy => copy.currentLocation !== copy.home).length, 19);
  const retry = server.preparePersistenceChange_(reloaded, req, { ...services(), makeId() { assert.fail('No IDs on replay'); } });
  assert.equal(retry.replayed, true); assert.equal(retry.result.changes.length, 496);
  assert.equal(JSON.stringify(state), before);
});
