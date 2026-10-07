'use strict';

// Pure conversion and validation. This module has no network or spreadsheet writes.
const { createHash } = require('node:crypto');
const SOURCE_ID = '1mGipFEfW--whXnmIPyW9i9Y8eo4pyKezSooOVacO2_4';
const DESTINATION_ID = '1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY';
const PAINT = ['Painted', 'Unpainted', 'Work in Progress'];
const GROUP_COLUMNS = ['rootId', 'name', 'size', 'creatureType', 'sex', 'race', 'role', 'home', 'paint', 'set', 'setNumber', 'notes'];
const COPY_COLUMNS = ['id', 'rootId', 'miniNumber', 'sticker', 'currentLocation', 'note'];
const GROUP_SOURCE = { rootId: 1, name: 2, quantity: 3, size: 5, creatureType: 6, sex: 8, race: 9, role: 10, home: 12, paint: 14, set: 15, setNumber: 16, notes: 18 };
const COPY_SOURCE = { id: 1, rootId: 2, miniNumber: 3, sticker: 4, currentLocation: 6 };
const SHARED_SOURCE = { name: 8, quantity: 9, size: 10, creatureType: 11, sex: 12, race: 13, role: 14, home: 15, paint: 16, set: 17, setNumber: 18, notes: 19 };
const LIST_SOURCE = { size: [5, 'Size'], creatureType: [7, 'Creature Type'], sex: [9, 'Sex'], race: [11, 'Race'], role: [13, 'Role'], set: [14, 'Set'], home: [16, 'Home'], currentLocation: [18, 'Locations'] };
const SOURCE_HEADERS = {
  'Entry Form': { row: 5, columns: { 1: 'Root ID', 2: 'Name', 3: 'Quantity', 5: 'Size', 6: 'Creature Type', 8: 'Sex', 9: 'Race', 10: 'Role', 12: 'Home', 14: 'Paint', 15: 'Set', 16: 'Set #', 18: 'Notes' } },
  'Master Inventory': { row: 1, columns: { 1: 'ID', 2: 'Root ID', 3: 'Mini #', 4: 'Sticker', 6: 'Current Loc', 8: 'Name', 9: 'Quantity', 10: 'Size', 11: 'Creature Type', 12: 'Sex', 13: 'Race', 14: 'Role', 15: 'Home', 16: 'Paint', 17: 'Set', 18: 'Set #', 19: 'Notes' } },
  'Data Lists': { row: 1, columns: { ...Object.fromEntries(Object.values(LIST_SOURCE)), 17: 'Additional Locations', 21: 'Stickers', 22: 'Unassigned Stickers', 23: 'Assigned Stickers' } },
  'Sticker Assignment': { row: 5, columns: { 1: 'ID', 3: 'Sticker', 10: 'Sticker' } },
  'Check Out Minis': { row: 1, columns: { 6: 'Root ID', 34: 'Hidden Column for Mini IDs' } }
};
const text = value => value == null ? '' : String(value);
const nonblank = value => text(value).trim() !== '';
const stickerKey = value => text(value).trim().toUpperCase();
const isNA = value => text(value).trim().toLowerCase() === 'n/a';
const namedSet = value => nonblank(value) && !isNA(value) && text(value).trim().toLowerCase() !== 'not specified';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pick = (row, columns) => Object.fromEntries(Object.entries(columns).map(([key, index]) => [key, text(row[index])]));
const table = (columns, records) => [columns, ...records.map(record => columns.map(column => record[column]))];
function letter(column) {
  let result = '';
  for (let n = column + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
function paint(value) {
  if (value === true || value === 'TRUE') return 'Painted';
  if (value === false || value === 'FALSE') return 'Unpainted';
  return PAINT.includes(value) ? value : null;
}
function completeRange(sheet) {
  return Number.isSafeInteger(sheet.rowCount) && sheet.rowCount > 0
    && Number.isSafeInteger(sheet.columnCount) && sheet.columnCount > 0
    && sheet.range === `A1:${letter(sheet.columnCount - 1)}${sheet.rowCount}`
    && Array.isArray(sheet.values) && sheet.values.length <= sheet.rowCount
    && sheet.values.every(row => Array.isArray(row) && row.length <= sheet.columnCount);
}
function analyzeImport(snapshot) {
  const issues = [];
  const issue = (severity, code, location, message) => issues.push({ severity, code, location, message });
  const fail = (code, location, message) => issue('error', code, location, message);
  const warn = (code, location, message) => issue('warning', code, location, message);
  if (snapshot.formatVersion !== 1) fail('SNAPSHOT_VERSION', 'snapshot', 'Expected snapshot formatVersion 1.');
  if (snapshot.source?.spreadsheetId !== SOURCE_ID) fail('SOURCE_ID', 'snapshot', 'The source is not the verified legacy workbook.');
  if (snapshot.destination?.spreadsheetId !== DESTINATION_ID) fail('DESTINATION_ID', 'snapshot', 'The destination is not the verified 2.0 workbook.');
  if (snapshot.source?.spreadsheetId === snapshot.destination?.spreadsheetId) fail('SAME_WORKBOOK', 'snapshot', 'Source and destination must differ.');
  if (!snapshot.source?.modifiedTimeBefore || snapshot.source.modifiedTimeBefore !== snapshot.source.modifiedTimeAfter) {
    fail('SOURCE_CHANGED', 'snapshot', 'Source modification time is missing or changed during capture. Read again.');
  }
  if (!snapshot.capturedAt || !Number.isFinite(Date.parse(snapshot.capturedAt))) fail('CAPTURE_TIME', 'snapshot', 'A valid capture timestamp is required.');
  if (!Array.isArray(snapshot.destination?.sheets) || !snapshot.destination.sheets.length) {
    fail('DESTINATION_CAPTURE', 'snapshot', 'Capture the destination tab metadata; missing evidence is not an empty workbook.');
  }
  const readSheet = (workbook, title) => {
    const matches = (workbook?.sheets || []).filter(sheet => sheet.title === title);
    if (matches.length !== 1) { fail('SHEET_MISSING', title, 'Expected exactly one captured sheet.'); return []; }
    const sheet = matches[0];
    if (!completeRange(sheet)) {
      fail('INCOMPLETE_RANGE', title, 'Expected valid grid dimensions and the full allocated range; do not silently ignore uncaptured rows/columns.');
      return [];
    }
    sheet.values.forEach((row, index) => row.forEach((value, column) => {
      if (/^#(?:REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|ERROR!|SPILL!)$/.test(text(value))) {
        fail('CELL_ERROR', `${title}!${letter(column)}${index + 1}`, 'Possible spreadsheet error; inspect rather than importing an error string as data.');
      }
    }));
    return sheet.values;
  };
  const knownSheets = ['Entry Form', 'Master Inventory', 'Data Lists', 'Sticker Assignment', 'Check Out Minis', 'Deleted Minis', 'Settings', 'Checked Out Log'];
  for (const sheet of snapshot.source?.sheets || []) {
    if (!knownSheets.includes(sheet.title)) warn('UNREVIEWED_TAB', sheet.title, 'Extra source tab remains in the legacy workbook; review before cutover.');
  }
  const source = Object.fromEntries(knownSheets
    .map(title => [title, readSheet(snapshot.source, title)]));
  for (const [title, definition] of Object.entries(SOURCE_HEADERS)) {
    for (const [column, expected] of Object.entries(definition.columns)) {
      const actual = text(source[title][definition.row - 1]?.[column]);
      if (actual !== expected) fail('HEADER_MISMATCH', `${title}!${letter(Number(column))}${definition.row}`, `Expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`);
    }
  }
  const groups = [], copies = [], groupsById = new Map(), copiesById = new Map(), stickersById = new Map();
  const quantities = new Map(), counts = new Map(), groupRows = new Map();
  const missingFields = [], setSuffixes = [];
  function unique(map, key, value, where, code) {
    if (!nonblank(key) || key !== key.trim()) { fail('INVALID_ID', where, 'Identity is blank or has surrounding whitespace; do not regenerate it.'); return; }
    if (map.has(key)) fail(code, where, `Duplicate identity ${key}.`);
    else map.set(key, value);
  }
  function unexpected(row, mapped, where) {
    row.forEach((value, column) => { if (nonblank(value) && !mapped.includes(column)) fail('UNMAPPED_DATA', `${where}:${letter(column)}`, 'Populated unmapped column requires review.'); });
  }
  source['Entry Form'].slice(5).forEach((row, index) => {
    const rowNumber = index + 6, where = `Entry Form!${rowNumber}`;
    // Unused form rows contain preset FALSE checkboxes, not miniature definitions.
    const substantive = row.some((value, column) => nonblank(value) && !(column === 14 && (value === false || value === 'FALSE')));
    if (!substantive) return;
    unexpected(row, Object.values(GROUP_SOURCE), where);
    const raw = pick(row, GROUP_SOURCE);
    const group = Object.fromEntries(GROUP_COLUMNS.map(key => [key, raw[key]]));
    unique(groupsById, group.rootId, group, where, 'DUPLICATE_GROUP');
    groupRows.set(group.rootId, rowNumber);
    if (!nonblank(group.name)) fail('MISSING_NAME', where, 'Definition has no name.');
    if (!/^\d+$/.test(raw.quantity)) fail('INVALID_QUANTITY', where, 'Quantity must be a non-negative whole number.');
    quantities.set(group.rootId, Number(raw.quantity));
    const status = paint(raw.paint);
    if (status === null) fail('UNKNOWN_PAINT', where, `Paint ${JSON.stringify(raw.paint)} cannot be safely inferred.`);
    group.paint = status ?? raw.paint;
    groups.push(group);
    for (const key of ['size', 'creatureType', 'sex', 'race', 'role', 'home', 'set']) {
      if (!nonblank(group[key])) { missingFields.push({ rootId: group.rootId, name: group.name, field: key, row: rowNumber }); warn('MISSING_FIELD', where, `${group.name}: ${key} is blank; preserve, do not guess.`); }
    }
    if (namedSet(group.set) && !nonblank(group.setNumber)) {
      missingFields.push({ rootId: group.rootId, name: group.name, field: 'setNumber', row: rowNumber });
      warn('MISSING_SET_NUMBER', where, `${group.name}: named Set has no number; it may not be a numbered product.`);
    }
    if (!namedSet(group.set) && nonblank(group.setNumber)) fail('INAPPLICABLE_SET_NUMBER', where, 'A Set number without a named Set needs review, not silent clearing.');
    if (nonblank(group.setNumber) && !/^\d[a-z\d]{0,2}$/i.test(group.setNumber)) warn('LEGACY_SET_NUMBER', where, 'Preserve this Set number as text; it is outside the current editor format.');
    if (/[a-z]/i.test(group.setNumber)) setSuffixes.push({ rootId: group.rootId, value: group.setNumber });
  });
  source['Master Inventory'].slice(1).forEach((row, index) => {
    if (!row.some(nonblank)) return;
    const where = `Master Inventory!${index + 2}`;
    unexpected(row, [...Object.values(COPY_SOURCE), ...Object.values(SHARED_SOURCE)], where);
    const copy = { ...pick(row, COPY_SOURCE), note: '' };
    copies.push(copy);
    unique(copiesById, copy.id, copy, where, 'DUPLICATE_COPY');
    const group = groupsById.get(copy.rootId);
    if (!group) fail('ORPHAN_COPY', where, `No definition for ${copy.rootId}.`);
    counts.set(copy.rootId, (counts.get(copy.rootId) || 0) + 1);
    if (!/^\d+$/.test(copy.miniNumber) || Number(copy.miniNumber) < 1) fail('INVALID_COPY_NUMBER', where, 'Mini # must be a positive whole number.');
    if (!nonblank(copy.currentLocation)) fail('MISSING_LOCATION', where, 'Do not substitute Home for a missing current location.');
    const key = stickerKey(copy.sticker);
    if (key && key !== 'N/A') unique(stickersById, key, copy, where, 'DUPLICATE_STICKER');
    if (copy.sticker !== copy.sticker.trim()) warn('STICKER_WHITESPACE', where, 'Sticker whitespace is preserved; uniqueness checks ignore it.');
    if (group) {
      for (const [field, column] of Object.entries(SHARED_SOURCE)) {
        const actual = field === 'paint' ? paint(text(row[column])) : text(row[column]);
        const expected = field === 'quantity' ? String(quantities.get(group.rootId)) : group[field];
        if (actual !== expected) fail('SHARED_FIELD_MISMATCH', `${where}:${letter(column)}`, `Copy's derived ${field} differs from Entry Form; refresh/reconcile before import.`);
      }
    }
  });
  if (!groups.length || !copies.length) fail('EMPTY_COLLECTION', 'source', 'An unexpectedly empty source must not become an empty import.');
  groups.forEach(group => {
    const count = counts.get(group.rootId) || 0;
    if (count !== quantities.get(group.rootId)) fail('QUANTITY_MISMATCH', `Entry Form!${groupRows.get(group.rootId)}`, `${group.rootId}: quantity ${quantities.get(group.rootId)} versus ${count} physical rows.`);
    if (!count) warn('ZERO_COPIES', group.rootId, 'Definition has no copies; current authoring requires at least one.');
  });
  const numberKeys = new Set();
  copies.forEach(copy => {
    const key = JSON.stringify([copy.rootId, Number(copy.miniNumber)]);
    if (numberKeys.has(key)) fail('DUPLICATE_COPY_NUMBER', copy.id, 'Two copies of this group have the same Mini #.');
    numberKeys.add(key);
  });
  const listRows = source['Data Lists'].slice(1), catalogs = {}, listRecords = [];
  for (const [field, [column]] of Object.entries(LIST_SOURCE)) {
    const values = listRows.map(row => text(row[column])).filter(nonblank);
    catalogs[field] = Array.from(new Set(values));
    if (!values.length) fail('EMPTY_CATALOG', `Data Lists!${letter(column)}`, `Missing ${field} choices.`);
    if (values.length !== catalogs[field].length) warn('DUPLICATE_OPTIONS', `Data Lists!${letter(column)}`, 'Repeated choices are deduplicated while keeping first-seen order.');
    catalogs[field].forEach((value, index) => listRecords.push({ field, value, sortOrder: String(index + 1) }));
  }
  PAINT.forEach((value, index) => listRecords.push({ field: 'paint', value, sortOrder: String(index + 1) }));
  catalogs.paint = PAINT.slice();
  groups.forEach(group => Object.keys(LIST_SOURCE).filter(field => field !== 'currentLocation').forEach(field => {
    if (nonblank(group[field]) && !catalogs[field].includes(group[field])) fail('UNKNOWN_OPTION', group.rootId, `${field}: ${JSON.stringify(group[field])} is not in the legacy catalog.`);
  }));
  copies.forEach(copy => { if (!catalogs.currentLocation.includes(copy.currentLocation)) fail('UNKNOWN_LOCATION', copy.id, `Current location ${JSON.stringify(copy.currentLocation)} is not in the catalog.`); });
  catalogs.home.forEach(home => { if (!catalogs.currentLocation.includes(home)) fail('HOME_NOT_LOCATION', 'Data Lists', `${home} is not a usable current location.`); });
  const catalogStickers = [], catalogKeys = new Set();
  listRows.map(row => text(row[21])).filter(nonblank).forEach(code => {
    if (isNA(code)) return; // n/a is a per-copy state, not a unique consumable sticker.
    const key = stickerKey(code);
    if (!/^[A-Z]\d{2}$/.test(key)) fail('INVALID_STICKER_CATALOG', 'Data Lists!V', `Unexpected catalog code ${JSON.stringify(code)}.`);
    if (catalogKeys.has(key)) fail('DUPLICATE_STICKER_CATALOG', 'Data Lists!V', `Repeated catalog code ${code}.`);
    catalogKeys.add(key);
    catalogStickers.push(code);
  });
  if (!catalogStickers.length) fail('EMPTY_STICKER_CATALOG', 'Data Lists!V', 'No usable sticker catalog captured.');
  for (const [code, copy] of stickersById) if (!catalogKeys.has(code)) fail('STICKER_OUTSIDE_CATALOG', copy.id, `Assigned code ${code} is absent from the catalog.`);
  const availableStickers = catalogStickers.filter(code => !stickersById.has(stickerKey(code)));
  for (const [column, expected] of [[22, availableStickers], [23, catalogStickers.filter(code => stickersById.has(stickerKey(code)))]]) {
    const actual = listRows.map(row => text(row[column])).filter(value => nonblank(value) && !isNA(value)).map(stickerKey);
    if (JSON.stringify(actual) !== JSON.stringify(expected.map(stickerKey))) fail('DERIVED_STICKERS_MISMATCH', `Data Lists!${letter(column)}`, 'Calculated sticker availability differs from the legacy formula output.');
  }
  source['Sticker Assignment'].slice(5).forEach((row, index) => {
    if (nonblank(row[3])) fail('STAGED_STICKER', `Sticker Assignment!D${index + 6}`, 'Unapplied assignment found; do not lose or auto-apply it.');
    // The live header is K; the archived script references J. Inspect both.
    if (nonblank(row[9]) || nonblank(row[10])) fail('STAGED_UNASSIGN', `Sticker Assignment!J${index + 6}:K${index + 6}`, 'Potential unapplied removal needs review.');
  });
  const checkout = source['Check Out Minis'];
  Array.from({ length: 12 }, (_, index) => {
    const row = [24, 27, 30][Math.floor(index / 4)], column = 1 + index % 4;
    const id = text(checkout[index + 1]?.[34]), value = text(checkout[row - 1]?.[column]);
    if (!nonblank(value)) return;
    const copy = copiesById.get(id), group = copy && groupsById.get(copy.rootId);
    const location = value === '<Return Home>' ? group?.home : value;
    if (!copy || location !== copy.currentLocation) fail('STAGED_LOCATION', `Check Out Minis!${letter(column)}${row}`, 'Displayed location differs from saved inventory, or has no matching copy.');
  });
  const tables = {
    Groups: table(GROUP_COLUMNS, groups), Copies: table(COPY_COLUMNS, copies),
    Lists: table(['field', 'value', 'sortOrder'], listRecords),
    Stickers: table(['sticker', 'sortOrder'], catalogStickers.map((sticker, index) => ({ sticker, sortOrder: String(index + 1) })))
  };
  const destination = planDestination(tables, snapshot.destination?.sheets || [], fail);
  const stats = {
    groups: groups.length, copies: copies.length, declaredCopies: [...quantities.values()].reduce((a, b) => a + b, 0),
    assignedStickers: stickersById.size, notApplicableStickers: copies.filter(copy => isNA(copy.sticker)).length,
    blankStickers: copies.filter(copy => !nonblank(copy.sticker)).length,
    away: copies.filter(copy => groupsById.has(copy.rootId) && copy.currentLocation !== groupsById.get(copy.rootId).home).length,
    catalogChoices: Object.fromEntries(Object.entries(catalogs).map(([key, values]) => [key, values.length])),
    stickerCatalog: catalogStickers.length, availableStickers: availableStickers.length, nextAvailableSticker: availableStickers[0] || null,
    paint: Object.fromEntries(PAINT.map(status => [status, groups.filter(group => group.paint === status).length])),
    missingFields, setSuffixes,
    history: { deletedRows: source['Deleted Minis'].slice(1).filter(row => row.some(nonblank)).length, checkoutLogRows: source['Checked Out Log'].filter(row => row.some(nonblank)).length }
  };
  const candidate = { schemaVersion: 1, sourceId: SOURCE_ID, destinationId: DESTINATION_ID, tables };
  const report = { mode: 'DRY_RUN_ONLY', capturedAt: snapshot.capturedAt, sourceId: snapshot.source?.spreadsheetId,
    destinationId: snapshot.destination?.spreadsheetId, snapshotHash: hash(snapshot), candidateHash: hash(candidate),
    sourceModifiedTime: snapshot.source?.modifiedTimeAfter, stats, destination, issues,
    blockers: issues.filter(item => item.severity === 'error').length,
    warnings: issues.filter(item => item.severity === 'warning').length,
    approvalRequired: true, remoteWritesPerformed: false };
  report.readyForReview = report.blockers === 0;
  return { candidate, report };
}

function planDestination(tables, sheets, fail) {
  const results = [];
  const keys = { Groups: row => row[0], Copies: row => row[0], Lists: row => JSON.stringify(row.slice(0, 2)), Stickers: row => stickerKey(row[0]) };
  for (const [title, incoming] of Object.entries(tables)) {
    const matches = sheets.filter(sheet => sheet.title === title);
    if (!matches.length) { results.push({ table: title, action: 'create', add: incoming.length - 1, unchanged: 0 }); continue; }
    if (matches.length !== 1) { fail('DESTINATION_DUPLICATE_TAB', title, 'Ambiguous destination tab.'); continue; }
    const sheet = matches[0];
    if (!completeRange(sheet)) {
      fail('DESTINATION_INCOMPLETE', title, 'Full destination tab must be captured before planning a rerun.'); continue;
    }
    const values = sheet.values.map(row => row.map(text));
    if (JSON.stringify(values[0]) !== JSON.stringify(incoming[0])) { fail('DESTINATION_SCHEMA', title, 'Existing headers differ; never replace this tab implicitly.'); continue; }
    const existing = new Map();
    values.slice(1).filter(row => row.some(nonblank)).forEach(row => {
      const key = keys[title](row);
      if (!key || existing.has(key)) fail('DESTINATION_DUPLICATE_KEY', title, `Invalid or repeated destination identity ${key}.`);
      existing.set(key, row);
    });
    let add = 0, unchanged = 0;
    for (const row of incoming.slice(1)) {
      const key = keys[title](row), found = existing.get(key);
      if (!found) add++;
      else if (found.length <= row.length && row.every((value, index) => text(found[index]) === text(value))) unchanged++;
      else fail('DESTINATION_CONFLICT', title, `Existing ${key} differs from the source; no overwrite is proposed.`);
      existing.delete(key);
    }
    for (const key of existing.keys()) fail('DESTINATION_EXTRA_RECORD', title, `Existing ${key} is absent from this source; do not delete it.`);
    results.push({ table: title, action: add ? 'append-missing' : 'unchanged', add, unchanged });
  }
  const preservedTabs = sheets.filter(sheet => !Object.hasOwn(tables, sheet.title)).map(sheet => ({ title: sheet.title,
    populatedCells: (sheet.values || []).reduce((total, row) => total + row.filter(nonblank).length, 0) }));
  return { tables: results, preservedTabs };
}

function toAppState(candidate) {
  const records = title => candidate.tables[title].slice(1).map(row => Object.fromEntries(candidate.tables[title][0].map((key, index) => [key, row[index]])));
  const groups = records('Groups'), copies = records('Copies');
  return { prototypeMode: true, importPreview: true, locations: records('Lists').filter(item => item.field === 'currentLocation').map(item => item.value),
    groups: groups.map(group => ({ ...group, copies: copies.filter(copy => copy.rootId === group.rootId).map(copy => ({ ...copy, home: group.home })) })) };
}

function renderReport(report) {
  const s = report.stats;
  return [ '# Import Dry Run', '', `Captured: ${report.capturedAt}`, '',
    '**No spreadsheet writes. Review and fresh capture are required before an actual import.**', '',
    `Result: ${report.blockers} blockers, ${report.warnings} warnings.`, '',
    `- Groups: ${s.groups}`, `- Copies: ${s.copies} (declared quantity ${s.declaredCopies})`,
    `- Stickers: ${s.assignedStickers} assigned, ${s.notApplicableStickers} n/a, ${s.blankStickers} blank`,
    `- Away: ${s.away}`, `- Catalog: ${s.stickerCatalog} usable IDs; ${s.availableStickers} available; first ${s.nextAvailableSticker || 'none'}`, '',
    '## Destination Plan', '', ...report.destination.tables.map(item => `- ${item.table}: ${item.action}; ${item.add} new, ${item.unchanged} unchanged`),
    ...report.destination.preservedTabs.map(item => `- Preserve ${item.title}: ${item.populatedCells} populated cells`), '',
    '## Review Items', '', ...(report.issues.length ? report.issues.map(item => `- ${item.severity.toUpperCase()} ${item.code} (${item.location}): ${item.message}`) : ['None.']), '',
    '## Reproducibility', '', `Snapshot SHA-256: ${report.snapshotHash}`, `Candidate SHA-256: ${report.candidateHash}`, '' ].join('\n');
}
module.exports = { SOURCE_ID, DESTINATION_ID, GROUP_COLUMNS, COPY_COLUMNS, analyzeImport, planDestination, toAppState, renderReport };
