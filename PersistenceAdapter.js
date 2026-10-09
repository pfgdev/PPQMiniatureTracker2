// Disabled, private transport rehearsal. Excluded from clasp; not called by the UI.
// Activation requires a reviewed migration, owner access, and a disposable-sheet test.
function persistenceAdapterConfig_() {
  return { enabled: false, spreadsheetId: "", collectionId: "", ownerEmail: "", lockTimeoutMs: 5000 };
}

function persistenceAdapterAuthorize_(config, runtime) {
  if (!config || config.enabled !== true) persistenceError_("DISABLED", "Spreadsheet saving is not enabled");
  persistenceAssert_(persistenceId_(config.spreadsheetId) && persistenceId_(config.collectionId)
    && typeof config.ownerEmail === "string" && /^[^\s@]+@[^\s@]+$/.test(config.ownerEmail)
    && Number.isInteger(config.lockTimeoutMs) && config.lockTimeoutMs > 0 && config.lockTimeoutMs <= 30000,
    "Saving configuration is incomplete");
  var caller;
  try { caller = runtime.callerEmail(); } catch (_) { caller = ""; }
  if (typeof caller !== "string" || !caller.trim() || caller.trim().toLowerCase() !== config.ownerEmail.toLowerCase()) {
    persistenceError_("FORBIDDEN", "Saving requires the authorized owner");
  }
}

function persistenceAdapterReadOptions_() {
  return {
    ranges: Object.keys(PERSISTENCE_TABLE_COLUMNS_).map(function (title) { return "'" + title + "'"; }),
    fields: "spreadsheetId,sheets(properties(sheetId,title,sheetType,gridProperties(rowCount,columnCount)),merges,data(startRow,startColumn,rowData(values(userEnteredValue))))"
  };
}

function persistenceAdapterSnapshot_(book, config) {
  persistenceAssert_(book && book.spreadsheetId === config.spreadsheetId && Array.isArray(book.sheets), "Unexpected storage destination");
  var tables = {}, layouts = {}, sheetIds = new Set();
  Object.keys(PERSISTENCE_TABLE_COLUMNS_).forEach(function (title) {
    var matches = book.sheets.filter(function (sheet) { return sheet.properties && sheet.properties.title === title; });
    persistenceAssert_(matches.length === 1, "Missing or ambiguous storage tab: " + title);
    var sheet = matches[0], props = sheet.properties, grid = props.gridProperties;
    persistenceAssert_(Number.isSafeInteger(props.sheetId) && props.sheetId >= 0 && !sheetIds.has(props.sheetId)
      && (!props.sheetType || props.sheetType === "GRID") && grid
      && Number.isSafeInteger(grid.rowCount) && grid.rowCount > 0
      && Number.isSafeInteger(grid.columnCount) && grid.columnCount >= PERSISTENCE_TABLE_COLUMNS_[title].length,
      "Invalid storage grid: " + title);
    sheetIds.add(props.sheetId);
    persistenceAssert_(!sheet.merges || sheet.merges.length === 0, "Merged storage cells are not supported: " + title);
    persistenceAssert_(Array.isArray(sheet.data) && sheet.data.length === 1, "Expected one complete storage grid: " + title);
    var data = sheet.data[0];
    persistenceAssert_((data.startRow === undefined || data.startRow === 0)
      && (data.startColumn === undefined || data.startColumn === 0) && Array.isArray(data.rowData)
      && data.rowData.length <= grid.rowCount, "Incomplete storage grid: " + title);
    var rows = data.rowData.map(function (row) {
      var cells = row.values || [];
      persistenceAssert_(Array.isArray(cells) && cells.length <= grid.columnCount, "Invalid storage row: " + title);
      var values = cells.map(function (cell) {
        var value = cell.userEnteredValue;
        if (value === undefined || (value && Object.keys(value).length === 0)) return "";
        persistenceAssert_(value && Object.keys(value).length === 1 && persistenceText_(value.stringValue),
          "Storage cells must contain literal text, not formulas or typed numbers: " + title);
        return value.stringValue;
      });
      while (values.length && values[values.length - 1] === "") values.pop();
      return values;
    });
    while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
    tables[title] = rows;
    layouts[title] = { sheetId: props.sheetId, rowCount: grid.rowCount, rows: rows };
  });
  var state = parsePersistenceTables_(tables);
  persistenceAssert_(state.collectionId === config.collectionId, "Unexpected stored collection");
  return { state: state, layouts: layouts };
}

function persistenceAdapterRowKey_(title, columns, row) {
  var keys = title === "Metadata" ? ["key"] : title === "Groups" ? ["rootId"]
    : title === "Stickers" ? ["sticker"] : title === "Requests" ? ["requestId", "part"] : ["id"];
  return JSON.stringify(keys.map(function (key) { return row[columns.indexOf(key)]; }));
}

function persistenceAdapterBatch_(snapshot, nextState) {
  var before = persistenceTables_(snapshot.state), after = persistenceTables_(nextState), requests = [];
  Object.keys(PERSISTENCE_TABLE_COLUMNS_).forEach(function (title) {
    var layout = snapshot.layouts[title], header = layout.rows[0], columns = after[title][0];
    var prior = new Map(), positions = new Map(), nextKeys = new Set(), updates = [], end = layout.rows.length;
    before[title].slice(1).forEach(function (row) { prior.set(persistenceAdapterRowKey_(title, columns, row), row); });
    layout.rows.slice(1).forEach(function (row, index) {
      if (row.some(function (value) { return value !== ""; })) positions.set(persistenceAdapterRowKey_(title, header, row), index + 1);
    });
    after[title].slice(1).forEach(function (row) {
      var key = persistenceAdapterRowKey_(title, columns, row), previous = prior.get(key);
      nextKeys.add(key);
      var rowIndex = previous ? positions.get(key) : end++;
      persistenceAssert_(Number.isSafeInteger(rowIndex) && rowIndex > 0, "Missing physical storage row");
      var changed = header.map(function (name) {
        var column = columns.indexOf(name);
        return !previous || previous[column] !== row[column];
      });
      // Touch only contiguous runs of changed cells; headers, formatting and other rows stay put.
      for (var start = 0; start < header.length; start++) {
        if (!changed[start]) continue;
        var stop = start + 1;
        while (stop < header.length && changed[stop]) stop++;
        updates.push({ updateCells: {
          range: { sheetId: layout.sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1,
            startColumnIndex: start, endColumnIndex: stop },
          fields: "userEnteredValue",
          rows: [{ values: header.slice(start, stop).map(function (name) {
            return { userEnteredValue: { stringValue: row[columns.indexOf(name)] } };
          }) }]
        } });
        start = stop - 1;
      }
    });
    prior.forEach(function (_, key) { persistenceAssert_(nextKeys.has(key), "Physical removal requires a separate archival design"); });
    if (end > layout.rowCount) requests.push({ appendDimension: { sheetId: layout.sheetId, dimension: "ROWS", length: end - layout.rowCount } });
    requests = requests.concat(updates);
  });
  return { requests: requests, includeSpreadsheetInResponse: false };
}

// Config/runtime are trusted server dependencies, never arguments to a public RPC.
function persistenceAdapterExecute_(request, config, runtime) {
  persistenceAdapterAuthorize_(config, runtime);
  if (!request || request.collectionId !== config.collectionId) persistenceError_("INVALID", "Unexpected requested collection");
  var lock = runtime.lock(), acquired = false;
  try {
    acquired = lock.tryLock(config.lockTimeoutMs);
    if (!acquired) persistenceError_("BUSY", "Another save is in progress. Keep your changes and retry");
    var book;
    try { book = runtime.read(config.spreadsheetId, persistenceAdapterReadOptions_()); }
    catch (_) { persistenceError_("READ_FAILED", "Could not read the collection. No write was attempted; keep your changes and retry"); }
    var snapshot = persistenceAdapterSnapshot_(book, config);
    var prepared = preparePersistenceChange_(snapshot.state, request, runtime.services);
    if (!prepared.replayed) {
      var batch = persistenceAdapterBatch_(snapshot, prepared.state);
      try {
        var acknowledgment = runtime.commit(config.spreadsheetId, batch);
        if (!acknowledgment || acknowledgment.spreadsheetId !== config.spreadsheetId) throw new Error("Missing acknowledgment");
      } catch (_) {
        // A timeout can occur after commit. Only a receipt lookup with the SAME request can settle it.
        persistenceError_("SAVE_UNCERTAIN", "Save could not be confirmed. Keep this draft and retry the exact same request", { requestId: request.requestId });
      }
    }
    return { result: prepared.result, replayed: prepared.replayed, currentRevision: prepared.state.revision };
  } finally {
    if (acquired) {
      // Apps Script also releases at execution end; do not turn an acknowledged save into a reported failure.
      try { lock.releaseLock(); } catch (_) { /* Execution-end release remains the fallback. */ }
    }
  }
}

function persistenceAdapterRuntime_() {
  return {
    callerEmail: function () { return Session.getActiveUser().getEmail(); },
    lock: function () { return LockService.getScriptLock(); },
    read: function (id, options) { return Sheets.Spreadsheets.get(id, options); },
    commit: function (id, body) { return Sheets.Spreadsheets.batchUpdate(body, id); },
    services: {
      makeId: function () { return Utilities.getUuid(); },
      now: function () { return new Date().toISOString(); },
      digest: function (text) {
        return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
          .map(function (byte) { return ((byte + 256) % 256).toString(16).padStart(2, "0"); }).join("");
      }
    }
  };
}

function savePersistenceRequest_(request) {
  return persistenceAdapterExecute_(request, persistenceAdapterConfig_(), persistenceAdapterRuntime_());
}
