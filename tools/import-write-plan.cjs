'use strict';

// Generates a reviewed first-import batch only. Sending it requires a separate connector call.
const { DESTINATION_ID, analyzeImport } = require('./import-core.cjs');
function buildFirstImportPlan(snapshot) {
  const { candidate, report } = analyzeImport(snapshot);
  if (report.blockers || snapshot.destination.spreadsheetId !== DESTINATION_ID
      || report.destination.tables.some(table => table.action !== 'create')) {
    throw new Error('First import requires a clean audit and no existing storage tabs; never overwrite a rerun.');
  }
  const existing = snapshot.destination.sheets;
  const expectedTest = [['test0', 'test1', 'test2', 'test3'], ['testa', 'testb', 'testc', 'testd']];
  if (existing.length !== 1 || existing[0].title !== 'MiniatureDataTable' || existing[0].sheetId !== 0
      || JSON.stringify(existing[0].values) !== JSON.stringify(expectedTest)) {
    throw new Error('The authorized eight-cell test tab changed; do not remove it.');
  }
  const requests = [];
  const widths = {
    Groups: [150, 230, 100, 140, 90, 130, 140, 220, 140, 360, 100, 440],
    Copies: [180, 150, 85, 85, 230, 380], Lists: [150, 420, 100], Stickers: [100, 100]
  };
  Object.entries(candidate.tables).forEach(([title, rows], index) => {
    const sheetId = 100 + index, width = rows[0].length;
    const range = { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: width };
    requests.push({ addSheet: { properties: { sheetId, title,
      gridProperties: { rowCount: Math.max(1000, rows.length), columnCount: width, frozenRowCount: 1 } } } });
    requests.push({ updateCells: { range, fields: 'userEnteredValue',
      rows: rows.map(row => ({ values: row.map(value => ({ userEnteredValue: { stringValue: String(value) } })) })) } });
    requests.push({ repeatCell: { range, cell: { userEnteredFormat: {
      numberFormat: { type: 'TEXT', pattern: '@' }, wrapStrategy: 'CLIP'
    } }, fields: 'userEnteredFormat.numberFormat,userEnteredFormat.wrapStrategy' } });
    requests.push({ repeatCell: { range: { ...range, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 } } },
      fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor' } });
    requests.push({ setBasicFilter: { filter: { range } } });
    widths[title].forEach((pixelSize, column) => requests.push({ updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: column, endIndex: column + 1 },
      properties: { pixelSize }, fields: 'pixelSize'
    } }));
  });
  // All new tabs and values must succeed in this same batch before the old test tab is removed.
  requests.push({ deleteSheet: { sheetId: 0 } });
  return { spreadsheet_id: DESTINATION_ID, requests, candidateHash: report.candidateHash };
}
module.exports = { buildFirstImportPlan };
