'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const config = { enabled: true, spreadsheetId: 'local-only-fake', collectionId: 'bridge-test', ownerEmail: 'owner@example.com', lockTimeoutMs: 5000 };
const services = { makeId: randomUUID, now: () => '2026-10-09T22:00:00.000Z', digest: text => createHash('sha256').update(text).digest('hex') };
function preview() {
  return { collectionId: config.collectionId, stickerCatalog: Array.from({ length: 100 }, (_, i) => 'A' + String(i).padStart(2, '0')),
    catalogs: { size: ['Medium'], creatureType: ['Humanoid'], race: ['Human', 'n/a'], sex: ['Male'], role: ['Melee'], set: ['Owned Set', 'n/a'],
      paint: ['Painted', 'Unpainted', 'Work in Progress'], home: ['Drawer'], currentLocation: ['Drawer', 'Encounter Box'] },
    groups: ['one', 'two'].map((rootId, index) => ({ rootId, name: rootId === 'one' ? 'First Soldier' : 'Second Soldier', size: 'Medium', creatureType: 'Humanoid',
      race: 'Human', sex: 'Male', role: 'Melee', set: 'Owned Set', setNumber: '4a', paint: 'Painted', home: 'Drawer', notes: '',
      copies: [{ id: rootId + '-01', miniNumber: '01', sticker: 'A0' + index, currentLocation: index ? 'Drawer' : 'Encounter Box', note: '' }] })) };
}
function fixture(data = preview()) {
  const server = vm.createContext({});
  for (const file of ['Persistence.js', 'PersistenceAdapter.js', 'PersistenceContract.js']) vm.runInContext(read(file), server);
  const state = server.migratePreviewForPersistence_(data, randomUUID);
  const settings = { ...config, collectionId: state.collectionId };
  let locked = false, commits = 0, mode = '', caller = config.ownerEmail;
  let book = { spreadsheetId: config.spreadsheetId, sheets: Object.entries(clone(server.persistenceTables_(state))).map(([title, rows], sheetId) => ({
    properties: { sheetId, title, sheetType: 'GRID', gridProperties: { rowCount: rows.length + 10, columnCount: rows[0].length } },
    data: [{ rowData: rows.map(row => ({ values: row.map(stringValue => ({ userEnteredValue: { stringValue } })) })) }]
  })) };
  const sent = [], trace = [];
  const runtime = {
    services, callerEmail: () => caller,
    lock: () => ({ tryLock: () => { trace.push('lock'); if (locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; trace.push('release'); } }),
    read: id => { assert.equal(id, config.spreadsheetId); assert.equal(locked, true); trace.push('read'); return clone(book); },
    commit: (id, batch) => {
      assert.equal(id, config.spreadsheetId); assert.equal(locked, true); trace.push('commit');
      const next = clone(book);
      for (const request of batch.requests) {
        if (request.appendDimension) {
          const { sheetId, length } = request.appendDimension;
          next.sheets.find(sheet => sheet.properties.sheetId === sheetId).properties.gridProperties.rowCount += length;
        } else {
          const { range, rows, fields } = request.updateCells;
          assert.equal(fields, 'userEnteredValue');
          const sheet = next.sheets.find(sheet => sheet.properties.sheetId === range.sheetId);
          const grid = sheet.data[0].rowData;
          while (grid.length <= range.startRowIndex) grid.push({ values: [] });
          rows[0].values.forEach((value, index) => { grid[range.startRowIndex].values[range.startColumnIndex + index] = clone(value); });
        }
      }
      server.persistenceAdapterSnapshot_(next, settings); book = next; commits++;
      if (mode === 'lost') { mode = ''; throw new Error('lost acknowledgment after atomic commit'); }
      return { spreadsheetId: id };
    }
  };
  const load = () => clone(server.persistenceContractLoad_(settings, runtime));
  const send = async request => {
    sent.push(clone(request));
    if (mode === 'failure') { mode = ''; return { ok: false, code: 'READ_FAILED', message: 'Could not read the collection.' }; }
    const result = clone(server.persistenceContractSave_(clone(request), settings, runtime));
    if (mode === 'malformed') { mode = ''; return { ok: true }; }
    return result;
  };
  return { server, config: settings, runtime, trace, sent, load, send,
    stored: () => clone(server.persistenceAdapterSnapshot_(book, settings).state),
    get commits() { return commits; }, set mode(value) { mode = value; }, set caller(value) { caller = value; },
    external(kind, payload) {
      const stored = server.persistenceAdapterSnapshot_(book, settings).state;
      const request = { collectionId: settings.collectionId, requestId: randomUUID(), expectedRevision: stored.revision, kind, payload,
        preconditions: server.persistencePreconditions_(stored, kind, payload, services) };
      const response = clone(server.persistenceContractSave_(request, settings, runtime));
      assert.equal(response.ok, true, JSON.stringify(response)); return response;
    }
  };
}
function client(f, send = f.send) {
  const context = vm.createContext({ setTimeout });
  for (const file of ['SaveFlow.html', 'PersistenceClient.html']) vm.runInContext(read(file).replace(/<\/?script>/g, ''), context);
  const api = vm.runInContext('MiniPersistenceClient', context);
  return api.createTransport({ snapshot: f.load().snapshot, send });
}
function groupTarget(c, id = 'one') {
  const group = c.initialState().groups.find(group => group.rootId === id);
  const before = { ...clone(group), copies: Object.fromEntries(group.copies.map(({ rootId, home, ...copy }) => [copy.id, copy])) };
  return c.capture({ table: 'groups', id, before, value: clone(before) });
}
function request(targets) { return { requestId: randomUUID(), targets: Array.isArray(targets) ? targets : [targets] }; }
module.exports = { fixture, client, preview, groupTarget, request, clone, read, services, repo };
