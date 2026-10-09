// Values.batchGet avoids constructing a large ExtendedValue object tree in the Sheets service.
// Metadata remains fresh; ambiguous formula-looking values are checked as typed cells.
function rehearsalColumn_(number) {
  var result = '';
  while (number > 0) { number--; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
  return result;
}

function rehearsalReadStep_(timing, key, action) {
  var start = Date.now();
  try { return action(); }
  finally { if (timing) timing[key] = (timing[key] || 0) + Date.now() - start; }
}

function rehearsalRead_(id, timing) {
  if (id !== REHEARSAL_CONFIG_.spreadsheetId) persistenceError_('FORBIDDEN', 'Wrong rehearsal destination');
  var metadata = rehearsalReadStep_(timing, 'metadataMs', function () { return Sheets.Spreadsheets.get(id, {
    fields: 'spreadsheetId,sheets(properties(sheetId,title,sheetType,gridProperties(rowCount,columnCount)),merges)'
  }); });
  persistenceAssert_(metadata && metadata.spreadsheetId === id && Array.isArray(metadata.sheets), 'Unexpected read destination');
  var ranges = [], ids = new Set();
  var sheets = Object.keys(PERSISTENCE_TABLE_COLUMNS_).map(function (title) {
    var matches = metadata.sheets.filter(function (sheet) { return sheet.properties && sheet.properties.title === title; });
    persistenceAssert_(matches.length === 1, 'Missing or ambiguous storage tab: ' + title);
    var sheet = matches[0], props = sheet.properties, grid = props.gridProperties;
    persistenceAssert_(Number.isSafeInteger(props.sheetId) && props.sheetId >= 0 && !ids.has(props.sheetId)
      && (!props.sheetType || props.sheetType === 'GRID') && grid
      && Number.isSafeInteger(grid.rowCount) && grid.rowCount > 0
      && Number.isSafeInteger(grid.columnCount) && grid.columnCount >= PERSISTENCE_TABLE_COLUMNS_[title].length,
      'Invalid storage grid: ' + title);
    persistenceAssert_(!sheet.merges || sheet.merges.length === 0, 'Merged storage cells are not supported: ' + title);
    ids.add(props.sheetId);
    ranges.push("'" + title + "'!A1:" + rehearsalColumn_(grid.columnCount) + grid.rowCount);
    return { properties: props, data: [{ rowData: [] }] };
  });
  var response = rehearsalReadStep_(timing, 'valuesMs', function () { return Sheets.Spreadsheets.Values.batchGet(id, {
    ranges: ranges, majorDimension: 'ROWS', valueRenderOption: 'FORMULA',
    fields: 'spreadsheetId,valueRanges(range,majorDimension,values)'
  }); });
  persistenceAssert_(response && response.spreadsheetId === id && Array.isArray(response.valueRanges)
    && response.valueRanges.length === ranges.length, 'Incomplete value read');
  var probes = new Map();
  response.valueRanges.forEach(function (valueRange, index) {
    var sheet = sheets[index], grid = sheet.properties.gridProperties;
    persistenceAssert_(valueRange && typeof valueRange.range === 'string'
      && valueRange.range.replace(/'/g, '') === ranges[index].replace(/'/g, '')
      && valueRange.majorDimension === 'ROWS', 'Unexpected value range');
    var rows = valueRange.values || [];
    persistenceAssert_(Array.isArray(rows) && rows.length <= grid.rowCount, 'Invalid value rows');
    sheet.data[0].rowData = rows.map(function (row, r) {
      persistenceAssert_(Array.isArray(row) && row.length <= grid.columnCount, 'Invalid value columns');
      return { values: row.map(function (value, c) {
        // Keep native types so the existing parser still rejects numbers and booleans.
        var cell = { userEnteredValue: typeof value === 'string' ? { stringValue: value }
          : typeof value === 'number' ? { numberValue: value }
            : typeof value === 'boolean' ? { boolValue: value } : { invalidValue: value } };
        if (typeof value === 'string' && value.trimStart().charAt(0) === '=') {
          probes.set(sheet.properties.sheetId + ':' + r + ':' + c, {
            range: "'" + sheet.properties.title + "'!" + rehearsalColumn_(c + 1) + (r + 1), value: value, cell: cell
          });
        }
        return cell;
      }) };
    });
  });
  if (probes.size) {
    var probeRanges = Array.from(probes.values()).map(function (item) { return item.range; });
    // Bound query length when many literal notes happen to start with '='.
    for (var start = 0; start < probeRanges.length; start += 100) {
      var checked = rehearsalReadStep_(timing, 'formulaCheckMs', function () { return Sheets.Spreadsheets.get(id, {
        ranges: probeRanges.slice(start, start + 100),
        fields: 'spreadsheetId,sheets(properties(sheetId),data(startRow,startColumn,rowData(values(userEnteredValue))))' }); });
      persistenceAssert_(checked && checked.spreadsheetId === id && Array.isArray(checked.sheets), 'Incomplete formula check');
      checked.sheets.forEach(function (sheet) {
        persistenceAssert_(sheet.properties && Array.isArray(sheet.data), 'Invalid formula check');
        sheet.data.forEach(function (block) {
          persistenceAssert_(Array.isArray(block.rowData), 'Missing formula-check cells');
          block.rowData.forEach(function (row, r) {
            (row.values || []).forEach(function (cell, c) {
              var key = sheet.properties.sheetId + ':' + ((block.startRow || 0) + r) + ':' + ((block.startColumn || 0) + c);
              var probe = probes.get(key), value = cell.userEnteredValue;
              persistenceAssert_(probe && !probe.checked && value && Object.keys(value).length === 1
                && (value.stringValue === probe.value || value.formulaValue === probe.value), 'Changed or incomplete formula-check cell');
              probe.checked = true;
              probe.cell.userEnteredValue = value;
            });
          });
        });
      });
    }
    probes.forEach(function (probe) { persistenceAssert_(probe.checked, 'Missing formula-check cell'); });
  }
  return { spreadsheetId: id, sheets: sheets };
}
