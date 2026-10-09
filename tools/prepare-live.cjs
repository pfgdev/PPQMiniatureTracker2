'use strict';
// Offline, one-time migration preparation. This never connects to Google.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const dir = '.local/live/';
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'));
const write = (name, value) => fs.writeFileSync(dir + name, JSON.stringify(value, null, 2));
const target = '1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY';
const scriptId = '1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0';

function tables(book) {
  return Object.fromEntries(book.sheets.map(sheet => {
    assert.equal(sheet.data.length, 1);
    assert.equal(sheet.data[0].startRow || 0, 0);
    assert.equal(sheet.data[0].startColumn || 0, 0);
    const rows = (sheet.data[0].rowData || []).map(row => (row.values || []).map(cell => {
      assert(!cell.dataValidation && !cell.chipRuns, 'Unexpected structured cell');
      const value = cell.userEnteredValue;
      assert(!value || Object.keys(value).length === 0 || typeof value.stringValue === 'string', 'Not literal text');
      return value?.stringValue || '';
    }));
    rows.forEach(row => { while (row.length && row.at(-1) === '') row.pop(); });
    while (rows.length && !rows.at(-1).length) rows.pop();
    return [sheet.properties.title, rows];
  }));
}

function prepare() {
  assert(!fs.existsSync(dir + 'config.json'), 'Preparation already exists. Do not regenerate collection identity.');
  const book = read('source-capture.json'), backup = read('backup-capture.json');
  assert.equal(book.spreadsheetId, target);
  assert.notEqual(backup.spreadsheetId, target);
  assert.equal(backup.spreadsheetId, read('backup.json').id);
  const source = tables(book);
  assert.deepEqual(Object.keys(source).sort(), ['Copies', 'Groups', 'Lists', 'Stickers']);
  assert.deepEqual(tables(backup), source, 'Backup differs from current data');
  const server = vm.createContext({ console });
  for (const file of ['Storage.js', 'Persistence.js', 'PersistenceAdapter.js', 'PersistenceContract.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), server, { filename: file });
  }
  const preview = server.parseSpreadsheetPreview_(source);
  preview.collectionId = randomUUID();
  const state = server.migratePreviewForPersistence_(preview, randomUUID);
  const candidate = JSON.parse(JSON.stringify(server.persistenceTables_(state)));
  assert.deepEqual(JSON.parse(JSON.stringify(server.parsePersistenceTables_(candidate))), JSON.parse(JSON.stringify(state)));
  const labels = new Map(state.choices.map(choice => [choice.id, choice.value]));
  for (const group of preview.groups) {
    const next = state.groups.find(item => item.rootId === group.rootId);
    for (const field of server.PERSISTENCE_FIELDS_) assert.equal(labels.get(next[field + 'Id']) || '', group[field]);
    for (const field of ['name', 'notes', 'setNumber']) assert.equal(next[field], group[field]);
    for (const copy of group.copies) {
      const nextCopy = state.copies.find(item => item.id === copy.id);
      for (const field of ['id', 'rootId', 'miniNumber', 'sticker', 'note']) assert.equal(nextCopy[field], copy[field]);
      assert.equal(labels.get(nextCopy.currentLocationId) || '', copy.currentLocation);
    }
  }
  const used = new Set(state.copies.map(copy => copy.sticker.toUpperCase()));
  const summary = { groups: state.groups.length, copies: state.copies.length,
    away: preview.groups.reduce((n, g) => n + g.copies.filter(c => c.currentLocation !== g.home).length, 0),
    assignedStickers: state.copies.filter(c => c.sticker && c.sticker.toUpperCase() !== 'N/A').length,
    notApplicableStickers: state.copies.filter(c => c.sticker.toUpperCase() === 'N/A').length,
    missingStickers: state.copies.filter(c => !c.sticker).length, catalog: state.stickerCatalog.length,
    nextSticker: state.stickerCatalog.find(code => !used.has(code)),
    blankGroupFields: preview.groups.reduce((n, g) => n + server.PERSISTENCE_FIELDS_.filter(f => !g[f]).length, 0) };
  const requests = [], layouts = {};
  let nextSheetId = Math.max(...book.sheets.map(s => s.properties.sheetId)) + 1;
  for (const [title, rows] of Object.entries(candidate)) {
    const old = book.sheets.find(sheet => sheet.properties.title === title);
    const sheetId = old?.properties.sheetId ?? nextSheetId++;
    layouts[title] = sheetId;
    if (!old) requests.push({ addSheet: { properties: { title, sheetId, gridProperties: {
      rowCount: Math.max(1000, rows.length), columnCount: rows[0].length, frozenRowCount: 1
    } } } });
    else {
      assert(rows.length <= old.properties.gridProperties.rowCount, 'Unexpected row growth');
      if (rows[0].length > old.properties.gridProperties.columnCount) requests.push({ appendDimension: {
        sheetId, dimension: 'COLUMNS', length: rows[0].length - old.properties.gridProperties.columnCount
      } });
      requests.push({ repeatCell: { range: { sheetId }, cell: {}, fields: 'userEnteredValue' } });
    }
    const range = { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: rows[0].length };
    requests.push({ updateCells: { range, rows: rows.map(row => ({ values: row.map(value => ({ userEnteredValue: { stringValue: value } })) })), fields: 'userEnteredValue' } });
    requests.push({ repeatCell: { range, cell: { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' }, wrapStrategy: 'CLIP' } }, fields: 'userEnteredFormat.numberFormat,userEnteredFormat.wrapStrategy' } });
    requests.push({ repeatCell: { range: { ...range, endRowIndex: 1 }, cell: { userEnteredFormat: {
      backgroundColor: { red: 0.9372549, green: 0.9372549, blue: 0.9372549 }, textFormat: { bold: true }
    } }, fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold' } });
  }
  for (const request of requests) {
    assert.equal(Object.keys(request).length, 1);
    if (request.updateCells) {
      const { range, rows } = request.updateCells;
      assert.equal(rows.length, range.endRowIndex - range.startRowIndex);
      assert(rows.every(row => row.values.length === range.endColumnIndex - range.startColumnIndex));
    }
  }
  write('candidate-state.json', state);
  write('candidate-tables.json', candidate);
  write('migration-plan.json', { spreadsheet_id: target, requests });
  write('setup.json', { capturedAt: new Date().toISOString(), backupId: backup.spreadsheetId,
    spreadsheetId: target, collectionId: state.collectionId, ownerEmail: 'pmfeller@gmail.com',
    schemaVersion: state.schemaVersion, revision: 0,
    sourceHash: createHash('sha256').update(JSON.stringify(source)).digest('hex'), summary, layouts });
  write('config.json', { scriptId, spreadsheetId: target, collectionId: state.collectionId, ownerEmail: 'pmfeller@gmail.com', savesEnabled: true });
  console.log(JSON.stringify({ backupMatches: true, migrationRoundTripPassed: true, summary, requests: requests.length }));
}

if (require.main === module) prepare();
module.exports = { tables };
