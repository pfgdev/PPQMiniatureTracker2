'use strict';
const { clone } = require('./persistence-fixture.cjs');

function rangeParts(range) {
  const match = /^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(range);
  if (!match) throw new Error('Unsupported test range: ' + range);
  const column = text => [...text].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
  return { title: match[1], row: Number(match[3]) - 1, column: column(match[2]),
    lastRow: Number(match[5] || match[3]) - 1, lastColumn: column(match[4] || match[2]) };
}

function fakeRehearsalSheets(readBook) {
  const calls = [];
  function slice(book, range) {
    const at = rangeParts(range), sheet = book.sheets.find(s => s.properties.title === at.title);
    if (!sheet) throw new Error('Missing sheet');
    const rows = sheet.data[0].rowData.slice(at.row, at.lastRow + 1)
      .map(row => ({ values: (row.values || []).slice(at.column, at.lastColumn + 1) }));
    return { at, sheet, rows };
  }
  return { calls, Spreadsheets: {
    get(id, options) {
      calls.push({ method: 'get', id, options: clone(options) });
      const book = readBook(id);
      if (!options.ranges) return { spreadsheetId: book.spreadsheetId,
        sheets: book.sheets.map(({ properties, merges }) => ({ properties: clone(properties), ...(merges ? { merges: clone(merges) } : {}) })) };
      const sheets = new Map();
      for (const range of options.ranges) {
        const { at, sheet, rows } = slice(book, range);
        if (!sheets.has(sheet.properties.sheetId)) sheets.set(sheet.properties.sheetId, { properties: { sheetId: sheet.properties.sheetId }, data: [] });
        sheets.get(sheet.properties.sheetId).data.push({ startRow: at.row, startColumn: at.column, rowData: clone(rows) });
      }
      return { spreadsheetId: book.spreadsheetId, sheets: [...sheets.values()] };
    },
    Values: { batchGet(id, options) {
      calls.push({ method: 'batchGet', id, options: clone(options) });
      const book = readBook(id);
      return { spreadsheetId: book.spreadsheetId, valueRanges: options.ranges.map(range => {
        const { rows } = slice(book, range);
        const values = rows.map(row => row.values.map(cell => {
          const v = cell.userEnteredValue || {};
          return v.formulaValue ?? v.stringValue ?? v.numberValue ?? v.boolValue ?? '';
        }));
        return { range: range.replace(/'/g, ''), majorDimension: 'ROWS', values };
      }) };
    } }
  } };
}

module.exports = { fakeRehearsalSheets };
