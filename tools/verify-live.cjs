'use strict';
// Read-only local verification of Google captures made during the one-time rollout.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { tables } = require('./prepare-live.cjs');
const dir = '.local/live/';
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'));
const baseline = process.argv[2] === 'baseline';
assert(baseline || process.argv[2] === 'migration', 'Use migration or baseline');
const captured = read(baseline ? 'baseline-capture.json' : 'migrated-capture.json');
const config = read('config.json');
assert.equal(captured.spreadsheetId, baseline ? read('baseline.json').id : config.spreadsheetId);
const actual = tables(captured);
assert.deepEqual(Object.keys(actual).sort(), ['Copies', 'Groups', 'Lists', 'Metadata', 'Requests', 'Stickers']);
const server = vm.createContext({ console });
for (const file of ['Persistence.js', 'PersistenceAdapter.js', 'PersistenceContract.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), server, { filename: file });
}
const state = JSON.parse(JSON.stringify(server.parsePersistenceTables_(actual)));
assert.deepEqual(state, read('candidate-state.json'), 'Stored collection differs from reviewed migration');
assert.equal(state.collectionId, config.collectionId);
assert.equal(state.revision, 0);
for (const sheet of captured.sheets) {
  assert.equal(sheet.properties.gridProperties.frozenRowCount, 1);
  const header = sheet.data[0].rowData[0].values;
  for (let i = 0; i < actual[sheet.properties.title][0].length; i++) {
    assert.equal(header[i].userEnteredFormat.textFormat.bold, true);
    assert.equal(header[i].userEnteredFormat.numberFormat.type, 'TEXT');
  }
}
const result = { verifiedAt: new Date().toISOString(), spreadsheetId: captured.spreadsheetId,
  collectionId: state.collectionId, schemaVersion: state.schemaVersion, revision: state.revision,
  exactMatch: true, groups: state.groups.length, copies: state.copies.length, sheets: Object.keys(actual) };
fs.writeFileSync(dir + (baseline ? 'baseline-verified.json' : 'migration-verified.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
