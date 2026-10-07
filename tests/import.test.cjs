'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SOURCE_ID, DESTINATION_ID, analyzeImport, toAppState } = require('../tools/import-core.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
function sheet(title, values, columns = 26) {
  const end = columns <= 26 ? String.fromCharCode(64 + columns) : 'A' + String.fromCharCode(64 + columns - 26);
  const rows = Math.max(40, values.length);
  return { title, sheetId: title, rowCount: rows, columnCount: columns, range: `A1:${end}${rows}`, values };
}
function fixture() {
  const entry = [[], [], [], [],
    ['', 'Root ID', 'Name', 'Quantity', '', 'Size', 'Creature Type', '', 'Sex', 'Race', 'Role', '', 'Home', '', 'Paint', 'Set', 'Set #', '', 'Notes'],
    ['', '001-TEST', 'Test <one>', '2', '', 'Medium', 'Humanoid', '', 'Male', 'Human', 'Melee', '', 'Drawer', '', 'TRUE', 'Set A', '007', '', 'Shared note'],
    ['', '002-TEST', 'Test two', '1', '', 'Small', 'Fey', '', 'n/a', 'n/a', 'Other', '', 'Drawer', '', 'FALSE', 'n/a', '', '', '']];
  const master = [['', 'ID', 'Root ID', 'Mini #', 'Sticker', '', 'Current Loc', '', 'Name', 'Quantity', 'Size', 'Creature Type', 'Sex', 'Race', 'Role', 'Home', 'Paint', 'Set', 'Set #', 'Notes']];
  for (const [groupIndex, number, sticker, location] of [[5, 1, 'A00', 'Drawer'], [5, 2, 'n/a', 'Quest'], [6, 1, 'A02', 'Drawer']]) {
    const group = entry[groupIndex];
    master.push(['', `${group[1]}-0${number}`, group[1], String(number), sticker, '', location, '', ...[2, 3, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18].map(column => group[column])]);
  }
  const lists = [[]];
  for (const [column, header, values] of [
    [5, 'Size', ['Medium', 'Small']], [7, 'Creature Type', ['Humanoid', 'Fey']], [9, 'Sex', ['Male', 'n/a']],
    [11, 'Race', ['Human', 'n/a']], [13, 'Role', ['Melee', 'Other']], [14, 'Set', ['Set A', 'n/a', 'Unused Set']],
    [16, 'Home', ['Drawer']], [17, 'Additional Locations', ['Quest']], [18, 'Locations', ['Drawer', 'Quest']],
    [21, 'Stickers', ['A00', 'A01', 'A02', 'A03', 'n/a']], [22, 'Unassigned Stickers', ['A01', 'A03', 'n/a']], [23, 'Assigned Stickers', ['A00', 'A02']]
  ]) {
    lists[0][column] = header;
    values.forEach((value, index) => { (lists[index + 1] ||= [])[column] = value; });
  }
  const assignments = [[], [], [], [], []];
  assignments[4][1] = 'ID'; assignments[4][3] = 'Sticker'; assignments[4][10] = 'Sticker';
  const checkout = [[]]; checkout[0][6] = 'Root ID'; checkout[0][34] = 'Hidden Column for Mini IDs';
  return { formatVersion: 1, capturedAt: '2026-10-07T06:00:00Z',
    source: { spreadsheetId: SOURCE_ID, modifiedTimeBefore: '2026-10-01T00:00:00Z', modifiedTimeAfter: '2026-10-01T00:00:00Z', sheets: [
      sheet('Entry Form', entry), sheet('Master Inventory', master), sheet('Data Lists', lists), sheet('Sticker Assignment', assignments),
      sheet('Check Out Minis', checkout, 37), sheet('Deleted Minis', [['Deleted ID']]), sheet('Settings', [['26']]), sheet('Checked Out Log', [])
    ] }, destination: { spreadsheetId: DESTINATION_ID, sheets: [sheet('MiniatureDataTable', [['test0', 'test1']])] } };
}
const values = (snapshot, title) => snapshot.source.sheets.find(item => item.title === title).values;
const codes = result => result.report.issues.map(issue => issue.code);
const analyze = mutate => { const snapshot = fixture(); mutate(snapshot); return analyzeImport(snapshot); };

test('fresh import preserves identities, locations, text and optional notes without altering input', () => {
  const snapshot = fixture(), before = JSON.stringify(snapshot), result = analyzeImport(snapshot);
  assert.equal(result.report.blockers, 0);
  assert.equal(result.report.warnings, 0);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(result.report.stats.groups, 2);
  assert.equal(result.report.stats.copies, 3);
  assert.equal(result.report.stats.away, 1);
  assert.equal(result.candidate.tables.Groups[1][10], '007');
  assert.equal(result.candidate.tables.Groups[1][8], 'Painted');
  assert.equal(result.candidate.tables.Groups[2][8], 'Unpainted');
  assert.equal(result.candidate.tables.Copies[1].at(-1), '');
  assert.equal(result.report.remoteWritesPerformed, false);
  assert.equal(result.report.approvalRequired, true);
  assert.deepEqual(result.report.destination.preservedTabs, [{ title: 'MiniatureDataTable', populatedCells: 2 }]);
  assert.ok(result.candidate.tables.Lists.some(row => row[1] === 'Unused Set'));
  assert.ok(result.candidate.tables.Lists.some(row => row[1] === 'Work in Progress'));
  const app = toAppState(result.candidate);
  assert.equal(app.prototypeMode, true);
  assert.equal(app.groups[0].copies[1].currentLocation, 'Quest');
  assert.equal(app.groups[0].copies[1].home, 'Drawer');
});

test('catalog difference recovers earlier gaps and excludes the n/a sentinel', () => {
  const result = analyzeImport(fixture());
  assert.equal(result.report.stats.nextAvailableSticker, 'A01');
  assert.equal(result.report.stats.availableStickers, 2);
  assert.equal(result.report.stats.stickerCatalog, 4);
  assert.equal(result.report.stats.notApplicableStickers, 1);
  assert.ok(!result.candidate.tables.Stickers.some(row => row[0] === 'n/a'));
});

test('empty preset form checkboxes are ignored but unsubmitted definitions are blocked', () => {
  assert.equal(analyze(s => values(s, 'Entry Form').push(Array.from({ length: 19 }, (_, i) => i === 14 ? 'FALSE' : ''))).report.blockers, 0);
  assert.ok(codes(analyze(s => values(s, 'Entry Form').push(['', '', 'Unsubmitted new mini']))).includes('INVALID_ID'));
});

test('missing Race and named Set number are preserved warnings, not invented defaults', () => {
  const result = analyze(s => {
    values(s, 'Entry Form')[5][9] = ''; values(s, 'Entry Form')[5][16] = '';
    for (const row of values(s, 'Master Inventory').slice(1, 3)) { row[13] = ''; row[18] = ''; }
  });
  assert.equal(result.report.blockers, 0);
  assert.equal(result.report.warnings, 2);
  assert.equal(result.candidate.tables.Groups[1][5], '');
  assert.equal(result.candidate.tables.Groups[1][10], '');
});

test('alphanumeric Set numbers and formula-looking prose survive as literal data', () => {
  const result = analyze(s => {
    values(s, 'Entry Form')[5][16] = '11B'; values(s, 'Entry Form')[5][18] = '=not a formula';
    for (const row of values(s, 'Master Inventory').slice(1, 3)) { row[18] = '11B'; row[19] = '=not a formula'; }
  });
  assert.equal(result.report.blockers, 0);
  assert.equal(result.candidate.tables.Groups[1][10], '11B');
  assert.equal(result.candidate.tables.Groups[1][11], '=not a formula');
});

test('blank and repeated n/a stickers are allowed; assigned duplicates ignore casing', () => {
  const result = analyze(s => {
    values(s, 'Master Inventory')[1][4] = ''; values(s, 'Master Inventory')[3][4] = 'N/A';
    const lists = values(s, 'Data Lists');
    lists.forEach((row, i) => { if (i) { row[22] = ''; row[23] = ''; } });
    ['A00', 'A01', 'A02', 'A03'].forEach((code, i) => lists[i + 1][22] = code);
  });
  assert.equal(result.report.blockers, 0);
  assert.equal(result.report.stats.blankStickers, 1);
  assert.equal(result.report.stats.notApplicableStickers, 2);
  assert.ok(codes(analyze(s => values(s, 'Master Inventory')[3][4] = 'a00')).includes('DUPLICATE_STICKER'));
});

const invalidCases = [
  ['wrong source', s => s.source.spreadsheetId = DESTINATION_ID, 'SOURCE_ID'],
  ['wrong destination', s => s.destination.spreadsheetId = SOURCE_ID, 'DESTINATION_ID'],
  ['source changed during read', s => s.source.modifiedTimeAfter = '2026-10-02T00:00:00Z', 'SOURCE_CHANGED'],
  ['unknown snapshot', s => s.formatVersion = 2, 'SNAPSHOT_VERSION'],
  ['missing capture date', s => delete s.capturedAt, 'CAPTURE_TIME'],
  ['missing sheet', s => s.source.sheets.pop(), 'SHEET_MISSING'],
  ['partial source read', s => s.source.sheets[0].range = 'A1:Z10', 'INCOMPLETE_RANGE'],
  ['invalid source dimensions', s => s.source.sheets[0].columnCount = 0, 'INCOMPLETE_RANGE'],
  ['missing destination metadata', s => delete s.destination.sheets, 'DESTINATION_CAPTURE'],
  ['empty destination metadata', s => s.destination.sheets = [], 'DESTINATION_CAPTURE'],
  ['renamed header', s => values(s, 'Entry Form')[4][1] = 'New ID', 'HEADER_MISMATCH'],
  ['quantity mismatch', s => values(s, 'Entry Form')[5][3] = '3', 'QUANTITY_MISMATCH'],
  ['invalid quantity', s => values(s, 'Entry Form')[5][3] = 'two', 'INVALID_QUANTITY'],
  ['duplicate group', s => values(s, 'Entry Form')[6][1] = '001-TEST', 'DUPLICATE_GROUP'],
  ['duplicate copy', s => values(s, 'Master Inventory')[2][1] = '001-TEST-01', 'DUPLICATE_COPY'],
  ['duplicate number', s => values(s, 'Master Inventory')[2][3] = '1', 'DUPLICATE_COPY_NUMBER'],
  ['orphan copy', s => values(s, 'Master Inventory')[1][2] = 'missing', 'ORPHAN_COPY'],
  ['unknown paint', s => values(s, 'Entry Form')[5][14] = 'Maybe', 'UNKNOWN_PAINT'],
  ['blank current location', s => values(s, 'Master Inventory')[1][6] = '', 'MISSING_LOCATION'],
  ['unexpected location', s => values(s, 'Master Inventory')[1][6] = 'Elsewhere', 'UNKNOWN_LOCATION'],
  ['unknown option', s => values(s, 'Entry Form')[5][5] = 'Cosmic', 'UNKNOWN_OPTION'],
  ['derived field mismatch', s => values(s, 'Master Inventory')[1][13] = 'Elf', 'SHARED_FIELD_MISMATCH'],
  ['unexpected copy notes column', s => values(s, 'Master Inventory')[1][20] = 'Unique note', 'UNMAPPED_DATA'],
  ['set number without set', s => values(s, 'Entry Form')[6][16] = '9', 'INAPPLICABLE_SET_NUMBER'],
  ['sticker outside catalog', s => values(s, 'Master Inventory')[1][4] = 'Z99', 'STICKER_OUTSIDE_CATALOG'],
  ['stale availability formula', s => values(s, 'Data Lists')[1][22] = 'A02', 'DERIVED_STICKERS_MISMATCH'],
  ['spreadsheet error', s => values(s, 'Entry Form')[5][18] = '#REF!', 'CELL_ERROR'],
  ['staged sticker assignment', s => values(s, 'Sticker Assignment').push(['', '001-TEST-01', '', 'A03']), 'STAGED_STICKER'],
  ['staged unassignment in old script column', s => { values(s, 'Sticker Assignment')[5] = []; values(s, 'Sticker Assignment')[5][9] = 'A00'; }, 'STAGED_UNASSIGN'],
  ['staged unassignment in live UI column', s => { values(s, 'Sticker Assignment')[5] = []; values(s, 'Sticker Assignment')[5][10] = 'A00'; }, 'STAGED_UNASSIGN']
];
for (const [label, mutate, expected] of invalidCases) test(`blocks ${label}`, () => {
  const result = analyze(mutate);
  assert.ok(codes(result).includes(expected), JSON.stringify(result.report.issues));
  assert.equal(result.report.readyForReview, false);
});

test('checkout staging is compared with saved location, interpreting Return Home without applying it', () => {
  const snapshot = fixture(), rows = values(snapshot, 'Check Out Minis');
  rows[1] = []; rows[1][34] = '001-TEST-01'; rows[23] = ['', '<Return Home>'];
  assert.equal(analyzeImport(snapshot).report.blockers, 0);
  rows[23][1] = 'Quest';
  assert.ok(codes(analyzeImport(snapshot)).includes('STAGED_LOCATION'));
});

test('identical rerun proposes zero additions while differences and destination-only records block', () => {
  const snapshot = fixture(), initial = analyzeImport(snapshot);
  for (const [title, rows] of Object.entries(initial.candidate.tables)) snapshot.destination.sheets.push(sheet(title, clone(rows)));
  const rerun = analyzeImport(snapshot);
  assert.equal(rerun.report.blockers, 0);
  assert.ok(rerun.report.destination.tables.every(item => item.add === 0 && item.action === 'unchanged'));
  assert.equal(rerun.report.candidateHash, initial.report.candidateHash);
  const conflict = clone(snapshot);
  conflict.destination.sheets.find(item => item.title === 'Copies').values[1][5] = 'Newer note';
  assert.ok(codes(analyzeImport(conflict)).includes('DESTINATION_CONFLICT'));
  const extra = clone(snapshot);
  extra.destination.sheets.find(item => item.title === 'Groups').values.push(['extra', 'Do not delete']);
  assert.ok(codes(analyzeImport(extra)).includes('DESTINATION_EXTRA_RECORD'));
  snapshot.destination.sheets.find(item => item.title === 'Groups').values[0][0] = 'other';
  assert.ok(codes(analyzeImport(snapshot)).includes('DESTINATION_SCHEMA'));
});

test('partial destination captures and duplicate keys cannot be treated as safe reruns', () => {
  const s = fixture(), rows = analyzeImport(s).candidate.tables.Copies;
  s.destination.sheets.push(sheet('Copies', clone(rows)));
  s.destination.sheets.at(-1).range = 'A1:F4';
  assert.ok(codes(analyzeImport(s)).includes('DESTINATION_INCOMPLETE'));
  s.destination.sheets.pop();
  s.destination.sheets.push(sheet('Copies', [...clone(rows), clone(rows[1])]));
  assert.ok(codes(analyzeImport(s)).includes('DESTINATION_DUPLICATE_KEY'));
});

test('first-import batch preserves literal cells and only removes the verified test tab', () => {
  const { buildFirstImportPlan } = require('../tools/import-write-plan.cjs');
  const snapshot = fixture();
  snapshot.destination.sheets[0].sheetId = 0;
  snapshot.destination.sheets[0].values = [['test0', 'test1', 'test2', 'test3'], ['testa', 'testb', 'testc', 'testd']];
  const plan = buildFirstImportPlan(snapshot), { candidate } = analyzeImport(snapshot);
  assert.equal(plan.spreadsheet_id, DESTINATION_ID);
  assert.ok(plan.requests.every(request => Object.keys(request).length === 1));
  assert.deepEqual(plan.requests.filter(request => request.deleteSheet), [{ deleteSheet: { sheetId: 0 } }]);
  assert.ok(plan.requests.at(-1).deleteSheet);
  const names = plan.requests.filter(request => request.addSheet).map(request => request.addSheet.properties.title);
  assert.deepEqual(names, ['Groups', 'Copies', 'Lists', 'Stickers']);
  plan.requests.filter(request => request.updateCells).forEach((request, index) => {
    const update = request.updateCells;
    assert.equal(update.rows.length, update.range.endRowIndex);
    assert.ok(update.rows.every(row => row.values.length === update.range.endColumnIndex));
    assert.deepEqual(update.rows.map(row => row.values.map(cell => cell.userEnteredValue.stringValue)), candidate.tables[names[index]]);
  });
  const changed = clone(snapshot);
  changed.destination.sheets[0].values[0][0] = 'Keep this';
  assert.throws(() => buildFirstImportPlan(changed), /test tab changed/);
  snapshot.destination.sheets.push(sheet('Groups', candidate.tables.Groups));
  assert.throws(() => buildFirstImportPlan(snapshot), /never overwrite/);
});

test('CLI refuses live apply and writes only within the ignored local directory', () => {
  const repo = path.resolve(__dirname, '..'), cli = path.join(repo, 'tools/import-dry-run.cjs');
  const input = path.join(os.tmpdir(), `ppq-import-test-${process.pid}.json`);
  const output = path.join(repo, '.local', `import-test-${process.pid}`);
  try {
    fs.writeFileSync(input, JSON.stringify(fixture()));
    assert.equal(spawnSync(process.execPath, [cli, '--input', input, '--apply'], { encoding: 'utf8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [cli, '--input', input, '--out', repo], { encoding: 'utf8' }).status, 1);
    const run = () => spawnSync(process.execPath, [cli, '--input', input, '--out', output], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'candidate.json'))).schemaVersion, 1);
    const bad = fixture(); bad.source.spreadsheetId = DESTINATION_ID;
    fs.writeFileSync(input, JSON.stringify(bad));
    assert.equal(run().status, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'candidate.json'))).blocked, true);
    fs.writeFileSync(input, JSON.stringify(fixture()));
    assert.equal(run().status, 0);
    fs.writeFileSync(input, '{invalid JSON');
    assert.equal(run().status, 1);
    for (const file of ['candidate.json', 'app-state.json', 'report.json']) {
      assert.equal(JSON.parse(fs.readFileSync(path.join(output, file))).blocked, true);
    }
  } finally {
    fs.rmSync(input, { force: true });
    // Both cleanup targets are concrete test paths, never paths supplied by a snapshot.
    assert.equal(path.dirname(output), path.join(repo, '.local'));
    fs.rmSync(output, { recursive: true, force: true });
  }
});
