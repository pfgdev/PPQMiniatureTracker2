// Private, offline-only wire contract. Not uploaded or exposed as an Apps Script RPC.
function persistenceClientSnapshot_(state, services) {
  validatePersistenceState_(state);
  return persistenceClone_({ protocolVersion: 1, schemaVersion: state.schemaVersion,
    collectionId: state.collectionId, revision: state.revision,
    groups: state.groups, copies: state.copies, choices: state.choices, stickerCatalog: state.stickerCatalog,
    tokens: {
      groups: state.groups.map(function (group) { return { id: group.rootId, token: persistenceRecordToken_(state, "groups", group.rootId, services) }; }),
      choices: state.choices.map(function (choice) { return { id: choice.id, token: persistenceRecordToken_(state, "choices", choice.id, services) }; })
    } });
}

function persistenceContractError_(error) {
  var codes = ["DISABLED", "FORBIDDEN", "BUSY", "READ_FAILED", "INVALID", "STALE", "STICKER_CONFLICT", "REQUEST_REUSED", "SAVE_UNCERTAIN"];
  var code = codes.indexOf(error.code) >= 0 ? error.code : "SAVE_UNCERTAIN";
  var result = { ok: false, code: code, message: code === error.code ? error.message : "Save could not be confirmed. Retry the same request." };
  if (code === "STALE" && error.clientSnapshot) {
    result.snapshot = error.clientSnapshot;
    result.conflicts = error.details || { groups: [], choices: [] };
  }
  return result;
}

function persistenceContractSave_(request, config, runtime) {
  try {
    var response = persistenceAdapterExecute_(request, config, runtime, persistenceClientSnapshot_);
    return { ok: true, protocolVersion: 1, collectionId: request.collectionId, requestId: request.requestId,
      result: response.result, replayed: response.replayed, snapshot: response.snapshot };
  } catch (error) { return persistenceContractError_(error); }
}

function persistenceContractLoad_(config, runtime) {
  var lock, acquired = false;
  try {
    persistenceAdapterAuthorize_(config, runtime);
    lock = runtime.lock(); acquired = lock.tryLock(config.lockTimeoutMs);
    if (!acquired) persistenceError_("BUSY", "Another save is in progress. Retry loading the collection.");
    var book;
    try { book = runtime.read(config.spreadsheetId, persistenceAdapterReadOptions_()); }
    catch (_) { persistenceError_("READ_FAILED", "Could not load the collection. Retry loading it."); }
    return { ok: true, snapshot: persistenceClientSnapshot_(persistenceAdapterSnapshot_(book, config).state, runtime.services) };
  } catch (error) { return persistenceContractError_(error); }
  finally { if (acquired) { try { lock.releaseLock(); } catch (_) { /* Execution end also releases the lock. */ } } }
}
