'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { rehearsalFixture } = require('./helpers/rehearsal-fixture.cjs');
const { fakeRehearsalSheets } = require('./helpers/rehearsal-sheets.cjs');
const { clone, client, groupTarget, request } = require('./helpers/persistence-fixture.cjs');

function setup() {
  const f = rehearsalFixture();
  f.base.runtime.lock().tryLock();
  const book = f.base.runtime.read(f.settings.spreadsheetId);
  const sheets = fakeRehearsalSheets(() => clone(book));
  f.server.Sheets = sheets;
  const load = () => clone(f.server.persistenceAdapterSnapshot_(f.server.rehearsalRead_(f.settings.spreadsheetId), f.base.config));
  return { ...f, book, sheets, load };
}
function row(book, title, index = 1) { return book.sheets.find(s => s.properties.title === title).data[0].rowData[index]; }
function cell(book, title, field, index = 1) {
  const header = row(book, title, 0).values.map(c => c.userEnteredValue.stringValue);
  return row(book, title, index).values[header.indexOf(field)];
}

test('compact reader returns the same state and physical layouts with two fresh API reads', () => {
  const f = setup();
  assert.deepEqual(f.load(), clone(f.server.persistenceAdapterSnapshot_(f.book, f.base.config)));
  assert.deepEqual(f.sheets.calls.map(c => c.method), ['get', 'batchGet']);
  assert(!f.sheets.calls[0].options.fields.includes('rowData'));
  assert.equal(f.sheets.calls[1].options.valueRenderOption, 'FORMULA');
  assert.equal(f.sheets.calls[1].options.ranges.length, 6);
  f.load(); assert.equal(f.sheets.calls.length, 4, 'No cache may replace fresh reads');
});

test('reader rejects another destination before calling Google', () => {
  const f = setup();
  assert.throws(() => f.server.rehearsalRead_('original'), /Wrong rehearsal destination/);
  assert.equal(f.sheets.calls.length, 0);
});

test('column labels are correct at alphabet boundaries', () => {
  const f = setup();
  for (const [n, label] of [[1, 'A'], [26, 'Z'], [27, 'AA'], [52, 'AZ'], [53, 'BA'], [702, 'ZZ'], [703, 'AAA']]) {
    assert.equal(f.server.rehearsalColumn_(n), label);
  }
});

test('blank, Unicode, multiline and literal formula-looking notes survive the optimized read', () => {
  const f = setup();
  cell(f.book, 'Groups', 'notes').userEnteredValue = { stringValue: '=Literal note\n\u00e9\ud83d\ude00' };
  cell(f.book, 'Copies', 'note').userEnteredValue = { stringValue: '  =also literal' };
  cell(f.book, 'Groups', 'raceId').userEnteredValue = { stringValue: '' };
  assert.deepEqual(f.load(), clone(f.server.persistenceAdapterSnapshot_(f.book, f.base.config)));
  assert.deepEqual(f.sheets.calls.map(c => c.method), ['get', 'batchGet', 'get']);
  assert.equal(f.sheets.calls[2].options.ranges.length, 2);
});

for (const value of [{ formulaValue: '=1+1' }, { formulaValue: '="literal"' }, { numberValue: 12 }, { boolValue: true }]) {
  test('the fast path still rejects nonliteral or nontext storage: ' + JSON.stringify(value), () => {
    const f = setup(); cell(f.book, 'Groups', 'notes').userEnteredValue = value;
    assert.throws(f.load, /literal text/);
  });
}

test('reordered storage columns, rows and sheets retain identical state and write positions', () => {
  const f = setup();
  f.book.sheets.reverse();
  for (const sheet of f.book.sheets) {
    for (const r of sheet.data[0].rowData) r.values.reverse();
    sheet.data[0].rowData = [sheet.data[0].rowData[0], ...sheet.data[0].rowData.slice(1).reverse()];
  }
  assert.deepEqual(f.load(), clone(f.server.persistenceAdapterSnapshot_(f.book, f.base.config)));
});

for (const corrupt of ['missing-tab', 'duplicate-tab', 'duplicate-sheet-id', 'merged', 'missing-header', 'extra-column', 'wrong-destination', 'wrong-range', 'missing-range', 'columns-dimension']) {
  test('compact reader fails closed: ' + corrupt, () => {
    const f = setup();
    if (corrupt === 'missing-tab') f.book.sheets.pop();
    if (corrupt === 'duplicate-tab') f.book.sheets.push(clone(f.book.sheets[0]));
    if (corrupt === 'duplicate-sheet-id') f.book.sheets[1].properties.sheetId = f.book.sheets[0].properties.sheetId;
    if (corrupt === 'merged') f.book.sheets[0].merges = [{ startRowIndex: 1, endRowIndex: 2 }];
    if (corrupt === 'missing-header') row(f.book, 'Groups', 0).values[0] = { userEnteredValue: { stringValue: '' } };
    if (corrupt === 'extra-column') {
      const sheet = f.book.sheets.find(s => s.properties.title === 'Groups');
      sheet.properties.gridProperties.columnCount++;
      row(f.book, 'Groups', 0).values.push({ userEnteredValue: { stringValue: 'unexpected' } });
    }
    const read = f.sheets.Spreadsheets.Values.batchGet;
    f.sheets.Spreadsheets.Values.batchGet = (id, options) => {
      const result = read(id, options);
      if (corrupt === 'wrong-destination') result.spreadsheetId = 'original';
      if (corrupt === 'wrong-range') result.valueRanges[0].range = 'Other!A1:B2';
      if (corrupt === 'missing-range') result.valueRanges.pop();
      if (corrupt === 'columns-dimension') result.valueRanges[0].majorDimension = 'COLUMNS';
      return result;
    };
    assert.throws(f.load);
  });
}

for (const corrupt of ['omitted-cell', 'changed-literal', 'wrong-destination', 'wrong-position']) {
  test('formula probes cannot conceal missing or changed cells: ' + corrupt, () => {
    const f = setup(); cell(f.book, 'Groups', 'notes').userEnteredValue = { stringValue: '=Literal' };
    const get = f.sheets.Spreadsheets.get;
    f.sheets.Spreadsheets.get = (id, options) => {
      const result = get(id, options);
      if (options.ranges) {
        if (corrupt === 'omitted-cell') result.sheets[0].data = [];
        if (corrupt === 'changed-literal') result.sheets[0].data[0].rowData[0].values[0].userEnteredValue.stringValue = '=Changed';
        if (corrupt === 'wrong-destination') result.spreadsheetId = 'original';
        if (corrupt === 'wrong-position') result.sheets[0].data[0].startColumn++;
      }
      return result;
    };
    assert.throws(f.load);
  });
}

test('a growing set of formula-looking values is verified in bounded batches', () => {
  const f = setup();
  const sheet = f.book.sheets.find(s => s.properties.title === 'Groups');
  const noteIndex = row(f.book, 'Groups', 0).values.findIndex(c => c.userEnteredValue.stringValue === 'notes');
  // Validate the reader itself here; deliberately duplicated IDs are not a valid collection.
  while (sheet.data[0].rowData.length < 206) sheet.data[0].rowData.push(clone(sheet.data[0].rowData[1]));
  sheet.properties.gridProperties.rowCount = 220;
  for (const r of sheet.data[0].rowData.slice(1)) r.values[noteIndex] = { userEnteredValue: { stringValue: '=Literal' } };
  f.server.rehearsalRead_(f.settings.spreadsheetId);
  const probes = f.sheets.calls.filter(call => call.method === 'get' && call.options.ranges);
  assert.deepEqual(probes.map(call => call.options.ranges.length), [100, 100, 5]);
});

test('real save uses fresh compact reads, preserves untouched records, and replays only once', async () => {
  const f = rehearsalFixture(), c = client(f), target = groupTarget(c);
  const before = f.base.stored();
  target.value.copies['one-01'].currentLocation = 'Drawer';
  const req = request(target);
  const saved = await c.send(req); assert.equal(saved.ok, true);
  const replay = await c.send(req); assert.equal(replay.ok, true); assert.equal(replay.replayed, true);
  assert.equal(f.base.commits, 1);
  const after = f.base.stored();
  assert.deepEqual(after.groups, before.groups);
  assert.deepEqual(after.choices, before.choices);
  assert.deepEqual(after.copies[1], before.copies[1]);
  assert.equal(client(f).initialState().groups[0].copies[0].currentLocation, 'Drawer');
});

const capture = '.local/rehearsal/fast-read-capture.json';
test('fresh disposable capture including saved edits and receipts is unchanged by the fast reader', { skip: !fs.existsSync(capture) }, () => {
  const f = setup(), book = JSON.parse(fs.readFileSync(capture, 'utf8'));
  f.server.REHEARSAL_CONFIG_.spreadsheetId = book.spreadsheetId;
  f.server.Sheets = fakeRehearsalSheets(() => clone(book));
  const config = { ...f.base.config, spreadsheetId: book.spreadsheetId, collectionId: '00815fe5-9b24-4e95-a4f7-dd40e7ed7d62' };
  const expected = f.server.persistenceAdapterSnapshot_(book, config);
  const actual = f.server.persistenceAdapterSnapshot_(f.server.rehearsalRead_(book.spreadsheetId), config);
  assert.deepEqual(clone(actual), clone(expected));
  assert.equal(actual.state.groups.length, 496); assert.equal(actual.state.copies.length, 612);
  assert.match(actual.state.groups.find(group => group.rootId === '002-ARC').notes, /\nRehearsal save test/);
  assert(actual.state.receipts.length >= 1);
});
