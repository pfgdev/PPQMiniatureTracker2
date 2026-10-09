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
const services = { makeId: randomUUID, digest: text => createHash('sha256').update(text).digest('hex'),
  now: () => '2026-10-09T20:00:00.000Z' };
const config = { enabled: true, spreadsheetId: 'disposable-fake', collectionId: 'test-collection',
  ownerEmail: 'owner@example.com', lockTimeoutMs: 5000 };

function serverContext() {
  const server = vm.createContext({});
  for (const file of ['Persistence.js', 'PersistenceAdapter.js']) vm.runInContext(read(file), server);
  return server;
}
function preview() {
  return { collectionId: config.collectionId, stickerCatalog: ['A00', 'A01', 'A02'],
    catalogs: { size: ['Medium'], creatureType: ['Humanoid'], sex: ['Male'], race: ['Human'], role: ['Melee'],
      home: ['Drawer'], currentLocation: ['Drawer', 'Encounter'], paint: ['Painted', 'Unpainted', 'Work in Progress'], set: ['n/a'] },
    groups: ['one', 'two'].map((rootId, i) => ({ rootId, name: rootId, size: 'Medium', creatureType: 'Humanoid', sex: 'Male',
      race: 'Human', role: 'Melee', home: 'Drawer', paint: 'Painted', set: 'n/a', setNumber: '', notes: '',
      copies: [{ id: rootId + '-01', rootId, miniNumber: '01', sticker: 'A0' + i, currentLocation: 'Drawer', note: '' }] })) };
}
function bookFromTables(tables, tight = false) {
  return { spreadsheetId: config.spreadsheetId, sheets: Object.entries(tables).map(([title, rows], sheetId) => ({
    properties: { title, sheetId, sheetType: 'GRID', gridProperties: {
      rowCount: tight ? rows.length : rows.length + 100, columnCount: rows[0].length + 3 } },
    data: [{ rowData: rows.map(row => ({ values: row.map(stringValue => ({ userEnteredValue: { stringValue },
      note: 'preserve annotation', userEnteredFormat: { numberFormat: { type: 'TEXT' } } })) })) }]
  })) };
}
function applyBatch(book, body) {
  const next = clone(book);
  assert.deepEqual(Object.keys(body).sort(), ['includeSpreadsheetInResponse', 'requests']);
  assert.equal(body.includeSpreadsheetInResponse, false);
  assert.ok(body.requests.length);
  for (const request of body.requests) {
    assert.equal(Object.keys(request).length, 1);
    if (request.appendDimension) {
      const { sheetId, dimension, length } = request.appendDimension;
      assert.equal(dimension, 'ROWS'); assert.ok(Number.isSafeInteger(length) && length > 0);
      const sheet = next.sheets.find(item => item.properties.sheetId === sheetId);
      assert.ok(sheet); sheet.properties.gridProperties.rowCount += length;
    } else {
      assert.ok(request.updateCells, 'only cell patches or grid expansion belong in a save');
      const { range, rows, fields } = request.updateCells;
      assert.equal(fields, 'userEnteredValue');
      const sheet = next.sheets.find(item => item.properties.sheetId === range.sheetId);
      assert.ok(sheet);
      assert.ok(range.startRowIndex > 0, 'never rewrite headers');
      assert.equal(range.endRowIndex, range.startRowIndex + 1);
      assert.ok(range.endRowIndex <= sheet.properties.gridProperties.rowCount);
      assert.ok(range.endColumnIndex <= sheet.properties.gridProperties.columnCount);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].values.length, range.endColumnIndex - range.startColumnIndex);
      const grid = sheet.data[0].rowData;
      while (grid.length <= range.startRowIndex) grid.push({});
      const values = grid[range.startRowIndex].values ||= [];
      rows[0].values.forEach((cell, i) => {
        assert.deepEqual(Object.keys(cell), ['userEnteredValue']);
        assert.deepEqual(Object.keys(cell.userEnteredValue), ['stringValue']);
        assert.equal(typeof cell.userEnteredValue.stringValue, 'string');
        const col = range.startColumnIndex + i;
        while (values.length <= col) values.push({});
        values[col].userEnteredValue = clone(cell.userEnteredValue);
      });
    }
  }
  return next;
}
function fixture(options = {}) {
  const server = serverContext();
  const state = server.migratePreviewForPersistence_(options.preview || preview(), randomUUID);
  const tables = clone(server.persistenceTables_(state));
  if (options.reorder) {
    for (const [title, rows] of Object.entries(tables)) tables[title] = [rows[0].slice().reverse(), [],
      ...rows.slice(1).reverse().map(row => row.slice().reverse()), [], []];
  }
  let book = bookFromTables(tables, options.tight), locked = false, commits = 0, mode = '', readError = false;
  const trace = [], batches = [];
  const runtime = {
    callerEmail: () => { trace.push('authorize'); return config.ownerEmail; },
    lock: () => ({
      tryLock: ms => { trace.push('lock'); assert.equal(ms, 5000); if (locked) return false; locked = true; return true; },
      releaseLock: () => { trace.push('release'); assert.ok(locked); locked = false; }
    }),
    read: (id, options) => {
      trace.push('read'); assert.ok(locked); assert.equal(id, config.spreadsheetId);
      assert.equal(options.ranges.length, 6); assert.match(options.fields, /userEnteredValue/);
      if (readError) throw new Error('read timeout');
      return clone(book);
    },
    commit: (id, body) => {
      trace.push('commit'); assert.ok(locked); assert.equal(id, config.spreadsheetId); commits++;
      batches.push(clone(body));
      const candidate = applyBatch(book, clone(body));
      server.persistenceAdapterSnapshot_(candidate, config);
      if (mode === 'reject') throw new Error('server rejected entire batch');
      book = candidate;
      if (mode === 'lost') throw new Error('response lost AFTER commit');
      if (mode === 'no-ack') return {};
      return { spreadsheetId: id };
    }, services
  };
  return { server, state, runtime, trace, batches,
    get book() { return book; }, set book(value) { book = value; },
    get commits() { return commits; }, get locked() { return locked; }, set locked(value) { locked = value; },
    set mode(value) { mode = value; }, set readError(value) { readError = value; },
    stored: () => server.persistenceAdapterSnapshot_(book, config).state,
    execute: req => server.persistenceAdapterExecute_(req, config, runtime) };
}
function payload(state, root = 'one') {
  const { rootId, deletedAt, ...fields } = clone(state.groups.find(group => group.rootId === root));
  return { rootId, fields, copies: state.copies.filter(copy => copy.rootId === root && !copy.deletedAt)
    .map(({ id, sticker, currentLocationId, note }) => ({ id, clientKey: id, sticker, currentLocationId, note })) };
}
function request(f, kind = 'saveGroup', value = payload(f.state)) {
  return { collectionId: config.collectionId, requestId: randomUUID(), expectedRevision: f.state.revision, kind, payload: value,
    preconditions: f.server.persistencePreconditions_(f.state, kind, value, services) };
}
function reject(f, req, code) {
  const input = JSON.stringify(req), before = JSON.stringify(f.book), count = f.commits;
  assert.throws(() => f.execute(req), error => error.code === code);
  assert.equal(JSON.stringify(f.book), before); assert.equal(JSON.stringify(req), input);
  assert.equal(f.commits, count); assert.equal(f.locked, false);
}
function sheet(f, title) { return f.book.sheets.find(item => item.properties.title === title); }

test('default private entry fails disabled before touching any Google service', () => {
  const server = serverContext();
  assert.equal(server.persistenceAdapterConfig_().enabled, false);
  assert.equal(server.persistenceAdapterConfig_().spreadsheetId, '');
  assert.throws(() => server.savePersistenceRequest_({}), error => error.code === 'DISABLED');
});
for (const caller of ['', 'stranger@example.com', null, 'throws']) {
  test(`unauthorized caller ${caller} cannot acquire a lock or read a workbook`, () => {
    const f = fixture(); f.runtime.callerEmail = () => { if (caller === 'throws') throw Error('identity unavailable'); return caller; };
    reject(f, request(f), 'FORBIDDEN'); assert.deepEqual(f.trace, []);
  });
}
test('configuration is server-owned; incomplete settings and mismatched request collection fail before reads', () => {
  const f = fixture();
  for (const key of ['ownerEmail', 'spreadsheetId', 'collectionId', 'lockTimeoutMs']) {
    assert.throws(() => f.server.persistenceAdapterExecute_(request(f), { ...config, [key]: '' }, f.runtime), error => error.code === 'INVALID');
  }
  reject(f, { ...request(f), collectionId: 'client-selected-destination' }, 'INVALID');
  assert.deepEqual(f.trace, ['authorize']);
});
test('busy lock does not read, write, or release another execution lock', () => {
  const f = fixture(); f.locked = true;
  assert.throws(() => f.execute(request(f)), error => error.code === 'BUSY');
  assert.deepEqual(f.trace, ['authorize', 'lock']); assert.equal(f.commits, 0); assert.equal(f.locked, true);
});
test('read failure releases lock without writing', () => {
  const f = fixture(); f.readError = true; reject(f, request(f), 'READ_FAILED');
  assert.deepEqual(f.trace, ['authorize', 'lock', 'read', 'release']);
});
test('overlapping save waits for the lock boundary and only one repeated request commits', () => {
  const f = fixture(), req = request(f), originalRead = f.runtime.read;
  f.runtime.read = (id, options) => {
    assert.throws(() => f.execute(req), error => error.code === 'BUSY');
    return originalRead(id, options);
  };
  f.execute(req); f.runtime.read = originalRead;
  assert.equal(f.execute(req).replayed, true); assert.equal(f.commits, 1); assert.equal(f.locked, false);
});
test('preparation failure releases lock and leaves spreadsheet and draft unchanged', () => {
  const f = fixture(), value = payload(f.state); value.rootId = '';
  value.copies = [{ ...value.copies[0], id: '', sticker: '' }];
  f.runtime.services = { ...services, makeId: () => 'not-a-uuid' };
  reject(f, request(f, 'saveGroup', value), 'INVALID'); assert.equal(f.trace.at(-1), 'release');
});
for (const reorder of [false, true]) {
  test(`patch only changed cells, preserve physical headers/rows/formatting with reorder=${reorder}`, () => {
    const f = fixture({ reorder }), value = payload(f.state);
    value.fields.notes = '=SUM(1,2) literal text'; value.copies[0].note = '+not a formula';
    const req = request(f, 'saveGroup', value), original = JSON.stringify(req);
    const before = clone(f.book), result = f.execute(req);
    assert.equal(JSON.stringify(req), original); assert.equal(result.result.revision, 1); assert.equal(result.replayed, false);
    assert.deepEqual(f.trace, ['authorize', 'lock', 'read', 'commit', 'release']);
    assert.equal(f.commits, 1);
    const patches = f.batches[0].requests.filter(item => item.updateCells).map(item => item.updateCells);
    assert.equal(patches.length, 4, 'notes, copy note, revision, receipt');
    assert.equal(patches.filter(item => item.rows[0].values.length === 1).length, 3);
    for (const untouched of ['Lists', 'Stickers']) assert.deepEqual(sheet(f, untouched), before.sheets.find(s => s.properties.title === untouched));
    for (const title of ['Groups', 'Copies', 'Metadata']) {
      const actual = sheet(f, title), previous = before.sheets.find(s => s.properties.title === title);
      assert.deepEqual(actual.data[0].rowData[0], previous.data[0].rowData[0]);
      actual.data[0].rowData.forEach((row, r) => (row.values || []).forEach((cell, c) => {
        assert.deepEqual(cell.userEnteredFormat, previous.data[0].rowData[r].values[c].userEnteredFormat);
        assert.equal(cell.note, 'preserve annotation');
      }));
    }
    assert.equal(f.stored().groups.find(g => g.rootId === 'one').notes, value.fields.notes);
    assert.equal(f.stored().groups.find(g => g.rootId === 'two').notes, '');
  });
}
test('append new group/copies/receipt and expand grids in the same batch without reusing blank rows', () => {
  const f = fixture({ tight: true, reorder: true }), value = payload(f.state); value.rootId = '';
  value.copies = [{ ...value.copies[0], id: '', sticker: 'A02' }];
  const oldRows = sheet(f, 'Groups').data[0].rowData.length;
  const result = f.execute(request(f, 'saveGroup', value));
  const state = f.stored();
  assert.equal(state.groups.length, 3); assert.equal(state.copies.length, 3); assert.equal(state.receipts.length, 1);
  assert.equal(state.copies.find(c => c.id === result.result.createdCopies[0].id).rootId, result.result.rootId);
  assert.equal(f.commits, 1);
  // Trailing blank rows may be filled; interior blank rows remain untouched.
  assert.ok(sheet(f, 'Groups').data[0].rowData.length >= oldRows);
  assert.deepEqual(sheet(f, 'Groups').data[0].rowData[1], { values: [] });
  assert.ok(f.batches[0].requests.some(r => r.updateCells && r.updateCells.range.startRowIndex >= 4));
});
test('tight grids are expanded before their appended data, including receipt-only tab', () => {
  const f = fixture({ tight: true }), value = payload(f.state); value.rootId = '';
  value.copies = [{ ...value.copies[0], id: '', sticker: '' }];
  f.execute(request(f, 'saveGroup', value));
  assert.equal(f.batches[0].requests.filter(r => r.appendDimension).length, 3);
});
for (const corruption of ['destination', 'collection', 'missing-tab', 'header', 'formula', 'number', 'extra-cell', 'merge', 'partial-grid', 'duplicate-sheet-id', 'schema']) {
  test(`reject malformed storage (${corruption}) before commit and release lock`, () => {
    const f = fixture(), group = sheet(f, 'Groups'), metadata = sheet(f, 'Metadata');
    if (corruption === 'destination') f.book.spreadsheetId = 'wrong';
    if (corruption === 'collection') metadata.data[0].rowData[2].values[1].userEnteredValue.stringValue = 'wrong';
    if (corruption === 'missing-tab') f.book.sheets.pop();
    if (corruption === 'header') group.data[0].rowData[0].values[0].userEnteredValue.stringValue = 'unknown';
    if (corruption === 'formula') group.data[0].rowData[1].values[1].userEnteredValue = { formulaValue: '="one"' };
    if (corruption === 'number') sheet(f, 'Copies').data[0].rowData[1].values[2].userEnteredValue = { numberValue: 1 };
    if (corruption === 'extra-cell') group.data[0].rowData[1].values.push({ userEnteredValue: { stringValue: 'do not overwrite' } });
    if (corruption === 'merge') group.merges = [{ startRowIndex: 0, endRowIndex: 2 }];
    if (corruption === 'partial-grid') group.data[0].startRow = 1;
    if (corruption === 'duplicate-sheet-id') group.properties.sheetId = metadata.properties.sheetId;
    if (corruption === 'schema') metadata.data[0].rowData[1].values[1].userEnteredValue.stringValue = '1';
    reject(f, request(f), 'INVALID'); assert.equal(f.trace.at(-1), 'release');
  });
}
test('invalid draft and same-record conflicts do not issue writes or lose input', () => {
  const f = fixture(), value = payload(f.state); value.fields.name = '';
  reject(f, request(f, 'saveGroup', value), 'INVALID');
  const stale = request(f); f.execute(request(f, 'saveLocations', { rootId: 'one', copies: [{ id: 'one-01',
    currentLocationId: f.state.choices.find(c => c.value === 'Encounter').id }] }));
  reject(f, stale, 'STALE');
});
test('stale unrelated edits reread under lock and preserve the earlier save', () => {
  const f = fixture(), one = payload(f.state), two = payload(f.state, 'two');
  one.fields.notes = 'first'; two.fields.notes = 'second';
  f.execute(request(f, 'saveGroup', one)); f.execute(request(f, 'saveGroup', two));
  assert.equal(f.stored().revision, 2); assert.equal(f.stored().groups.find(g => g.rootId === 'one').notes, 'first');
  assert.equal(f.stored().groups.find(g => g.rootId === 'two').notes, 'second');
});
for (const mode of ['reject', 'lost', 'no-ack']) {
  test(`uncertain save (${mode}) retains exact input and safely retries without duplicated creation`, () => {
    const f = fixture(), value = payload(f.state); value.rootId = '';
    value.copies = [{ ...value.copies[0], id: '', sticker: 'A02' }];
    const req = request(f, 'saveGroup', value), original = JSON.stringify(req), before = JSON.stringify(f.book);
    f.mode = mode;
    assert.throws(() => f.execute(req), error => error.code === 'SAVE_UNCERTAIN' && error.details.requestId === req.requestId);
    assert.equal(JSON.stringify(req), original); assert.equal(f.locked, false);
    if (mode === 'reject') assert.equal(JSON.stringify(f.book), before);
    f.mode = ''; const result = f.execute(req), state = f.stored();
    assert.equal(result.replayed, mode !== 'reject'); assert.equal(f.commits, mode === 'reject' ? 2 : 1);
    assert.equal(state.revision, 1); assert.equal(state.groups.length, 3); assert.equal(state.copies.length, 3);
    assert.equal(state.receipts.length, 1); assert.deepEqual(clone(result.result), clone(state.receipts[0].result));
    const changed = clone(req); changed.payload.fields.name = 'different'; reject(f, changed, 'REQUEST_REUSED');
  });
}
test('old receipt replays after subsequent changes without rewinding current state', () => {
  const f = fixture(), first = request(f), second = request(f, 'saveGroup', payload(f.state, 'two'));
  const result = f.execute(first); f.execute(second);
  const replay = f.execute(first);
  assert.equal(replay.currentRevision, 2); assert.equal(replay.replayed, true); assert.equal(f.commits, 2);
  assert.deepEqual(clone(replay.result), clone(result.result));
});
test('save all commits sticker exchange together; bad member prevents the entire batch', () => {
  const f = fixture(), one = payload(f.state), two = payload(f.state, 'two');
  one.copies[0].sticker = 'A01'; two.copies[0].sticker = 'A00';
  const value = { changes: [{ clientKey: '1', kind: 'saveGroup', payload: one }, { clientKey: '2', kind: 'saveGroup', payload: two }] };
  const bad = clone(value); bad.changes[1].payload.fields.name = '';
  reject(f, request(f, 'saveBatch', bad), 'INVALID');
  f.execute(request(f, 'saveBatch', value));
  assert.equal(f.commits, 1); assert.equal(f.stored().receipts.length, 1); assert.equal(f.stored().revision, 1);
  assert.equal(f.stored().copies.find(c => c.id === 'one-01').sticker, 'A01');
  assert.equal(f.stored().copies.find(c => c.id === 'two-01').sticker, 'A00');
});
test('soft deletion, restore and list edits patch existing rows without removing identities', () => {
  const f = fixture();
  f.execute(request(f, 'deleteGroup', { rootId: 'one' }));
  assert.ok(f.stored().groups.find(g => g.rootId === 'one').deletedAt);
  f.state = f.stored(); f.execute(request(f, 'restoreGroup', { rootId: 'one' }));
  const race = f.state.choices.find(c => c.field === 'race' && c.value === 'Human');
  f.state = f.stored(); f.execute(request(f, 'saveChoice', { id: race.id, field: 'race', value: 'Humans', home: false }));
  f.state = f.stored(); f.execute(request(f, 'removeChoice', { id: race.id }));
  f.state = f.stored(); f.execute(request(f, 'restoreChoice', { id: race.id }));
  const stored = f.stored(); assert.equal(stored.groups.length, 2); assert.equal(stored.copies.length, 2);
  assert.equal(stored.choices.find(c => c.id === race.id).value, 'Humans');
  assert.equal(stored.choices.find(c => c.id === race.id).removedAt, '');
  assert.equal(stored.groups.find(g => g.rootId === 'one').deletedAt, '');
});
test('350 new groups store multi-piece receipt and replay identical copy IDs with one commit', () => {
  const f = fixture({ tight: true }), value = payload(f.state); value.rootId = '';
  value.copies = [{ ...value.copies[0], id: '', sticker: '' }];
  const changes = Array.from({ length: 350 }, (_, i) => ({ clientKey: 'new-' + i, kind: 'saveGroup', payload: clone(value) }));
  const req = request(f, 'saveBatch', { changes }), first = f.execute(req), replay = f.execute(req);
  assert.equal(f.commits, 1); assert.equal(f.stored().groups.length, 352); assert.equal(f.stored().receipts.length, 1);
  assert.ok(sheet(f, 'Requests').data[0].rowData.length > 2);
  assert.deepEqual(clone(first.result), clone(replay.result));
});
test('unrelated worksheets, trailing formatting and omitted empty cells remain untouched', () => {
  const f = fixture(), group = sheet(f, 'Groups');
  const unrelated = { properties: { title: 'Personal notes', sheetId: 99 }, data: [{ rowData: [
    { values: [{ userEnteredValue: { formulaValue: '=1+1' } }] }
  ] }] };
  f.book.sheets.push(clone(unrelated));
  group.data[0].rowData[1].values.pop(); // omitted deletedAt
  group.data[0].rowData.push({ values: [{ userEnteredFormat: { textFormat: { bold: true } } }] });
  const empty = clone(group.data[0].rowData.at(-1));
  const value = payload(f.state); value.fields.name = 'updated';
  f.execute(request(f, 'saveGroup', value));
  assert.deepEqual(sheet(f, 'Personal notes'), unrelated);
  assert.deepEqual(sheet(f, 'Groups').data[0].rowData.at(-1), empty);
  assert.equal(f.stored().groups[0].deletedAt, '');
});
test('release failure cannot erase an acknowledged commit or block receipt replay', () => {
  const f = fixture(), originalLock = f.runtime.lock;
  f.runtime.lock = () => {
    const lock = originalLock();
    return { ...lock, releaseLock: () => { lock.releaseLock(); throw Error('release response lost'); } };
  };
  const req = request(f); assert.equal(f.execute(req).result.revision, 1);
  assert.equal(f.execute(req).replayed, true); assert.equal(f.commits, 1);
});
test('Apps Script bridge uses active caller, script lock, Sheets argument order and signed-byte SHA-256', () => {
  const server = serverContext(), calls = [];
  server.Session = { getActiveUser: () => ({ getEmail: () => config.ownerEmail }) };
  server.LockService = { getScriptLock: () => 'script-lock' };
  server.Sheets = { Spreadsheets: {
    get: (id, options) => { calls.push(['get', id, options]); return 'read'; },
    batchUpdate: (body, id) => { calls.push(['commit', body, id]); return 'written'; }
  } };
  server.Utilities = { getUuid: randomUUID, DigestAlgorithm: { SHA_256: 'sha' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, text, charset) => {
      assert.equal(algorithm, 'sha'); assert.equal(charset, 'utf8');
      return Array.from(createHash('sha256').update(text).digest(), byte => byte > 127 ? byte - 256 : byte);
    } };
  const runtime = server.persistenceAdapterRuntime_();
  assert.equal(runtime.callerEmail(), config.ownerEmail); assert.equal(runtime.lock(), 'script-lock');
  assert.equal(runtime.read('id', { ranges: ['Groups'] }), 'read');
  assert.equal(runtime.commit('id', { requests: [] }), 'written');
  assert.deepEqual(calls, [['get', 'id', { ranges: ['Groups'] }], ['commit', { requests: [] }, 'id']]);
  assert.equal(runtime.services.digest('literal \u00e9 \ud83c\udfb2'), services.digest('literal \u00e9 \ud83c\udfb2'));
  assert.match(runtime.services.makeId(), /^[a-f\d-]{36}$/i);
  assert.ok(Number.isFinite(Date.parse(runtime.services.now())));
});

const imported = path.join(repo, '.local/import/import-readback.json');
test('optional imported 496-group commit preserves all 612 copies, blanks and away locations', { skip: !fs.existsSync(imported) }, () => {
  const server = serverContext(); vm.runInContext(read('Storage.js'), server);
  const snapshot = JSON.parse(fs.readFileSync(imported, 'utf8'));
  const tables = Object.fromEntries(snapshot.destination.sheets.map(sheet => [sheet.title, sheet.values]));
  const importedPreview = server.parseSpreadsheetPreview_(tables); importedPreview.collectionId = config.collectionId;
  const f = fixture({ preview: importedPreview, reorder: true, tight: true }), before = f.stored();
  const changes = f.state.groups.map(group => {
    const value = payload(f.state, group.rootId); value.fields.notes += '\nOffline transport rehearsal.';
    return { clientKey: group.rootId, kind: 'saveGroup', payload: value };
  });
  const req = request(f, 'saveBatch', { changes }); f.mode = 'lost';
  assert.throws(() => f.execute(req), error => error.code === 'SAVE_UNCERTAIN');
  f.mode = ''; const replay = f.execute(req), after = f.stored();
  assert.equal(f.commits, 1); assert.equal(replay.replayed, true); assert.equal(after.revision, 1);
  assert.equal(after.receipts.length, 1); assert.equal(after.groups.length, 496); assert.equal(after.copies.length, 612);
  assert.deepEqual(clone(after.copies), clone(before.copies)); assert.deepEqual(clone(after.choices), clone(before.choices));
  const originalById = new Map(before.groups.map(g => [g.rootId, g]));
  after.groups.forEach(group => {
    const original = originalById.get(group.rootId);
    assert.deepEqual({ ...clone(group), notes: original.notes }, clone(original));
    assert.equal(group.notes, original.notes + '\nOffline transport rehearsal.');
  });
  const projected = f.server.projectPersistencePreview_(after);
  assert.equal(projected.flatMap(g => g.copies).filter(c => c.home !== c.currentLocation).length, 19);
  assert.equal(f.batches[0].requests.filter(r => r.updateCells && r.updateCells.range.sheetId === sheet(f, 'Groups').properties.sheetId).length, 496);
  assert.ok(Buffer.byteLength(JSON.stringify(f.batches[0])) < 2_000_000, 'representative batch stays below recommended API payload size');
});

test('adapter stays private and preview fixtures remain disconnected from the writer', () => {
  for (const match of read('PersistenceAdapter.js').matchAll(/^function\s+(\w+)\(/gm)) assert.ok(match[1].endsWith('_'));
  assert.equal(JSON.parse(read('.clasp.json')).rootDir, '.local/live/app');
  assert.match(read('.claspignore'), /^!PersistenceAdapter\.js$/m);
  for (const file of ['Code.js', 'Storage.js', 'Scripts.html']) assert.doesNotMatch(read(file), /savePersistenceRequest_|persistenceAdapterExecute_/);
});
