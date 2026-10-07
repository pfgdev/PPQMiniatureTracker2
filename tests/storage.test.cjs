'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
function context() {
  const server = vm.createContext({ console: { error() {} } });
  vm.runInContext(read('Storage.js'), server);
  vm.runInContext(read('Code.js'), server);
  return server;
}
function fixture(server) {
  const fields = { size: ['Medium'], creatureType: ['Humanoid'], sex: ['Male'], race: ['Human'], role: ['Melee'],
    home: ['Drawer'], currentLocation: ['Drawer', 'Encounter Box'], set: ['Owned Set', 'Unused Set', 'n/a'],
    paint: ['Painted', 'Unpainted', 'Work in Progress'] };
  return {
    Groups: [Array.from(server.PREVIEW_TABLE_COLUMNS_.Groups), ['001-MINI', 'Test mini', 'Medium', 'Humanoid', 'Male', '', 'Melee', 'Drawer', 'Painted', 'Owned Set', '4a', 'Shared note']],
    Copies: [Array.from(server.PREVIEW_TABLE_COLUMNS_.Copies), ['001-MINI-01', '001-MINI', '1', 'A00', 'Encounter Box', ''], ['001-MINI-02', '001-MINI', '2', 'n/a', 'Drawer', '']],
    Lists: [['field', 'value', 'sortOrder'], ...Object.entries(fields).flatMap(([field, values]) => values.map((value, index) => [field, value, String(index + 1)]))],
    Stickers: [['sticker', 'sortOrder'], ['A00', '1'], ['A01', '2'], ['A02', '3']]
  };
}
test('preview reader preserves blanks, away locations, text IDs and separate full catalogs', () => {
  const s = context(), tables = fixture(s), before = JSON.stringify(tables), state = s.parseSpreadsheetPreview_(tables);
  assert.equal(JSON.stringify(tables), before);
  assert.equal(state.previewMode, true);
  assert.equal(state.groups[0].race, '');
  assert.equal(state.groups[0].setNumber, '4a');
  assert.equal(state.groups[0].copies[0].currentLocation, 'Encounter Box');
  assert.equal(state.groups[0].copies[0].home, 'Drawer');
  assert.equal(state.groups[0].copies[1].sticker, 'n/a');
  assert.ok(state.catalogs.set.includes('Unused Set'));
  assert.deepEqual(Array.from(state.homeLocations), ['Drawer']);
  assert.deepEqual(Array.from(state.locations), ['Drawer', 'Encounter Box']);
});
test('adapter reads only the explicit 2.0 workbook and rejects formulas without any write API', () => {
  const s = context(), tables = fixture(s), calls = [];
  let formulas = false;
  s.SpreadsheetApp = { openById(id) {
    assert.equal(id, '1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY');
    return { getSheetByName(title) { calls.push(title); return { getDataRange() { return {
      getDisplayValues: () => tables[title], getFormulas: () => formulas ? [['=A1']] : [['']]
    }; } }; } };
  } };
  assert.equal(s.buildSpreadsheetPreviewState_().groups.length, 1);
  assert.deepEqual(calls, ['Groups', 'Copies', 'Lists', 'Stickers']);
  formulas = true;
  assert.throws(() => s.buildSpreadsheetPreviewState_(), /literal values/);
});
const failures = [
  ['missing table', t => delete t.Groups, /headers/],
  ['changed schema', t => t.Groups[0][0] = 'renamed', /headers/],
  ['empty collection', t => t.Groups.splice(1), /unexpectedly empty/],
  ['duplicate group', t => t.Groups.push(t.Groups[1].slice()), /group identity/],
  ['orphan copy', t => t.Copies[1][1] = 'missing', /parent relationship/],
  ['duplicate copy', t => t.Copies[2][0] = t.Copies[1][0], /copy identity/],
  ['duplicate sticker', t => t.Copies[2][3] = 'a00', /sticker assignment/],
  ['duplicate sequence', t => t.Copies[2][2] = '1', /copy sequence/],
  ['unknown location', t => t.Copies[1][4] = 'Elsewhere', /current location/],
  ['blank location', t => t.Copies[1][4] = '', /current location/],
  ['duplicate catalog order', t => t.Stickers[2][1] = '1', /catalog ordering/],
  ['incomplete catalog', t => t.Lists = t.Lists.filter(row => row[0] !== 'home'), /missing catalog/],
  ['unknown field', t => t.Lists.push(['mystery', 'Value', '1']), /catalog field/],
  ['unknown paint', t => t.Groups[1][8] = 'Maybe', /stored paint/],
  ['missing assigned sticker in catalog', t => t.Stickers.splice(1, 1), /outside catalog/]
];
for (const [label, mutate, expected] of failures) test(`reader fails visibly for ${label}`, () => {
  const s = context(), tables = fixture(s); mutate(tables);
  assert.throws(() => s.parseSpreadsheetPreview_(tables), expected);
});
test('doGet reports a load failure instead of substituting the mock collection', () => {
  const s = context(); let template;
  s.HtmlService = { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createTemplateFromFile() {
    template = { evaluate() { return this; }, setTitle() { return this; }, setXFrameOptionsMode() { return this; } };
    return template;
  } };
  s.buildSpreadsheetPreviewState_ = () => { throw new Error('Not authorized'); };
  s.buildMockAppState_ = () => { throw new Error('Must not use mock fallback'); };
  s.doGet();
  assert.deepEqual(JSON.parse(template.initialStateJson), { loadError: true });
});
test('failed import audit cannot generate a write batch and the app exposes no write calls', () => {
  const { buildFirstImportPlan } = require('../tools/import-write-plan.cjs');
  assert.throws(() => buildFirstImportPlan({ formatVersion: 1, source: {}, destination: { sheets: [] } }), /clean audit/);
  const source = read('Storage.js');
  assert.doesNotMatch(source, /\.setValues?\(|\.deleteSheet\(|\.insertSheet\(/);
  assert.doesNotMatch(read('Scripts.html'), /google\.script\.run|\bfetch\s*\(|XMLHttpRequest/);
});
