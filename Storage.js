// Read-only adapter. No save, create, delete, or import endpoint is exposed by the app.
var PREVIEW_SPREADSHEET_ID_ = "1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY";
var PREVIEW_TABLE_COLUMNS_ = {
  Groups: ["rootId", "name", "size", "creatureType", "sex", "race", "role", "home", "paint", "set", "setNumber", "notes"],
  Copies: ["id", "rootId", "miniNumber", "sticker", "currentLocation", "note"],
  Lists: ["field", "value", "sortOrder"],
  Stickers: ["sticker", "sortOrder"]
};

function buildSpreadsheetPreviewState_() {
  var workbook = SpreadsheetApp.openById(PREVIEW_SPREADSHEET_ID_);
  var tables = {};
  Object.keys(PREVIEW_TABLE_COLUMNS_).forEach(function (title) {
    var sheet = workbook.getSheetByName(title);
    if (!sheet) throw new Error("Missing preview storage tab: " + title);
    var range = sheet.getDataRange();
    if (range.getFormulas().some(function (row) { return row.some(Boolean); })) {
      throw new Error("Preview storage must contain literal values, not formulas: " + title);
    }
    tables[title] = range.getDisplayValues();
  });
  return parseSpreadsheetPreview_(tables);
}

function parseSpreadsheetPreview_(tables) {
  var records = {};
  Object.keys(PREVIEW_TABLE_COLUMNS_).forEach(function (title) {
    var columns = PREVIEW_TABLE_COLUMNS_[title];
    var rows = tables[title];
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
      throw new Error("Unexpected preview headers: " + title);
    }
    var headerIndexes = Object.create(null);
    rows[0].forEach(function (key, index) {
      if (typeof key !== "string" || columns.indexOf(key) < 0) {
        throw new Error("Unexpected preview headers: " + title + " (unknown header: " + key + ")");
      }
      if (headerIndexes[key] !== undefined) {
        throw new Error("Unexpected preview headers: " + title + " (duplicate header: " + key + ")");
      }
      headerIndexes[key] = index;
    });
    var missing = columns.filter(function (key) { return headerIndexes[key] === undefined; });
    if (missing.length) {
      throw new Error("Unexpected preview headers: " + title + " (missing: " + missing.join(", ") + ")");
    }
    records[title] = rows.slice(1).filter(function (row) {
      return row.some(function (value) { return String(value).trim() !== ""; });
    }).map(function (row) {
      if (row.length > columns.length) throw new Error("Unexpected preview columns: " + title);
      var record = {};
      columns.forEach(function (key) {
        var value = row[headerIndexes[key]];
        record[key] = value == null ? "" : String(value);
      });
      return record;
    });
  });
  var groupsById = Object.create(null);
  if (!records.Groups.length || !records.Copies.length) throw new Error("Imported collection is unexpectedly empty");
  var copyIds = new Set();
  var stickerIds = new Set();
  var copyNumbers = new Set();
  records.Groups.forEach(function (group) {
    if (!group.rootId || group.rootId !== group.rootId.trim() || groupsById[group.rootId]) {
      throw new Error("Invalid or duplicate group identity");
    }
    groupsById[group.rootId] = group;
    group.copies = [];
  });
  records.Copies.forEach(function (copy) {
    var group = groupsById[copy.rootId];
    if (!copy.id || copy.id !== copy.id.trim() || copyIds.has(copy.id) || !group) {
      throw new Error("Invalid copy identity or parent relationship");
    }
    var numberKey = JSON.stringify([copy.rootId, Number(copy.miniNumber)]);
    if (!/^\d+$/.test(copy.miniNumber) || Number(copy.miniNumber) < 1 || copyNumbers.has(numberKey)) {
      throw new Error("Invalid copy sequence");
    }
    var sticker = copy.sticker.trim().toUpperCase();
    if (sticker && sticker !== "N/A") {
      if (stickerIds.has(sticker)) throw new Error("Duplicate sticker assignment");
      stickerIds.add(sticker);
    }
    copyIds.add(copy.id);
    copyNumbers.add(numberKey);
    copy.home = group.home;
    group.copies.push(copy);
  });
  var catalogs = Object.create(null);
  var validFields = ["size", "creatureType", "sex", "race", "role", "set", "home", "currentLocation", "paint"];
  function ordered(rows) {
    if (rows.some(function (row) { return !/^\d+$/.test(row.sortOrder) || Number(row.sortOrder) < 1; })
        || new Set(rows.map(function (row) { return Number(row.sortOrder); })).size !== rows.length) {
      throw new Error("Invalid catalog ordering");
    }
    return rows.slice().sort(function (a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
  }
  if (records.Lists.some(function (row) { return validFields.indexOf(row.field) < 0; })) {
    throw new Error("Unknown catalog field");
  }
  validFields.forEach(function (field) {
    var values = ordered(records.Lists.filter(function (row) { return row.field === field; }))
      .map(function (row) { return row.value; });
    if (!values.length || values.some(function (value) { return !value.trim(); }) || new Set(values).size !== values.length) {
      throw new Error("Invalid or missing catalog: " + field);
    }
    catalogs[field] = values;
  });
  var stickerCatalog = ordered(records.Stickers).map(function (row) { return row.sticker.trim().toUpperCase(); });
  if (!stickerCatalog.length || new Set(stickerCatalog).size !== stickerCatalog.length
      || stickerCatalog.some(function (value) { return !/^[A-Z]\d{2}$/.test(value); })) {
    throw new Error("Invalid sticker catalog");
  }
  stickerIds.forEach(function (id) { if (stickerCatalog.indexOf(id) < 0) throw new Error("Assigned sticker outside catalog"); });
  records.Groups.forEach(function (group) {
    if (!group.name.trim() || !group.copies.length) throw new Error("Incomplete stored group identity or inventory");
    validFields.filter(function (field) { return field !== "currentLocation"; }).forEach(function (field) {
      // Historical blanks are preserved for later correction, never defaulted to n/a.
      if (group[field] && catalogs[field].indexOf(group[field]) < 0) throw new Error("Unknown stored " + field);
    });
  });
  records.Copies.forEach(function (copy) {
    if (catalogs.currentLocation.indexOf(copy.currentLocation) < 0) throw new Error("Unknown current location");
  });
  if (catalogs.home.some(function (home) { return catalogs.currentLocation.indexOf(home) < 0; })) {
    throw new Error("Home is not a usable current location");
  }
  return {
    prototypeMode: true,
    previewMode: true,
    collectionId: PREVIEW_SPREADSHEET_ID_,
    generatedAt: new Date().toISOString(),
    catalogs: catalogs,
    locations: catalogs.currentLocation.slice(),
    homeLocations: catalogs.home.slice(),
    stickerCatalog: stickerCatalog,
    groups: records.Groups
  };
}
