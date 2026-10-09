// Offline-tested save domain model. Intentionally excluded from clasp uploads.
// No service calls, public endpoints, or writes: a future adapter must authorize,
// lock, reread, prepare, and atomically commit state + revision + request receipt.
var PERSISTENCE_FIELDS_ = ["size", "creatureType", "sex", "race", "role", "home", "paint", "set"];
var PERSISTENCE_CHOICE_FIELDS_ = ["size", "creatureType", "sex", "race", "role", "paint", "set", "location"];
var PERSISTENCE_SCHEMA_VERSION_ = 2;

function persistenceError_(code, message, details) {
  var error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  throw error;
}

function persistenceAssert_(condition, message) {
  if (!condition) persistenceError_("INVALID", message);
}

function persistenceClone_(value) { return JSON.parse(JSON.stringify(value)); }
function persistenceKey_(value) { return value.trim().toUpperCase(); }
function persistenceSentinel_(value) { return ["N/A", "NOT SPECIFIED"].indexOf(persistenceKey_(value)) >= 0; }
function persistenceText_(value) { return typeof value === "string" && value.length <= 45000; }
function persistenceId_(value) { return typeof value === "string" && !!value && value === value.trim() && value.length <= 128; }
function persistenceTime_(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }

function persistenceShape_(value, keys, label) {
  persistenceAssert_(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); }), "Unexpected " + label + " fields");
}

function persistenceCanonical_(value) {
  if (Array.isArray(value)) return "[" + value.map(persistenceCanonical_).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ":" + persistenceCanonical_(value[key]);
  }).join(",") + "}";
  persistenceAssert_(value === null || ["string", "boolean", "number"].indexOf(typeof value) >= 0, "Request must contain only JSON values");
  persistenceAssert_(typeof value !== "number" || Number.isFinite(value), "Request number is invalid");
  return JSON.stringify(value);
}

function persistenceDigest_(value, services) {
  var digest = services.digest(persistenceCanonical_(value));
  persistenceAssert_(typeof digest === "string" && /^[a-f\d]{64}$/.test(digest), "Digest must be SHA-256 hex");
  return digest;
}

function persistenceNewId_(state, makeId) {
  var id = makeId();
  persistenceAssert_(typeof id === "string" && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id), "ID generator must return a UUID v4");
  persistenceAssert_(!state.groups.some(function (item) { return item.rootId === id; })
    && !state.copies.concat(state.choices).some(function (item) { return item.id === id; }), "Generated ID collision");
  return id;
}

function validatePersistenceState_(state) {
  persistenceShape_(state, ["schemaVersion", "collectionId", "revision", "groups", "copies", "choices", "stickerCatalog", "receipts"], "storage");
  persistenceAssert_(state.schemaVersion === PERSISTENCE_SCHEMA_VERSION_ && persistenceId_(state.collectionId), "Unsupported collection/schema");
  persistenceAssert_(Number.isSafeInteger(state.revision) && state.revision >= 0, "Invalid revision");
  ["groups", "copies", "choices", "stickerCatalog", "receipts"].forEach(function (key) {
    persistenceAssert_(Array.isArray(state[key]), "Invalid " + key + " table");
  });
  var choices = new Map(), choiceNames = new Set(), orders = new Set(), groups = new Map(), ids = new Set();
  function identity(id) {
    persistenceAssert_(persistenceId_(id) && !ids.has(id), "Invalid or duplicate identity");
    ids.add(id);
  }
  state.choices.forEach(function (choice) {
    persistenceShape_(choice, ["id", "field", "value", "sortOrder", "home", "removedAt"], "choice");
    identity(choice.id);
    persistenceAssert_(PERSISTENCE_CHOICE_FIELDS_.indexOf(choice.field) >= 0 && persistenceText_(choice.value) && !!choice.value.trim(), "Invalid choice");
    var key = choice.field + ":" + persistenceKey_(choice.value), order = choice.field + ":" + choice.sortOrder;
    persistenceAssert_(!choiceNames.has(key), "Ambiguous choice names");
    persistenceAssert_(Number.isSafeInteger(choice.sortOrder) && choice.sortOrder > 0 && !orders.has(order), "Invalid choice order");
    persistenceAssert_(typeof choice.home === "boolean" && (choice.field === "location" || !choice.home), "Invalid Home eligibility");
    persistenceAssert_(choice.removedAt === "" || persistenceTime_(choice.removedAt), "Invalid choice removal date");
    choiceNames.add(key); orders.add(order); choices.set(choice.id, choice);
  });
  function reference(id, field, optional, homeRequired) {
    if (optional && id === "") return;
    var choice = choices.get(id);
    persistenceAssert_(choice && choice.field === field && (!homeRequired || choice.home), "Invalid " + field + " reference");
  }
  state.groups.forEach(function (group) {
    persistenceShape_(group, ["rootId", "name", "setNumber", "notes", "deletedAt"].concat(PERSISTENCE_FIELDS_.map(function (field) { return field + "Id"; })), "group");
    identity(group.rootId);
    persistenceAssert_(persistenceText_(group.name) && !!group.name.trim() && persistenceText_(group.notes) && persistenceText_(group.setNumber), "Invalid group text");
    persistenceAssert_(group.deletedAt === "" || persistenceTime_(group.deletedAt), "Invalid group deletion date");
    PERSISTENCE_FIELDS_.forEach(function (field) {
      reference(group[field + "Id"], field === "home" ? "location" : field, true, field === "home" && !group.deletedAt);
    });
    groups.set(group.rootId, group);
  });
  var catalog = new Set(), assigned = new Set(), sequences = new Set(), activeCounts = new Map();
  state.stickerCatalog.forEach(function (code) {
    persistenceAssert_(typeof code === "string" && /^[A-Z]\d{2}$/.test(code) && !catalog.has(code), "Invalid sticker catalog");
    catalog.add(code);
  });
  persistenceAssert_(catalog.size > 0, "Missing sticker catalog");
  state.copies.forEach(function (copy) {
    persistenceShape_(copy, ["id", "rootId", "miniNumber", "sticker", "currentLocationId", "note", "deletedAt", "deletedWithGroup"], "copy");
    identity(copy.id);
    var group = groups.get(copy.rootId);
    persistenceAssert_(group, "Orphan copy");
    persistenceAssert_(typeof copy.miniNumber === "string" && /^\d+$/.test(copy.miniNumber)
      && Number.isSafeInteger(Number(copy.miniNumber)) && Number(copy.miniNumber) > 0, "Invalid copy number");
    var sequence = copy.rootId + ":" + Number(copy.miniNumber);
    persistenceAssert_(!sequences.has(sequence), "Duplicate copy number"); sequences.add(sequence);
    persistenceAssert_(persistenceText_(copy.sticker) && persistenceText_(copy.note), "Invalid copy text");
    persistenceAssert_(copy.deletedAt === "" || persistenceTime_(copy.deletedAt), "Invalid copy deletion date");
    persistenceAssert_(copy.deletedWithGroup === "" || (copy.deletedWithGroup === copy.rootId && !!group.deletedAt && copy.deletedAt === group.deletedAt), "Invalid deletion membership");
    persistenceAssert_(!group.deletedAt || !!copy.deletedAt, "Active copy in a deleted group");
    reference(copy.currentLocationId, "location", false, false);
    var sticker = persistenceKey_(copy.sticker);
    persistenceAssert_(!sticker || sticker === "N/A" || catalog.has(sticker), "Sticker outside catalog");
    if (!copy.deletedAt) {
      if (sticker && sticker !== "N/A") {
        if (assigned.has(sticker)) persistenceError_("STICKER_CONFLICT", "Sticker " + sticker + " is already assigned");
        assigned.add(sticker);
      }
      activeCounts.set(copy.rootId, (activeCounts.get(copy.rootId) || 0) + 1);
    }
  });
  state.groups.forEach(function (group) {
    persistenceAssert_(group.deletedAt || activeCounts.has(group.rootId), "A group needs at least one active copy");
  });
  function groupReceipt(result, extraKeys) {
    persistenceAssert_(result && typeof result === "object" && !Array.isArray(result), "Invalid group receipt");
    var created = Object.prototype.hasOwnProperty.call(result, "createdCopies");
    persistenceShape_(result, (created ? ["rootId", "createdCopies"] : ["rootId"]).concat(extraKeys), "group receipt");
    persistenceAssert_(groups.has(result.rootId), "Missing receipt group");
    if (!created) return;
    persistenceAssert_(Array.isArray(result.createdCopies), "Invalid created-copy receipt");
    var keys = new Set(), copyIds = new Set();
    result.createdCopies.forEach(function (copy) {
      persistenceShape_(copy, ["clientKey", "id"], "created-copy receipt");
      persistenceAssert_(persistenceId_(copy.clientKey) && !keys.has(copy.clientKey) && !copyIds.has(copy.id)
        && state.copies.some(function (item) { return item.id === copy.id && item.rootId === result.rootId; }), "Invalid created-copy mapping");
      keys.add(copy.clientKey); copyIds.add(copy.id);
    });
  }
  var requests = new Set();
  state.receipts.forEach(function (receipt, index) {
    persistenceShape_(receipt, ["requestId", "fingerprint", "result"], "receipt");
    persistenceAssert_(persistenceId_(receipt.requestId) && !requests.has(receipt.requestId) && /^[a-f\d]{64}$/.test(receipt.fingerprint), "Invalid receipt");
    var result = receipt.result;
    persistenceAssert_(result && result.revision === index + 1 && result.revision <= state.revision, "Invalid receipt revision");
    if (Object.prototype.hasOwnProperty.call(result, "choiceId")) {
      persistenceShape_(result, ["choiceId", "revision"], "choice receipt");
      persistenceAssert_(choices.has(result.choiceId), "Missing receipt choice");
    } else if (Object.prototype.hasOwnProperty.call(result, "changes")) {
      persistenceShape_(result, ["changes", "revision"], "batch receipt");
      persistenceAssert_(Array.isArray(result.changes) && result.changes.length > 0, "Empty batch receipt");
      var batchKeys = new Set(), batchRoots = new Set();
      result.changes.forEach(function (item) {
        groupReceipt(item, ["clientKey"]);
        persistenceAssert_(persistenceId_(item.clientKey) && !batchKeys.has(item.clientKey)
          && !batchRoots.has(item.rootId), "Duplicate batch result");
        batchKeys.add(item.clientKey); batchRoots.add(item.rootId);
      });
    } else groupReceipt(result, ["revision"]);
    requests.add(receipt.requestId);
  });
  persistenceAssert_(state.receipts.length === state.revision, "Missing save receipt");
  return state;
}

function migratePreviewForPersistence_(preview, makeId) {
  var state = { schemaVersion: PERSISTENCE_SCHEMA_VERSION_, collectionId: preview.collectionId, revision: 0,
    groups: [], copies: [], choices: [], stickerCatalog: preview.stickerCatalog.slice(), receipts: [] };
  var byValue = new Map();
  PERSISTENCE_CHOICE_FIELDS_.forEach(function (field) {
    var values = (field === "location" ? preview.catalogs.currentLocation : preview.catalogs[field]).slice();
    // The UI already offers this explicit choice, even if the imported list did not.
    if (field !== "location" && field !== "paint" && values.indexOf("Not specified") < 0) values.push("Not specified");
    values.forEach(function (value, index) {
      var choice = { id: persistenceNewId_(state, makeId), field: field, value: value,
        sortOrder: index + 1, home: field === "location" && preview.catalogs.home.indexOf(value) >= 0, removedAt: "" };
      state.choices.push(choice); byValue.set(field + ":" + value, choice.id);
    });
  });
  function ref(field, value) {
    if (value === "") return "";
    var id = byValue.get(field + ":" + value);
    persistenceAssert_(id, "Cannot migrate an unknown " + field + " choice");
    return id;
  }
  preview.groups.forEach(function (source) {
    var group = { rootId: source.rootId, name: source.name, setNumber: source.setNumber, notes: source.notes, deletedAt: "" };
    PERSISTENCE_FIELDS_.forEach(function (field) { group[field + "Id"] = ref(field === "home" ? "location" : field, source[field]); });
    state.groups.push(group);
    source.copies.forEach(function (copy) {
      state.copies.push({ id: copy.id, rootId: group.rootId, miniNumber: copy.miniNumber, sticker: copy.sticker,
        currentLocationId: ref("location", copy.currentLocation), note: copy.note, deletedAt: "", deletedWithGroup: "" });
    });
  });
  return validatePersistenceState_(state);
}

function persistenceGroupFields_() {
  return ["name", "setNumber", "notes"].concat(PERSISTENCE_FIELDS_.map(function (field) { return field + "Id"; }));
}

function persistenceReferenceChange_(state, id, previous, field, allowBlank) {
  if (allowBlank && id === "") return;
  var choice = state.choices.find(function (item) { return item.id === id && item.field === field; });
  persistenceAssert_(choice && (!choice.removedAt || id === previous), "Choose an available " + field + " value");
}

function persistenceSaveGroup_(state, payload, services, now) {
  persistenceShape_(payload, ["rootId", "fields", "copies"], "group save");
  persistenceShape_(payload.fields, persistenceGroupFields_(), "editable group");
  var isNew = payload.rootId === "";
  var group = state.groups.find(function (item) { return item.rootId === payload.rootId && !item.deletedAt; });
  persistenceAssert_(isNew || group, "Group is missing or deleted");
  var previous = group || {};
  persistenceGroupFields_().forEach(function (key) { persistenceAssert_(persistenceText_(payload.fields[key]), "Invalid " + key); });
  persistenceAssert_(!!payload.fields.name.trim(), "Enter a miniature name");
  PERSISTENCE_FIELDS_.forEach(function (field) {
    var id = payload.fields[field + "Id"];
    persistenceReferenceChange_(state, id, previous[field + "Id"], field === "home" ? "location" : field, !isNew);
    if (field === "paint" && previous.paintId) persistenceAssert_(!!id, "Choose Paint");
  });
  var set = state.choices.find(function (choice) { return choice.id === payload.fields.setId; });
  var namedSet = set && !persistenceSentinel_(set.value);
  var number = payload.fields.setNumber.trim();
  if (namedSet) {
    persistenceAssert_(!isNew || !!number, "Enter Set #");
    persistenceAssert_(number === previous.setNumber || /^(?:\d[a-z\d]{0,2})?$/i.test(number), "Invalid Set #");
  }
  persistenceAssert_(Array.isArray(payload.copies) && payload.copies.length > 0, "Add at least one copy");
  if (isNew) {
    group = { rootId: persistenceNewId_(state, services.makeId), deletedAt: "" };
    state.groups.push(group);
  }
  persistenceGroupFields_().forEach(function (key) { group[key] = payload.fields[key]; });
  group.name = group.name.trim(); group.setNumber = number;
  var retained = new Set(), clientKeys = new Set(), created = [];
  var nextNumber = state.copies.filter(function (copy) { return copy.rootId === group.rootId; })
    .reduce(function (max, copy) { return Math.max(max, Number(copy.miniNumber)); }, 0);
  payload.copies.forEach(function (value) {
    persistenceShape_(value, ["id", "clientKey", "sticker", "currentLocationId", "note"], "editable copy");
    persistenceAssert_(persistenceId_(value.clientKey) && !clientKeys.has(value.clientKey), "Invalid or duplicate client copy key");
    clientKeys.add(value.clientKey);
    var copy = state.copies.find(function (item) { return item.id === value.id && item.rootId === group.rootId && !item.deletedAt; });
    persistenceAssert_(value.id === "" || copy, "Copy does not belong to this active group");
    persistenceAssert_(!retained.has(value.id), "Copy included twice");
    persistenceReferenceChange_(state, value.currentLocationId, copy && copy.currentLocationId, "location", false);
    persistenceAssert_(persistenceText_(value.sticker) && persistenceText_(value.note), "Invalid copy text");
    if (!copy) {
      copy = { id: persistenceNewId_(state, services.makeId), rootId: group.rootId,
        miniNumber: String(++nextNumber).padStart(2, "0"), deletedAt: "", deletedWithGroup: "" };
      state.copies.push(copy); created.push({ clientKey: value.clientKey, id: copy.id });
    }
    copy.sticker = value.sticker.trim(); copy.note = value.note; copy.currentLocationId = value.currentLocationId;
    retained.add(copy.id);
  });
  state.copies.forEach(function (copy) {
    if (copy.rootId === group.rootId && !copy.deletedAt && !retained.has(copy.id)) copy.deletedAt = now;
  });
  return { rootId: group.rootId, createdCopies: created };
}

function persistenceSaveLocations_(state, payload) {
  persistenceShape_(payload, ["rootId", "copies"], "location save");
  persistenceAssert_(state.groups.some(function (group) { return group.rootId === payload.rootId && !group.deletedAt; }), "Group is missing or deleted");
  persistenceAssert_(Array.isArray(payload.copies) && payload.copies.length > 0, "No locations to save");
  var seen = new Set();
  payload.copies.forEach(function (value) {
    persistenceShape_(value, ["id", "currentLocationId"], "location change");
    var copy = state.copies.find(function (item) { return item.id === value.id && item.rootId === payload.rootId && !item.deletedAt; });
    persistenceAssert_(copy && !seen.has(copy.id), "Invalid location copy"); seen.add(copy.id);
    persistenceReferenceChange_(state, value.currentLocationId, copy.currentLocationId, "location", false);
    copy.currentLocationId = value.currentLocationId;
  });
  return { rootId: payload.rootId };
}

function persistenceDeleteOrRestore_(state, payload, restoring, now) {
  persistenceShape_(payload, ["rootId"], "group deletion/restore");
  var group = state.groups.find(function (item) { return item.rootId === payload.rootId; });
  persistenceAssert_(group && (!!group.deletedAt === restoring), "Group is not in the expected deletion state");
  state.copies.forEach(function (copy) {
    if (copy.rootId !== group.rootId) return;
    if (!restoring && !copy.deletedAt) { copy.deletedAt = now; copy.deletedWithGroup = group.rootId; }
    if (restoring && copy.deletedWithGroup === group.rootId) { copy.deletedAt = ""; copy.deletedWithGroup = ""; }
  });
  group.deletedAt = restoring ? "" : now;
  return { rootId: group.rootId };
}

function persistenceRestoreCopy_(state, payload) {
  persistenceShape_(payload, ["rootId", "id"], "copy restore");
  var group = state.groups.find(function (item) { return item.rootId === payload.rootId && !item.deletedAt; });
  var copy = state.copies.find(function (item) { return item.id === payload.id && item.rootId === payload.rootId; });
  persistenceAssert_(group, "Restore the group before restoring this copy");
  persistenceAssert_(copy && copy.deletedAt && !copy.deletedWithGroup, "Copy is not available to restore");
  copy.deletedAt = "";
  return { rootId: group.rootId };
}

function persistenceRestoreAndSave_(state, payload, services, now) {
  var group = state.groups.find(function (item) { return item.rootId === payload.rootId; });
  persistenceAssert_(group && Array.isArray(payload.copies), "Missing group to restore");
  if (group.deletedAt) persistenceDeleteOrRestore_(state, { rootId: payload.rootId }, true, now);
  payload.copies.forEach(function (value) {
    var copy = state.copies.find(function (item) { return item.id === value.id && item.rootId === payload.rootId && item.deletedAt; });
    if (copy) persistenceRestoreCopy_(state, { rootId: payload.rootId, id: copy.id });
  });
  return persistenceSaveGroup_(state, payload, services, now);
}

function persistenceChoiceChange_(state, payload, kind, services, now) {
  var editing = kind === "saveChoice";
  persistenceShape_(payload, editing ? ["id", "field", "value", "home"] : ["id"], "choice change");
  var choice = state.choices.find(function (item) { return item.id === payload.id; });
  if (!editing) {
    persistenceAssert_(choice && !persistenceSentinel_(choice.value), "This choice cannot be removed/restored");
    persistenceAssert_(!!choice.removedAt === (kind === "restoreChoice"), "Choice is not in the expected removal state");
    choice.removedAt = kind === "restoreChoice" ? "" : now;
  } else {
    persistenceAssert_(payload.id === "" || choice, "Choice is missing");
    persistenceAssert_(PERSISTENCE_CHOICE_FIELDS_.indexOf(payload.field) >= 0 && persistenceText_(payload.value)
      && !!payload.value.trim() && typeof payload.home === "boolean", "Invalid choice fields");
    var value = payload.value.trim();
    persistenceAssert_(!choice || (choice.field === payload.field && !choice.removedAt && !persistenceSentinel_(choice.value)), "This choice cannot be renamed");
    persistenceAssert_(!persistenceSentinel_(value) && persistenceKey_(value) !== "NOT ENTERED", "Reserved choice name");
    var existing = state.choices.find(function (item) { return item.field === payload.field && persistenceKey_(item.value) === persistenceKey_(value); });
    persistenceAssert_(!existing || existing === choice || (payload.id === "" && existing.removedAt), "Choice name is already used");
    if (!choice) {
      choice = existing || { id: persistenceNewId_(state, services.makeId), field: payload.field,
        sortOrder: state.choices.filter(function (item) { return item.field === payload.field; })
          .reduce(function (max, item) { return Math.max(max, item.sortOrder); }, 0) + 1 };
      if (!existing) state.choices.push(choice);
    }
    choice.value = value; choice.home = payload.home; choice.removedAt = "";
  }
  return { choiceId: choice.id };
}

function persistenceBatchItems_(payload) {
  persistenceShape_(payload, ["changes"], "batch save");
  persistenceAssert_(Array.isArray(payload.changes) && payload.changes.length > 0, "No changes to save");
  var keys = new Set(), roots = new Set();
  payload.changes.forEach(function (item) {
    persistenceShape_(item, ["clientKey", "kind", "payload"], "batch item");
    persistenceAssert_(persistenceId_(item.clientKey) && !keys.has(item.clientKey), "Invalid or duplicate batch key");
    keys.add(item.clientKey);
    persistenceAssert_(["saveGroup", "saveLocations", "restoreGroupAndSave"].indexOf(item.kind) >= 0, "Only miniature saves belong in a batch");
    persistenceAssert_(item.payload && typeof item.payload === "object", "Invalid batch payload");
    var rootId = item.payload.rootId;
    persistenceAssert_((rootId === "" && item.kind === "saveGroup") || persistenceId_(rootId), "Invalid batch group");
    if (rootId) {
      persistenceAssert_(!roots.has(rootId), "Combine editor and location changes into one save per group");
      roots.add(rootId);
    }
  });
  return payload.changes;
}

function persistenceSaveBatch_(state, payload, services, now) {
  return { changes: persistenceBatchItems_(payload).map(function (item) {
    var result = item.kind === "saveGroup" ? persistenceSaveGroup_(state, item.payload, services, now)
      : item.kind === "restoreGroupAndSave" ? persistenceRestoreAndSave_(state, item.payload, services, now)
        : persistenceSaveLocations_(state, item.payload);
    result.clientKey = item.clientKey;
    return result;
  }) };
}

function persistenceTargets_(state, kind, payload) {
  var groups = new Set(), choices = new Set();
  var items = kind === "saveBatch" ? persistenceBatchItems_(payload) : [{ kind: kind, payload: payload }];
  items.forEach(function (item) {
    var value = item.payload;
    persistenceAssert_(value && typeof value === "object" && !Array.isArray(value), "Invalid change payload");
    if (["saveGroup", "saveLocations", "deleteGroup", "restoreGroup", "restoreCopy", "restoreGroupAndSave"].indexOf(item.kind) >= 0) {
      persistenceAssert_(persistenceId_(value.rootId) || (item.kind === "saveGroup" && value.rootId === ""), "Invalid target group");
      if (value.rootId) groups.add(value.rootId);
    } else if (["saveChoice", "removeChoice", "restoreChoice"].indexOf(item.kind) >= 0) {
      persistenceAssert_(persistenceId_(value.id) || (item.kind === "saveChoice" && value.id === ""), "Invalid target choice");
      if (value.id) choices.add(value.id);
      else if (typeof value.value === "string") {
        // Add can restore a removed label. That existing choice also needs a baseline.
        var existing = state.choices.find(function (choice) {
          return choice.field === value.field && persistenceKey_(choice.value) === persistenceKey_(value.value);
        });
        if (existing) choices.add(existing.id);
      }
    } else persistenceError_("INVALID", "Unsupported save operation");
  });
  return { groups: Array.from(groups).sort(), choices: Array.from(choices).sort() };
}

function persistenceRecordToken_(state, kind, id, services) {
  var record = kind === "groups" ? state.groups.find(function (group) { return group.rootId === id; })
    : state.choices.find(function (choice) { return choice.id === id; });
  if (!record) return "";
  var value = record;
  if (kind === "groups") value = { group: record, copies: state.copies.filter(function (copy) { return copy.rootId === id; })
    .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }) };
  return persistenceDigest_(value, services);
}

// A future reader supplies these baselines when loading the draft, never at Save time.
// Group tokens cover copy membership/history as well as fields, but not choice labels.
function persistencePreconditions_(state, kind, payload, services) {
  validatePersistenceState_(state);
  var targets = persistenceTargets_(state, kind, payload), result = {};
  ["groups", "choices"].forEach(function (key) {
    result[key] = targets[key].map(function (id) {
      var token = persistenceRecordToken_(state, key, id, services);
      persistenceAssert_(!!token, "Missing baseline record");
      return { id: id, token: token };
    });
  });
  return result;
}

function persistenceCheckPreconditions_(state, request, services) {
  var expected = request.preconditions;
  persistenceShape_(expected, ["groups", "choices"], "record preconditions");
  var targets = persistenceTargets_(state, request.kind, request.payload), conflicts = { groups: [], choices: [] };
  ["groups", "choices"].forEach(function (key) {
    persistenceAssert_(Array.isArray(expected[key]), "Invalid record preconditions");
    var ids = new Set();
    expected[key].forEach(function (item) {
      persistenceShape_(item, ["id", "token"], "record baseline");
      persistenceAssert_(persistenceId_(item.id) && !ids.has(item.id) && typeof item.token === "string"
        && /^[a-f\d]{64}$/.test(item.token), "Invalid or duplicate record baseline");
      ids.add(item.id);
      if (item.token !== persistenceRecordToken_(state, key, item.id, services)) conflicts[key].push(item.id);
    });
    persistenceAssert_(ids.size === targets[key].length && targets[key].every(function (id) { return ids.has(id); }),
      "Preconditions must cover exactly the records being changed");
  });
  if (conflicts.groups.length || conflicts.choices.length) persistenceError_("STALE",
    "A record in this save changed since editing began. Review its latest saved data; keep this draft", conflicts);
}

function preparePersistenceChange_(stored, request, services) {
  validatePersistenceState_(stored);
  var scoped = request && Object.prototype.hasOwnProperty.call(request, "preconditions");
  persistenceShape_(request, ["collectionId", "requestId", "expectedRevision", "kind", "payload"].concat(scoped ? ["preconditions"] : []), "save request");
  persistenceAssert_(request.collectionId === stored.collectionId, "Wrong collection");
  persistenceAssert_(persistenceId_(request.requestId) && Number.isSafeInteger(request.expectedRevision) && request.expectedRevision >= 0, "Invalid request identity/revision");
  var fingerprint = persistenceDigest_(request, services);
  var receipt = stored.receipts.find(function (item) { return item.requestId === request.requestId; });
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) persistenceError_("REQUEST_REUSED", "This request ID was already used for different changes");
    return { state: persistenceClone_(stored), result: persistenceClone_(receipt.result), replayed: true };
  }
  if (request.expectedRevision > stored.revision || (!scoped && request.expectedRevision !== stored.revision)) {
    persistenceError_("STALE", "The collection changed since editing began. Review the latest saved data before retrying; do not discard this draft");
  }
  if (scoped) persistenceCheckPreconditions_(stored, request, services);
  persistenceAssert_(stored.revision < Number.MAX_SAFE_INTEGER, "Revision limit reached");
  var now = services.now();
  persistenceAssert_(persistenceTime_(now), "Invalid server time");
  var next = persistenceClone_(stored), result;
  switch (request.kind) {
    case "saveBatch": result = persistenceSaveBatch_(next, request.payload, services, now); break;
    case "saveGroup": result = persistenceSaveGroup_(next, request.payload, services, now); break;
    case "saveLocations": result = persistenceSaveLocations_(next, request.payload); break;
    case "deleteGroup": result = persistenceDeleteOrRestore_(next, request.payload, false, now); break;
    case "restoreGroup": result = persistenceDeleteOrRestore_(next, request.payload, true, now); break;
    case "restoreCopy": result = persistenceRestoreCopy_(next, request.payload); break;
    case "restoreGroupAndSave": result = persistenceRestoreAndSave_(next, request.payload, services, now); break;
    case "saveChoice": case "removeChoice": case "restoreChoice":
      result = persistenceChoiceChange_(next, request.payload, request.kind, services, now); break;
    default: persistenceError_("INVALID", "Unsupported save operation");
  }
  next.revision++;
  result.revision = next.revision;
  next.receipts.push({ requestId: request.requestId, fingerprint: fingerprint, result: result });
  // Cross-group sticker assignments are checked only after every intended change.
  // Serialization is part of preparation, so no candidate can fail on cell size at commit.
  persistenceTables_(next);
  return { state: next, result: persistenceClone_(result), replayed: false };
}

function projectPersistencePreview_(state) {
  validatePersistenceState_(state);
  var choices = new Map(state.choices.map(function (choice) { return [choice.id, choice]; }));
  function label(id) { return id === "" ? "" : choices.get(id).value; }
  return state.groups.filter(function (group) { return !group.deletedAt; }).map(function (group) {
    var result = { rootId: group.rootId, name: group.name, setNumber: group.setNumber, notes: group.notes };
    PERSISTENCE_FIELDS_.forEach(function (field) { result[field] = label(group[field + "Id"]); });
    result.copies = state.copies.filter(function (copy) { return copy.rootId === group.rootId && !copy.deletedAt; }).map(function (copy) {
      return { id: copy.id, rootId: copy.rootId, miniNumber: copy.miniNumber, sticker: copy.sticker, note: copy.note,
        currentLocation: label(copy.currentLocationId), home: result.home };
    });
    return result;
  });
}

var PERSISTENCE_TABLE_COLUMNS_ = {
  Metadata: ["key", "value"],
  Groups: ["rootId", "name", "sizeId", "creatureTypeId", "sexId", "raceId", "roleId", "homeId", "paintId", "setId", "setNumber", "notes", "deletedAt"],
  Copies: ["id", "rootId", "miniNumber", "sticker", "currentLocationId", "note", "deletedAt", "deletedWithGroup"],
  Lists: ["id", "field", "value", "sortOrder", "home", "removedAt"],
  Stickers: ["sticker", "sortOrder"],
  Requests: ["requestId", "fingerprint", "result", "part"]
};

function persistenceTables_(state) {
  validatePersistenceState_(state);
  var records = {
    Metadata: ["schemaVersion", "collectionId", "revision"].map(function (key) { return { key: key, value: state[key] }; }),
    Groups: state.groups, Copies: state.copies, Lists: state.choices,
    Stickers: state.stickerCatalog.map(function (sticker, index) { return { sticker: sticker, sortOrder: index + 1 }; }),
    Requests: state.receipts.flatMap(function (receipt) {
      var result = JSON.stringify(receipt.result), parts = [], start = 0;
      // One logical receipt can exceed a cell once Save All returns hundreds of IDs.
      while (start < result.length) {
        var end = Math.min(start + 40000, result.length);
        if (end < result.length && /[\uD800-\uDBFF]/.test(result[end - 1])) end--;
        parts.push({ requestId: receipt.requestId, fingerprint: receipt.fingerprint, result: result.slice(start, end), part: parts.length + 1 });
        start = end;
      }
      return parts;
    })
  };
  var tables = {};
  Object.keys(PERSISTENCE_TABLE_COLUMNS_).forEach(function (title) {
    var columns = PERSISTENCE_TABLE_COLUMNS_[title];
    tables[title] = [columns.slice()].concat(records[title].map(function (record) {
      return columns.map(function (key) {
        var value = String(record[key]);
        persistenceAssert_(persistenceText_(value), "Storage cell is too long: " + title + "." + key);
        return value;
      });
    }));
  });
  return tables;
}

function parsePersistenceTables_(tables) {
  persistenceShape_(tables, Object.keys(PERSISTENCE_TABLE_COLUMNS_), "storage tables");
  var records = {};
  Object.keys(PERSISTENCE_TABLE_COLUMNS_).forEach(function (title) {
    var rows = tables[title], columns = PERSISTENCE_TABLE_COLUMNS_[title];
    persistenceAssert_(Array.isArray(rows) && Array.isArray(rows[0]) && rows[0].length === columns.length
      && new Set(rows[0]).size === columns.length && columns.every(function (key) { return rows[0].indexOf(key) >= 0; }), "Invalid " + title + " headers");
    var indexes = columns.map(function (key) { return rows[0].indexOf(key); });
    records[title] = [];
    rows.slice(1).forEach(function (row) {
      persistenceAssert_(Array.isArray(row) && row.length <= columns.length && row.every(persistenceText_), "Invalid " + title + " row");
      if (row.every(function (value) { return value === ""; })) return;
      var record = {};
      columns.forEach(function (key, index) { record[key] = row[indexes[index]] === undefined ? "" : row[indexes[index]]; });
      records[title].push(record);
    });
  });
  var metadata = Object.create(null);
  records.Metadata.forEach(function (record) {
    persistenceAssert_(["schemaVersion", "collectionId", "revision"].indexOf(record.key) >= 0
      && !Object.prototype.hasOwnProperty.call(metadata, record.key), "Invalid metadata key");
    metadata[record.key] = record.value;
  });
  function number(value) {
    persistenceAssert_(typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)), "Invalid stored integer");
    return Number(value);
  }
  var seen = new Set();
  records.Stickers.forEach(function (record) {
    record.sortOrder = number(record.sortOrder);
    persistenceAssert_(record.sortOrder > 0 && !seen.has(record.sortOrder), "Invalid sticker order"); seen.add(record.sortOrder);
  });
  var receiptParts = new Map();
  records.Requests.forEach(function (record) {
    persistenceAssert_(persistenceId_(record.requestId), "Invalid receipt request ID");
    var receipt = receiptParts.get(record.requestId);
    if (!receipt) {
      receipt = { requestId: record.requestId, fingerprint: record.fingerprint, parts: new Map() };
      receiptParts.set(record.requestId, receipt);
    }
    var part = number(record.part);
    persistenceAssert_(part > 0 && !receipt.parts.has(part) && receipt.fingerprint === record.fingerprint && !!record.result,
      "Invalid receipt part");
    receipt.parts.set(part, record.result);
  });
  var receipts = Array.from(receiptParts.values()).map(function (receipt) {
    var parts = [];
    for (var part = 1; part <= receipt.parts.size; part++) {
      persistenceAssert_(receipt.parts.has(part), "Missing receipt part");
      parts.push(receipt.parts.get(part));
    }
    var result;
    try { result = JSON.parse(parts.join("")); } catch (_) { persistenceError_("INVALID", "Invalid stored receipt JSON"); }
    return { requestId: receipt.requestId, fingerprint: receipt.fingerprint, result: result };
  }).sort(function (a, b) { return (a.result && a.result.revision) - (b.result && b.result.revision); });
  var state = { schemaVersion: number(metadata.schemaVersion), collectionId: metadata.collectionId, revision: number(metadata.revision),
    groups: records.Groups, copies: records.Copies,
    choices: records.Lists.map(function (record) {
      persistenceAssert_(["true", "false"].indexOf(record.home) >= 0, "Invalid stored Home eligibility");
      record.home = record.home === "true"; record.sortOrder = number(record.sortOrder); return record;
    }),
    stickerCatalog: records.Stickers.sort(function (a, b) { return a.sortOrder - b.sortOrder; }).map(function (record) { return record.sticker; }),
    receipts: receipts
  };
  return validatePersistenceState_(state);
}
