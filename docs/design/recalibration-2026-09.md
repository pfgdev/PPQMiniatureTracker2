# September 2026 Recalibration

## October 9 Live Activation

The owner approved going live after the private save and startup rehearsals.
Production version 4 now uses the real 2.0 workbook with owner-only access.
The migration preserved the full 496-group / 612-copy imported collection,
including 19 away copies and existing blanks; no rehearsal edits were promoted.
Private pre-migration and schema-compatible baseline copies are verified.

The clean bundle retains real save/retry/conflict protection and the fast raw
template loader, but excludes rehearsal UI, browser test hooks, the simulator
and timing reports. Root clasp now uploads generated `.local/live/app` files:
run `node tools/build-live.cjs` before uploading source changes. The historical
preview-only deployment instructions below are superseded.

See [current development instructions](../development.md) and the
[activation record](../rollout-and-rollback.md) for the live URL, exact identities,
backup links and remaining owner-side authorization/save verification.

## Historical Handoff

Reviewed 2026-09-07 against commit `217a0d7` (`Refine detail pane inventory layout`).
The worktree was clean at the start. The initial review changed documentation only;
the follow-up stabilization below implements the confirmed fixes.

This is the current handoff. Earlier design documents preserve useful history,
but their proposed layouts and step numbers sometimes conflict with the accepted UI.

## Current Direction: Main Preview, Isolated Save Rehearsal

**Latest October 9 checkpoint:** The owner confirmed the private read checkpoint
loads 612 miniatures across 496 groups. Version 5 of that separate test app now
connects real saves exclusively to the disposable workbook. The owner completed
write authorization and confirmed the first hosted save survives reload; bounded
Google readback independently verified Archmage's saved note and revision 1.
In the version 7 rehearsal the owner also reports successful Save All, copy
addition/removal, group deletion, list operations and deleted-group restoration.
The owner also confirmed that hosted two-tab conflicts worked great. The manual
whole-workbook rollback procedure is documented but remains untested. The owner
has explicitly removed that rehearsal as a launch requirement: keep a fresh
private workbook copy at rollout and the legacy sheet, with manual recovery/
Google Sheets version history if needed. No backup UI, automation, mandatory
schedule or further recovery-test work is planned. Group notes wrap; only
individual sticker notes marquee. The private app is now version 14 after
separate synthetic probes identified version 10's failure: Google's processed
HTML lost the snapshot comment marker. The fix reads raw template text before
inserting the fresh snapshot and retains the v9 loader as an automatic fallback.
The owner supplied a successful actual-app report: 30 ms page read/build and
1,196 ms server total, versus 1,925 ms template work / 2,603 ms server total in
the previous report. No collection data was restored or changed. Stop this
optimization pass unless normal use reveals another concrete issue; these
observations do not establish full navigation latency or a performance guarantee.
The main app and both original trackers are unchanged; this is not production
activation. See the private rehearsal section below for the test URL and next
engineering step.

**Current performance gate:** Version 6 fixed premature confirmation failure:
the owner confirmed subsequent saves finish without Retry and survive reload.
However, 8-15-second waits are not acceptable. The owner's timing screenshot
isolated 13,622 ms of a 14,317 ms save to the spreadsheet read. Version 7 replaces
the detailed-cell read with fresh metadata plus compact batched values, keeping
all existing validation and save rules. The owner's October 9 manual timing is
now approximately 2-3 seconds to save and 7-8 seconds to load. Save latency has
improved substantially, but startup remains open; do not call the app ready
based on persistence alone or treat these observations as a latency guarantee.
The version 9 hosted load report measured 1,925 ms of 2,603 ms server time in
template evaluation. Spreadsheet reading took 402 ms; browser initialization
took 64 ms. After isolated diagnosis, version 14's raw-template path measured
6 ms page read + 24 ms build, 961 ms sheet read and 127 ms browser initialization.
Fresh reads and save protections remain intact. These figures do not account for
the full outer-page navigation delay. The owner had 18 EverQuest clients running;
that may affect local responsiveness/perceived load, not server-side durations.

**October 8 persistence preparation:** checkpoint `9daab31` (`Add list management
and record completeness workflows`) was committed and pushed. The owner agreed
to start a controlled saving phase. This first slice is an offline rehearsal,
not permission to migrate a workbook or enable writes. The running app and its
preview behavior are unchanged.

**October 9 owner decision: temporary drafts.** Do not add automatic draft
storage in localStorage, sessionStorage, or the spreadsheet. Closing the sidebar
or moving between groups keeps drafts in the current page, as already designed;
Discard removes the editor draft. A fresh reload or leaving/closing the app may
lose unfinished work. Keep the unsaved-changes warning for those exit attempts
instead of introducing draft recovery or silently saving collection changes.
The existing handler covers active/parked miniature drafts, pending copy
locations, and changed list forms. When the live writer is connected, keep
submitted work pending until acknowledgment so an in-flight/failed save is not
prematurely treated as clean. Browser warnings are best effort, not crash or
forced-close protection; see the
[beforeunload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#usage_notes).
This decision does not authorize deletion of saved records or rollback of a
request that has already reached the server.

**October 9 approved direction: pending review and Save All.** The owner approved
a temporary review view using the existing browse table, inspector, and Review
Changes popover. This supersedes the earlier recommendation to leave cross-group
saving out of the first live version. The following implementation is now in the
browser-only preview. The offline save model now supports batches as described
below, but is not connected to this UI.

- Use **Show pending changes**, not an ordinary additive filter checkbox. Entry
  switches to Groups and temporarily sets aside ordinary search/facet/location
  filters so pending work cannot be hidden by the prior browse context.
- Preserve the return context: browse mode, search, filters, sort, selection,
  scroll, and any active Away/Missing Stickers view. Back must return to that
  immediate context, including its own route back to normal browsing. A separate
  `pendingReturn` snapshot preserves that nested return path.
- Change the existing browse heading to **Pending Changes**, shortened to
  **Pending** when constrained. The existing Clear button becomes **Back** in
  this view. Do not add a permanent toolbar row, grow the header, or require
  reopening a popover to exit. The popover also offers Back to previous view.
- Search and facets may narrow the pending view without changing the stored
  return context. **Show all pending** resets this temporary narrowing without
  exiting review. Back instead exits and restores the earlier browse setup.
- Display affected existing groups and new-group drafts, including incomplete
  or zero-copy drafts that cannot yet be saved. Count unique groups, not separate
  overlapping editor/location drafts. The ordinary sidebar remains the place to
  inspect, correct, or discard work; leaving review never discards it.
- Keep **Save All Changes** inside the existing Review Changes popover, alongside
  an explicit scope such as `3 groups total / 1 shown`. Save All includes all
  pending miniature work in this page, regardless of further browse filtering:
  active/parked editor drafts, new groups, and pending copy locations. It must
  never silently switch to saving only visible results. A future visible-only
  action would need the distinct label Save Shown Changes.
- Unfinished list forms are excluded: their Add/Save/Remove actions remain
  independent. Confirmed group deletion and restoration remain explicit actions,
  not changes silently bundled into this save queue. Per-group Save/Create and
  location-only Save remain available alongside Save All.
- Validate the whole batch before applying anything. If any group needs
  attention, show the affected-group count and a Review action, disable Save All,
  and retain every draft. A valid individual group can still be saved separately.
  Do not silently skip invalid groups or partially save the batch.
- Saving one group removes it from pending results while keeping its inspector
  open. Saving the last group leaves an **All changes saved** empty state and
  Back, rather than unexpectedly changing the user's view. Distinguish that from
  no pending results matching a temporary filter. Restoring an earlier browse
  context restores controls, not old data or records that have since been deleted.

**October 9 preview implementation:** Show pending changes and Save All Changes
now live in Review Changes. The pending table projects draft values, marks new
groups, and keeps incomplete or zero-copy drafts discoverable. Search/facets
operate on those proposed values; ordinary browsing still uses applied values.
Save All normalizes each group's metadata/copies and pending locations, validates
the final collection including sticker uniqueness, then applies the whole batch
in memory. This permits a valid sticker swap across two groups without trying to
save either conflicting intermediate state. An invalid group blocks the entire
batch and Review opens its editor at the problem field. Blank and explicit n/a
stickers remain permitted, following existing authoring rules.

Existing Pending locations / Resume drafts shortcuts remain available outside
the pending view; inside it, Show all pending and Back handle review navigation.
Visual follow-up: Review Changes actions now have visible button borders, with a
bold pale-blue review action and forward arrow. Pending Changes also has a square
back-arrow button beside its title, aligned at the same 30px height as the view
toggle and New. The original Back button remains. Four focused browser checks
passed, including unchanged header heights, matching control edges, keyboard
Back, nested returns, and layouts from 320px to 1440px; saving logic is unchanged.
Individual saves remain available. Saved groups disappear from pending results
but keep their inspector, and the final save leaves All changes saved plus Back.
Return snapshots restore controls/scroll, not old data or deleted selections;
list renames update the stored return filters as well as the current filters.

The owner accepted the preview and asked to proceed after one final polish:
Review Changes now shows a single No pending edits status when empty, without
the redundant zero-count sentence, success log, or preview footer. The page-level
preview notice remains. No spreadsheet write endpoint, migration, draft
persistence, Git push, or clasp upload was added or performed for these UI slices.

Verification for the UI slice: the full 99-scenario browser run passed. A final
draft-copy selection fix added a 100th scenario; all 10 pending-review scenarios
plus the affected collection-return and list-rename scenarios passed on rerun.
All 16 imported-data browser checks passed on the final source, including a
two-group batch with preserved legacy blanks and checked-out locations. All 141
unit/import/persistence checks passed. No browser script errors; screenshots
checked at desktop/phone widths and with the imported 612-copy collection.
`git diff --check` passed. Evidence stays in ignored `.local` paths.

Related saving discussion: stale browsing is acceptable; do not force live
refreshes. The offline model can now check affected groups/list choices instead
of rejecting a save solely because an unrelated record changed. Its safe default
blocks same-record conflicts and returns their IDs while preserving inputs.
The eventual latest-data review UI still needs design; explicit overwrite has
not been authorized. Physical writes should target affected records plus revision
and receipt metadata, not blindly replace the collection from browser state.

**October 9 offline batch contract implemented:** `saveBatch` accepts
`payload.changes`, an array of `{ clientKey, kind, payload }` items. Each item is
either `saveGroup` (complete intended group and retained copies) or
`saveLocations` (location-only changes). Each existing group occurs once: merge
editor and staged location edits before submitting, as the preview already does.
New groups use an empty rootId plus a unique clientKey, with server-generated
UUIDs mapped back in the result. Copy client keys are scoped to their group.
List changes, group Delete/Restore, and nested batches are not allowed in Save
All; they keep their independent explicit actions.

- Prepare every item against a clone, then validate the whole final collection.
  A failure returns no candidate, changes no input, and commits no receipt or
  deletion history. Sticker exchanges and releasing/reassigning a removed copy's
  sticker work regardless of operation order. Unchanged legacy blanks remain
  valid; new records still require their fields and a copy.
- A batch advances the collection revision once and creates one logical receipt,
  with `result.changes` carrying each clientKey, rootId, and created-copy mapping.
  The exact request ID/payload is retried after an uncertain response. Receipt
  lookup precedes conflict checking: a committed retry returns its original IDs
  without reverting intervening edits, even after a created group was deleted.
- Optional request `preconditions` contain `groups` and `choices` arrays of
  `{ id, token }`. Tokens are SHA-256 fingerprints of the original loaded record.
  Group tokens include all its copies and deletion/sequence history, but not
  referenced choice labels; a list rename must not invalidate unrelated group
  work. Capture baselines when loading the draft, never by rereading at Save time.
  `persistencePreconditions_` is the service-free helper for the offline tests;
  the future read adapter must expose original baselines to the client.
- Preconditions must cover exactly the affected existing records, including a
  removed choice restored through Add. They apply to single operations too.
  A mismatch returns STALE with affected IDs; unaffected newer records are kept.
  New assignments still validate against the current catalogs/stickers. Without
  preconditions, the older collection-wide revision guard remains conservative.
- The offline candidate schema is now version 2. Requests adds a `part` column:
  large result JSON is split into numbered pieces of at most 40,000 characters,
  without splitting a surrogate pair. These are storage pieces of one receipt,
  not independent commits. Reordered parts are reassembled; gaps, duplicates,
  inconsistent fingerprints, or malformed results are rejected. Preparation also
  checks serializability before returning a candidate. The current preview
  workbook/schema has not changed, and neither offline schema should be pasted
  into it or uploaded through clasp.

Verification for this slice: 109 persistence tests and 74 import/storage checks
passed (183 total), including a local 496-group batch over the existing ignored
import readback and a 350-new-group multipart receipt. Three focused browser
scenarios passed for the menu cleanup, save completion, keyboard navigation,
and narrow layouts. No full browser rerun was needed for the disconnected model.
No live service, lock, physical write, backup, or deployment was exercised.

`Persistence.js` contains a private, service-free save domain model. It is
intentionally excluded by the existing clasp allowlist, is not called by Code.js
or Scripts.html, and exposes no callable write endpoint. Node tests supply time,
UUID generation, and SHA-256 hashing; future Apps Script wrappers must provide
the server equivalents. No client-supplied identity generator is trusted.

Implemented and locally tested:

- A candidate versioned schema with stable UUIDs for list choices and newly
  created groups/copies. Imported group/copy IDs are unchanged. Group-level
  characteristics, Home, Paint, and Set refer to choices by ID; copy Current
  Location refers to the same location catalog, with separate Home eligibility.
  Names/notes remain literal text. Same-name group variants remain valid.
- Migration from the validated imported preview, plus strict header-mapped
  serialization/parsing and an active-record projection back to existing display
  values. Blank source values, n/a, Not specified, alphanumeric Set numbers,
  current locations, and individual notes are preserved. Existing UI-provided
  Not specified choices become explicit list rows; Paint does not gain one.
- Group Save/Create, location-only Save, group Delete/Restore, and list
  Add/Rename/Remove/Restore prepare a separate candidate state. Validation errors
  leave both the prior state and request untouched. Existing missing details do
  not block unrelated repairs; new groups require their explicit choices and
  at least one copy. Empty and n/a stickers are distinct and permitted. Other
  assigned stickers must belong to the stored sticker catalog and be unique
  among active copies, ignoring case/outer whitespace.
- Soft deletion retains records and IDs. Deleted records release stickers.
  Restore validates reuse rather than stealing an assignment. A group deletion
  marks only its currently active copies, so restoring cannot resurrect a copy
  removed earlier. New copy sequence numbers are higher than deleted numbers.
  Discard/Close submits no command and creates no historical deletion record.
- Each request includes collection ID, a request ID, and expected collection
  revision. Requests without record preconditions reject a stale revision;
  record-scoped requests check their original group/choice snapshots instead.
  Successful candidates include a receipt in the same state: retrying the same
  request returns its original result without allocating another ID; reusing its
  request ID for different content rejects. An older successful retry does not
  replace later state. These are pure-model checks, not yet a live concurrency
  guarantee: the adapter still needs locking and an atomic commit.
- Removed catalog values retain their references but cannot be newly assigned.
  Renaming does not rewrite group/copy rows. Re-adding a removed label restores
  its ID. Restoring a choice does not roll back any intervening assignments.

The version-2 candidate tables are Groups, Copies, Lists, Stickers, Metadata, and Requests.
The first three gain reference IDs/deletion metadata. Metadata holds schema
version, collection identity, and revision; Requests holds request fingerprints
and numbered result-receipt pieces, not unsaved drafts. This candidate is **not compatible with
the current preview reader**. Do not paste these tables into 2.0 or use the old
first-import command as a migration. Candidate cells are strings; the future
writer must use explicit literal values, not formula-interpreting input.

Earlier offline-model verification: 67 new persistence scenarios and all 74 existing unit/import
checks passed (141 total). The optional real-data check used the existing ignored
local import readback, not a new live capture: all 612 copies, 496 groups, 19 away
locations, and six incomplete fields survived migration and table round trips.
Checks cover stale saves, lost responses/retries, failure before commit, deletion
and sticker reuse, retired references, reserved choice labels, malformed input,
formula-looking literal text, and reordered headers. No UI source changed in
that isolated slice, so its browser suite was not rerun then. Hosted authorization,
network failures, quotas, backups/restoration, and physical writes are not yet
tested. No Git push, clasp upload, remote backup, or sheet migration was performed
for this new slice.

### October 9: Disabled Transport Adapter

The pending-review button treatment is owner-accepted; no additional UI test is
needed for this backend-only slice. `PersistenceAdapter.js` now implements the
private save transport against injected services. It is excluded from clasp,
not called by Code.js/Storage.js/the UI, and defaults to disabled with blank
destination, collection and owner configuration. No manifest/service/deployment
change, remote read/write, migration, backup or Git/clasp push was performed.

- Check write enable, server-owned configuration and active caller identity
  before any lock/read. Never accept a workbook or identity from the client.
  Blank/unavailable identity fails closed; effective script-owner identity is
  not caller authorization.
- Acquire a script lock; bulk read the six candidate-schema tabs under it.
  Validate literal text cells, exact header names, collection/schema, references
  and receipts. Reordered columns/records and interior blank rows work; formulas,
  typed numbers, extra data columns, merged cells or partial grids fail closed.
- Prepare against that current state, including original record-token checks.
  Resolve physical cells by headers and IDs, not array order. Patch only changed
  cell runs; append new records after existing data. Expand row capacity within
  the same batch when necessary. No row deletion, table rewrite or formatting
  change is part of saving.
- Commit record patches, revision and all receipt parts in ONE Sheets batch.
  Store formula-looking text as literal strings. Replaying a committed request
  returns its original IDs/result without another write, even after later saves.
- Any commit exception or absent acknowledgment is `SAVE_UNCERTAIN`, not evidence
  that nothing was saved. Retain the exact request ID/payload for Retry. Failed
  reads and lock contention do not attempt writes. Release the acquired lock in
  finally; an execution-end release fallback must not turn a confirmed commit
  into a reported failure.

All 222 import/storage/domain/adapter checks passed, including 39 adapter checks.
These exercise failed commits, lost acknowledgments, concurrent/repeated saves,
schema rejection, row/column reorder, literal cells, grid expansion, a 350-new-
group multi-piece receipt, and a simulated 496-group save using the imported
snapshot. The latter preserved all 612 copies, blanks, choice identities and
19 away locations, then recovered a lost response without another write.

The Sheets/Session/Lock bridge is tested with fakes only. Real authorization,
Advanced Sheets service configuration, payload/timeout/quota behavior, direct
spreadsheet-editor races and backup recovery remain untested. Never infer live
safety from these local checks. Receipt history still has no purge/archival
policy; growing storage/read costs need measurement before choosing one.

For the next UI slice, use a simulated transport first. A future public RPC must
return a structured success/error envelope preserving error codes and affected
record IDs; Apps Script failure callbacks must not be assumed to serialize custom
Error properties. A candidate-schema load path must provide stable catalog IDs,
revision and original record tokens. The current deployed label-based preview
reader is not that path. Keep exact in-flight requests separate from editable
drafts, and do not infer new baseline tokens from freshly read records when
resubmitting a stale edit.

The adapter uses the Sheets
[grid-data field mask](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get)
to inspect literal values instead of trusting displayed strings. The
[active-user identity limitations](https://developers.google.com/apps-script/reference/base/session#getActiveUser())
are why a blank identity is rejected and owner-only deployment must still be
verified before activation.

### October 9: Simulated Save UI

Implemented the next approved slice without connecting a real writer:

- `SaveFlow.html` supplies an independent, browser-memory simulated collection
  and retry receipts. All explicit miniature/list/delete/restore actions now
  pass through asynchronous acknowledgment instead of mutating applied UI state
  immediately. Save All is one request for the whole pending set, not the current
  filtered subset. No UI redesign, autosave, local draft backup, server endpoint
  or Google service activation is included.
- Keep an immutable submitted snapshot separate from mutable unrelated drafts.
  Only one unresolved request can commit at a time. Lock the submitted controls
  and destructive draft actions while letting the user browse, Close, navigate
  list categories and edit unrelated drafts. Completion only clears the submitted
  targets and never reopens an inspector that the user closed.
- Show Saving in existing buttons, then Retry or an inline conflict decision.
  Error details sit inline in the inspector, list form, and Review Changes menu
  so a closed sidebar does not strand a failed request. Avoid a persistent success
  log or extra idle-state text. The existing unload warning also covers in-flight
  and unresolved list/delete saves.
- Failures before commit allow Keep Editing, retaining the draft. An exception, malformed
  acknowledgment, timeout or lost reply is uncertain: retain the exact request
  for Retry and do not permit abandoning it as though it definitely failed.
  Receipt replay applies the confirmed result once. A 15-second client timeout
  does not cancel a possible commit; a late reply cannot silently clear a draft.
- A stale response asks **Save Anyway** or **Discard My Changes**, without a
  comparison step or per-field version chooser. Save Anyway applies local edits
  over conflicting saved values while preserving unrelated newer fields, using
  a fresh request and the observed saved baseline. Another intervening change
  requires confirmation again. Discard loads the saved entry and clears its
  draft without saving, advancing the sticker sequence, or creating deletion
  history. In Save All, Discard explicitly names and affects only stale entries;
  other pending groups and unrelated list/miniature drafts survive. Deleting a
  group uses **Delete Anyway** rather than disguising deletion as saving.
  No automatic overwrite, automatic resubmit or forced reload is used.
- The Preview/Demo disclosure contains a collapsed Try save feedback control.
  Outcomes are one-shot (Normal, Connection problem, Lost confirmation, Changed
  in another tab); real records and reload behavior are never changed. This is
  the owner's feedback surface for these otherwise hard-to-trigger states.
  Repeated conflict simulations alternate a single name suffix rather than
  accumulating `(other tab)` labels; legitimate parentheses are untouched.

Important remaining boundary: the deployed simulator uses the current label-based
UI records and mock identities, not the candidate persistence schema. The local
contract integration described below now tests the candidate mapping and response
envelope. The server adapter is still private, disabled and excluded from clasp;
there is no public save RPC or live writer. Do not substitute simulator tokens
for server conflict checks or call this live saving. Durable deleted-record
recovery and preferred sticker sequence handling remain separate gates below.

Conflict-clarity follow-up: 237 unit checks, 19 save-flow browser checks, and
16 imported-data preview checks passed. Desktop/mobile conflict notices were
visually checked. Added coverage for overwrite and explicit discard, location
restoration, Save All discard scope, list/miniature draft isolation, deletion
history protection, and non-accumulating simulation names. The full 100-scenario
browser suite was not rerun for this focused follow-up.

Initial save-flow verification: 235 local unit checks passed; all 100 existing browser regression
scenarios passed across the full run and targeted continuations, plus 16 imported-
data preview checks and 14 new save-flow browser checks. New coverage includes
timeout/malformed acknowledgment, lost-response creation retry, cross-group Save
All failure, parked unrelated drafts, list/deletion failures, overlap/non-overlap
review and a third edit arriving during review. Desktop/mobile screenshots were
inspected, and `git diff --check` passed. Old synchronous test helpers now wait
for a settled save rather than reading state before acknowledgment. The preview
retains its existing tolerance for untouched legacy duplicate stickers during
metadata repair; the stricter imported/candidate storage validation is unchanged.
No Git/clasp push, Google write, migration or deployment was performed.

### October 9: Local Storage Contract Connection

Created local Git checkpoint `2f6b379` of the accepted UI and offline backend before
starting this integration. No Git push or clasp deployment was made.

- `PersistenceContract.js` defines the private load/save envelope. Snapshots pair
  stable catalog/group/copy identities with original record tokens, including
  deleted history. They exclude the internal receipt log. Successful and stale
  responses are built from the locked adapter state; unauthorized requests never
  receive collection records. The writer is still disabled and unconfigured.
- `PersistenceClient.html` translates existing UI targets into saveGroup,
  saveLocations, saveBatch, list and delete/restore requests. It retains original
  per-record baselines instead of advancing unrelated drafts after another save.
  Explicit overwrite uses the observed conflicting baseline and checks again.
  Hidden copy-history changes remain detectable even if visible values match.
- The exact wire request is cached for retries. Validate response identity,
  schema, tokens and new-copy mappings before acknowledging. Replayed receipts
  map draft identities to the same stored IDs; group/copy selection and nested
  return contexts are remapped, not closed or recreated. Request IDs use browser
  cryptographic randomness in this integration path, avoiding cross-tab clashes.
- The existing UI is exercised through an injected local transport using the
  actual adapter and an in-memory workbook. Normal app loads still use the old
  preview/simulator. The new client and contract are excluded from clasp and
  the client is not included in Index; an unexpected candidate snapshot fails
  closed outside the test harness. No schema, workbook, manifest, owner setting,
  authorization, or deployment was changed.
- Candidate reloads already rebuild catalogs with stable identities, removed
  choice metadata, preserved blanks, active copies and ordered sticker catalog.
  At this checkpoint durable recovery controls and preferred sticker persistence
  were still pending. The subsequent reload rehearsal below resolves both and adds an
  explicit restore-and-save path for drafts whose group/copy was deleted elsewhere.

Verification: 263 unit checks passed, including 26 new client/contract checks and
the actual imported 496-group / 612-copy batch rehearsal. Eight new browser
integration checks exercised the actual backend via the fake workbook, including
two browser tabs, reload and lost acknowledgments. Also passed 19 save-feedback
browser checks, 16 imported-preview checks and 21 targeted existing regressions.
The entire 100-scenario legacy browser suite was not rerun in this phase.
No Google service was called. `git diff --check` passed.

### October 9: Reload And Recovery Rehearsal

Implemented the next local-only gate without enabling the actual writer:

- Lists adds **Show removed** and per-choice Restore. The existing compact modal
  remains the sole list manager. Restore preserves identity and never rewinds
  intervening miniature assignments. Save failures are visible even without an
  open Add/Rename form; this also fixes hidden feedback during list Undo.
  Searching no longer rerenders a row on blur and swallows its next action click.
- Review Changes offers **Removed miniatures** only when an archive exists.
  The dialog reuses Manage Lists styling, with Groups/Copies, search and Restore.
  Historical removals do not count as pending edits or light the review indicator.
  Group restore revives only its deletion-time members. Earlier individually
  removed copies remain removed and can be restored separately after the parent.
  Original IDs, copy numbers, locations and notes survive; no new identity is
  manufactured to bypass sticker validation.
- Recovery blocks conflicting pending work on the same group, not unrelated
  drafts. Sticker reuse blocks restoration atomically and shows inline feedback.
  Uncertain responses keep the request for Retry, including if the user changes
  the recovery tab. Known rejection offers Cancel Restore. Session Undo can still
  recover that session's parked editor; reload never recovers unfinished drafts.
  Adopting a remotely restored group also retires the stale session Undo entry,
  so an old deletion cannot later overwrite that restored record.
- Added `restoreCopy` and `restoreGroupAndSave` operations. The latter supports
  explicit **Restore and Save** after a stale edit, including inside Save All.
  Restoration plus edits validate and commit together, with original IDs and
  record tokens. Omitted historical copies remain removed. A duplicate sticker
  rejects the entire candidate, including the restoration.
- Owner confirmed **always the earliest unused catalog ID**, not a remembered
  sequence. If A through F are used except D11, offer D11 until it is assigned,
  even after a later G sticker is entered. This supersedes the initially
  recommended last-saved-sequence policy. Removed that provisional pointer and
  request hint entirely; candidate schema remains **2** and no migration is
  needed for this slice. Existing browser sequence preferences cannot override
  an available catalog, including the imported preview.
- Availability is the ordered catalog minus active assignments and temporary
  draft reservations. Apply fills the first blank retained copy, not the selected
  copy and not a new row. Discard releases draft reservations; only Save makes
  assignments persist. Deleted, blank and n/a copies reserve nothing. Failed
  saves/retries cannot consume codes, and server uniqueness still protects two
  tabs choosing the same suggestion. Availability is scanned locally, not
  fetched per click. There is no automatic history expiry or receipt purge.

Ordinary preview receives session-only recovery controls. Durable reload uses
the offline client/contract and fake workbook exclusively. The clasp allowlist,
disabled adapter configuration, deployment, live reader and spreadsheets remain
unchanged. No push or actual Google save occurred in this phase.

Verification: 277 unit checks passed; 18 local storage-bridge browser checks
covered reload, removal recovery, retries, stale restores and the owner's exact
D11 example. Also passed 19 save-feedback checks, all 100 existing UI scenarios
(initial run plus continuation after scoping the old single-switch test to the
Browse header), and 16 imported-preview checks. Final targeted deletion/Undo
checks passed after stale-history cleanup. Desktop/phone recovery and removed-list
screenshots were inspected. No Google service was called; `git diff --check` passed.

### Saving Phase: Remaining Gates

1. **Pending-review preview accepted.** The temporary view, nested return context,
   global save scope, invalid-draft review, and browser-only batch application are
   implemented and owner-tested. Keep per-group saves, draft-retention boundaries,
   and fixed-height layout when connecting the real transport.
2. **Offline batch contract implemented.** Final-state validation, one logical
   receipt, retry mappings, affected-record conflict checks, and unchanged-input
   failure tests are complete. Explicit UI overwrite now submits a new request
   using the observed baseline; the model continues to reject stale tokens.
3. **Disabled transport adapter implemented locally.** Server-owned destination
   and caller guards, locking, bulk reread, targeted atomic commit and retry
   behavior are tested using fakes (see above). Default configuration is disabled
   and empty. Real service authorization and migration remain later gates, not
   implicit permission to enable this adapter.
4. **Save UI and local contract bridge implemented.** Keep the submitted draft
   until acknowledgment; show Saving in the existing action space, prevent
   repeated submissions, and show failures inline with Retry. An uncertain
   response retries the exact request ID/payload. A stale draft needs an explicit
   overwrite/discard decision, not a forced page reload or silent overwrite. Keep parked
   drafts, pending locations, list forms, and navigation separate. A list change
   commits independently from miniature Save/Discard, as already designed.
   Per the October 9 decision, drafts remain memory-only: preserve exit warnings,
   but do not build reload recovery or automatic draft persistence.
   The browser now rehearses both the simulator and the actual candidate-schema
   contract under local tests. Do not activate a reachable writer or switch the
   deployed reader before the remaining recovery/access/migration gates.
5. **Reload/recovery implemented locally; owner feedback pending.** Catalogs
   rebuild from stored IDs and retirement metadata. Show removed/Restore for
   lists and Removed miniatures for groups/copies survive fake-workbook reloads.
   Next ID always uses the earliest unused catalog entry, per owner confirmation;
   no persistent cursor is needed. Test the recovery controls before live
   activation. No deleted records or receipts expire; archival/purge remains
   a separate deliberate design. Drafts still do not survive reload.
6. **Access audit complete; isolated test setup created with approval.** Read-only API
   inspection on October 9 confirmed the project is bound to the 2.0 workbook.
   Published version 1 allows anonymous access; published version 3 allows any
   signed-in Google user. Neither is owner-only. Remote HEAD and local manifests
   both specify USER_DEPLOYING / ANYONE_ANONYMOUS; the editor-only `/dev` URL
   remains distinct from a published `/exec` endpoint. Recommend a separate
   owner-only test project and private disposable sheet, leaving these existing
   deployments alone. Blank caller identity must fail closed; the script owner's
   identity is not proof of the caller. Original sharing/deployments remain
   unchanged. The separately approved owner-only checkpoint is documented below.
   Owner identity and hosted collection loading now pass: after the read-consent
   fix the owner confirmed 612 miniatures / 496 groups. The isolated writer is
   now on version 14 after diagnosing and fixing version 10's render failure; write consent and
   hosted note/location save/reload now
   pass. Version 6 fixed premature confirmation failure, but its observed speed
   was unacceptable. With version 7 the owner reports approximately 2-3-second
   saves and 7-8-second startup, and has exercised Save All, adding/removing
   copies, deleting groups, lists, deleted-group restoration and two-tab
   conflicts. The startup fix now has a successful real-app timing report;
   no additional broad rehearsal is needed. The
   owner has removed full-workbook recovery rehearsal as a launch requirement.
7. **Lightweight, explicitly approved rollout.** Preserve a fresh private copy
   before migration and a compatible snapshot before the first live save. Use
   the migration already exercised on the disposable collection; reconcile the
   actual destination's records, IDs, locations and blanks. Verify a controlled
   live save/reload. Do not repeat the broad hosted walkthrough, require a full
   backup-restoration rehearsal or add a mandatory backup cadence. Manual
   recovery/version history can be handled if needed, per the owner's decision.
   Preserve the legacy workbook untouched; activation on 2.0 is a separate
   explicit checkpoint, not an accidental consequence of clasp push.

### October 9: Read-Only Access Audit And Test Setup Plan

Verified using Apps Script projects/deployments/content GET requests with the
existing clasp login, and Drive/Sheets metadata reads. Ignored local evidence:
`.local/access-audit.json`; the audit helper emits no credentials. No code was
pushed and no remote file, permission, version, or deployment was changed.

- Project `1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0`
  is bound to the known 2.0 workbook
  `1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY`, not the legacy workbook.
- 2.0 has a sole owner plus an anyone-with-link reader permission. No public
  editor permission was reported. Sheet viewing and app write access are
  separate policies; public readability does not authorize a public writer.
- The four existing tabs remain Groups, Copies, Lists, Stickers. This audit did
  not reread collection cells or assert that their contents equal the old import
  snapshot. Capture and reconcile fresh contents immediately before copying.
- Published version 1, "PPQ Miniature Tracker 2.0 v0.22", uses
  ANYONE_ANONYMOUS / USER_DEPLOYING. Published version 3, "Mini Tracker Version
  0.4", uses ANYONE / USER_DEPLOYING. The unversioned development entry and HEAD
  manifest report ANYONE_ANONYMOUS / USER_DEPLOYING. Do not interpret the API's
  unversioned entry as proof of anonymous `/dev` access; Google's development
  URL is restricted to script editors.
- Uploaded HEAD contains the preview app files, not the offline Persistence
  modules. Code.js and Storage.js hashes match local reader code (allowing line
  ending normalization). The current reader still has no spreadsheet save RPC.

Rehearsal sequence (isolated setup approved and created October 9; see results below):

1. Capture fresh 2.0 metadata and bounded table contents, then make a verified
   backup and a disposable native workbook copy. Verify their IDs differ from
   both original trackers and verify access on the new artifacts is private.
   Do not change the sharing of either existing tracker.
2. Use a separate Apps Script test project and separate local staging/clasp
   configuration. Never repoint this repository's `.clasp.json` or run a regular
   root-directory push to create the rehearsal. A workbook copy can contain a
   copy of its bound script; do not invoke inherited code that still contains
   the original hardcoded sheet ID. The test project explicitly targets only the
   disposable ID and a new collection ID.
3. Generate the candidate schema-2 tables from the fresh captured preview using
   the tested migration. Apply only to the verified disposable destination, then
   reconcile original group/copy IDs, blanks, notes, Set suffixes, current/Home
   locations, and catalog ordering. Do not use the old first-import script to
   overwrite an existing collection.
4. Configure only the test project for owner-only web-app access (`MYSELF`),
   with explicit server-side owner checking and the required Sheets service.
   Start with a read-only identity/load check before allowing test saves. Verify
   the owner's active identity is available in actual hosting; a blank identity
   must be rejected, not replaced by getEffectiveUser(). Test signed-out denial.
5. Enable only the disposable writer after those checks. Exercise Save/reload,
   Create, locations, lists, Save All, stale two-tab edits, lost confirmations,
   deletion/recovery, and earliest-unused-sticker behavior through the actual app.
6. Originally proposed a full backup-restore rehearsal; the owner subsequently
   removed that requirement. Keep a fresh private copy for rollout and handle
   recovery if needed. Real collection writes remain a separate approval.

Google documents the [deployment access values](https://developers.google.com/apps-script/manifest/web-app-api-executable),
[editor-only development URLs](https://developers.google.com/apps-script/guides/web),
[active versus effective user identity](https://developers.google.com/apps-script/reference/base/session),
and [copied bound scripts](https://developers.google.com/apps-script/guides/bound).

### October 9: Private Rehearsal Setup Created

Owner explicitly approved a disposable private workbook and separate owner-only
test app. No production activation was approved or performed.

- [Untouched fresh backup](https://docs.google.com/spreadsheets/d/1FAcy02zXjhRcqrDS2-uFgGX8ovNyDjrRHJ5A1Ds0FGk/edit?usp=drivesdk):
  `1FAcy02zXjhRcqrDS2-uFgGX8ovNyDjrRHJ5A1Ds0FGk`.
- [Disposable schema-2 test workbook](https://docs.google.com/spreadsheets/d/1wa-y9lifHvSZOdu0MYRsCI4Kr9OtTs9WAWwssxpc2vM/edit?usp=drivesdk):
  `1wa-y9lifHvSZOdu0MYRsCI4Kr9OtTs9WAWwssxpc2vM`.
- Both native workbook copies are in the new private `ChatGPT` folder,
  `1JSy_YESqk_dxjBGiqEYsv8oiYg0jamfM`. Drive permission readback shows only
  `pmfeller@gmail.com` as owner on the folder, both copies, and the test project.
- [Separate standalone Apps Script project](https://script.google.com/d/1Fu9VO9NnxxADvV-A1-bcq-lbppf7IVjGMCjtalJPbD_8GsKjm48ScJQM/edit?usp=drivesdk):
  `1Fu9VO9NnxxADvV-A1-bcq-lbppf7IVjGMCjtalJPbD_8GsKjm48ScJQM`.
- [Owner-only rehearsal app](https://script.google.com/macros/s/AKfycbz_sNEYSuoP8Q83B5UUrZKXSP30mAs8oG_1ATe53DlQjHogqAELdFVW_YMCT5jrGwIX3Q/exec):
  versions 1-4 were read-only; version 5 enabled disposable-only saves, and version
  6 adds confirmation handling, and version 7 replaces the slow read path. API readback
  confirms `MYSELF` / `USER_DEPLOYING`.

Fresh bounded CellData captures of all four source tables matched both copies
exactly before migration. Only the disposable copy was converted, using the
existing tested schema-2 migration. Live readback parsed through the actual
adapter and matched the candidate state exactly, including IDs, blank fields,
notes, Set suffixes, stickers, Home/current locations, and catalog ordering.
Totals: 496 groups, 612 copies, 19 away, 555 assigned stickers, 57 n/a stickers,
zero blank stickers, 900 catalog codes; earliest unused is F55. The disposable
collection has its own UUID, revision 0, and an empty Requests table. Source and
backup cells were read again after setup and remained unchanged.

Backup scope clarification (October 9): this is a private pre-migration native
workbook copy in the older four-tab format. It is not an automatic backup system
or an in-app full-collection restore feature. Deleted-group/copy restoration is
a separate implemented feature. A manual rollback procedure for the current
storage format still needs definition and a disposable-destination rehearsal;
do not describe it as an existing feature the owner must test. The initial
migration helper is not a repeatable reset/restore tool. Preserve current test
work and evidence, and take a compatible fresh backup before any future rollout.

The initial read checkpoint used the candidate schema loader and snapshot-to-UI mapper, but
**not the live save transport**. Its manifest requests only spreadsheet read
access and the caller's email. Its only public server function is `doGet`;
default writer config is still disabled, and the checkpoint runtime rejects
commits. Blank/non-owner caller identities and a mismatched script ID fail before
reading collection data. The app says `Rehearsal: saving is off`; its normal
editing controls still apply only browser-session changes that reset on reload.
No inherited bound script in either copied workbook was invoked.

Verification completed:

- New app source readback matches its separate staging files. Root `.clasp.json`,
  original remote HEAD content hashes, and original deployments are unchanged.
- Signed-out HTTP access redirects to Google sign-in (302), not collection HTML.
- Local checkpoint tests cover blank/wrong caller denial, wrong project denial,
  schema load, disabled commits, no public save RPC, and safe JSON embedding.
- Local Chrome renders all 496 groups from the actual migrated readback, with
  the rehearsal label and owner notice; temporary editing resets on reload.
  No page errors. Desktop screenshot inspected after the sidebar animation.
- Six storage tabs retain frozen header rows, literal-text values and matching
  header styling. Native-table metadata probe shows plain ranges, no tables to
  repair. Google-native sheet rendering was unavailable; formatting was checked
  through CellData, not claimed as a visual browser inspection.

Ignored artifacts and setup helpers are under `.local/rehearsal/`, including
captures, migration plan, candidate state, readback, project/deployment metadata,
and `final-verification.json`. The separate clasp staging directory is
`.local/rehearsal/app/`. Do not run a root `clasp push` to update this test app.
Do not rerun `prepare.cjs` or replay the initial migration after test saves: it
generates new choice/collection UUIDs and is a one-time setup, not a reset tool.
No Git commit/push was performed for this setup.

**Hosted check follow-up:** The owner opened the test app and confirmed that
owner access passed, but collection loading returned `READ_FAILED`. Version 2
added bounded, HTML-escaped, token-redacted Google error text only after the owner
guard. The returned detail specifically reported missing
`https://www.googleapis.com/auth/spreadsheets.readonly` permission. This scope was
already present in the deployed manifest; the effective runtime grant was missing.
Do not infer corrupt data, a wrong destination, or a need for write permission
from that error. The reason the initial read grant was absent is not established.

Versions 3/4 add `ScriptApp.getAuthorizationInfo(FULL, [readOnlySheetsScope])`
before any collection read. Missing consent now produces an `Allow read access`
button using Google's authorization URL, without widening scopes, resetting any
other app's authorization, or adding a save endpoint. The same test URL is used.
Local tests verify no read/commit occurs without consent, denial before consent
checks for non-owners, escaped diagnostic content, and normal loading after the
stubbed grant. Actual grant completion and successful hosted loading still need
the owner's browser. Google's [scope-handling guidance](https://developers.google.com/apps-script/concepts/scopes)
and [AuthorizationInfo API](https://developers.google.com/apps-script/reference/script/authorization-info)
describe this consent check and authorization link.

**Read checkpoint completed:** The owner granted read access and confirmed
612 miniatures across 496 groups. No migration or data repair was needed.

**Version 5 writer checkpoint:** The same private test URL now uses the real
`google.script.run` bridge and `saveRehearsalChanges` wrapper. Its trusted
configuration names only the disposable workbook and its collection UUID.
Active-owner and project checks run before load/save, and commit rechecks the
destination and enable flag. The manifest remains `MYSELF / USER_DEPLOYING`,
with Sheets editing and caller-email scopes. Missing write consent shows
`Allow test saves`; the page explains that Google's permission is broad while
this app is configured to write only to the test copy. No write happens on load.

The generated UI says `Rehearsal: saves to test copy`, removes fake-outcome
controls, and uses actual saved snapshots after reload. It fails closed if its
transport/snapshot is unavailable. Version 5 originally timed out after 15
seconds; version 6 replaces this behavior as described below. The exact request
is retained for Retry; a late callback cannot mark another request saved.
Drafts remain memory-only. Main preview source/manifest/clasp targeting
and the original remote app have not been changed for this activation.

Reusable templates and the staging builder now live in `tools/rehearsal/`, with
tests in `tests/rehearsal.test.cjs` and `tests/rehearsal-browser.cjs`. Actual setup
IDs and deployment helpers remain ignored under `.local/rehearsal/`. The older
local `check.cjs` belongs to the read-only checkpoint, not the writer stage.
Before deployment, Google reads confirmed private owner-only test-sheet access,
revision 0 and no receipts. Deployment readback verified version 5 and owner-only
access. A stale local version-2 verification receipt was reconciled against the
unchanged remote version 4 and its matching HEAD before deployment; no remote
unpublished edits were overwritten.
Google's immediate post-update GET also returned version 4 after the version-5
PUT succeeded. A later read confirmed version 5. The local deployment helper now
checks the expected version/description with bounded read-only polling instead
of marking an older response verified or creating another deployment version.

Verification: all 289 unit checks and 11 new browser checks passed. These use
fake Google services with the actual generated wrapper, contract and adapter;
they cover save/reload, Save All, creation/stickers, independent list changes,
removal/restore, conflicts, missing transport, and lost-response replay. The
authorization page and editor screenshots were inspected locally. These tests
do not prove a Google-hosted save or substitute for the owner's write consent.

**First hosted save passed:** The owner authorized test saves, edited Archmage's
Notes, waited for Saving to finish and confirmed the added text remained after
reload. Bounded Google readback of the disposable workbook independently found
`002-ARC` / Archmage in `Groups!A3:M3`, with the Notes cell containing exactly
`Kind-of looks like Gargamel\nRehearsal save test`. Metadata reports revision 1;
Requests contains a receipt for that group at revision 1 with no created copies.
This verifies a real hosted group save and fresh load, not every save path.

**TODO before live rollout: preserve multiline group Notes in read mode.** The
owner noticed the line break collapsed immediately after Save and after reload.
The stored cell still contains its newline, so this is display-only, not data
loss. `renderReadValue(..., { marquee: true, className: "mini-v2-note-body" })`
renders it inside the shared marquee; both the note body and marquee children
use `white-space: nowrap`. Decide the group-note multiline treatment without
changing copy-note rows, titles, Set/Home marquee behavior, or table geometry.
Add coverage for immediate post-save display, reload, reopening Edit with the
original newlines, long lines and reduced motion. The owner explicitly deferred
this polish during rehearsal; no UI or deployed source changed in this follow-up.

**Location rehearsal exposed a confirmation problem:** The owner confirmed
location changes and Set All Home survived reload, but several saves reported
unconfirmed until Retry. Reloading was also slow. This is not accepted as normal
Google slowness. The original 15-second bridge and UI watchdogs could abandon a
successful response. Snapshot generation also performed 704 native
`Utilities.computeDigest` calls (496 groups + 208 choices) per load/save on the
imported baseline, plus request/precondition hashes during a save. The snapshot
is about 484 KB. The relative hosted costs remain unmeasured: the clasp login
cannot read Apps Script process durations with its existing scopes (403), and no
additional account permission was requested.

**Version 6 fix, disposable app only:** The UI now owns one 90-second confirmation
watchdog for this real transport. After 15 seconds it says Still saving, keeps
submitted fields protected, and permits browsing/unrelated drafts. A slow reply
can still finish without Retry; a truly missing response retains the same
request for Retry after the watchdog. Old late responses cannot undo a later
acknowledged save. Ordinary preview keeps its existing simulated timing.
`tools/rehearsal/Hash.js` computes identical SHA-256 fingerprints in V8 rather
than making a Utilities call per record. Tests cover standard vectors, block
boundaries, Unicode/unpaired surrogates, a million-byte vector, all 704 imported
tokens and replay of a request committed using the previous hashing path. No
schema, stored token, or receipt migration is necessary. Native UUID generation,
server owner checks, fresh reads, locking and atomic commits are unchanged.
Server logs now record load/save total, Sheets read/write and hash timings only;
save responses also log those metrics in the browser console, not in the UI.
They contain no collection contents or credentials. No app save or sheet reset
was invoked during this fix. Deployment readback confirmed version 6 and MYSELF.

Verification: 295 unit checks, 13 rehearsal-browser checks, 19 save-flow checks
and 18 persistence-bridge checks passed. New browser checks explicitly advance
the 15/90-second timers, permit navigation while a reply is delayed, and verify
Retry idempotency plus harmless obsolete replies. Hosted improvement is not yet
verified; a longer timeout alone is not the performance acceptance criterion.

**Hosted version-6 feedback:** Load took roughly 10-15 seconds; a location save
took about eight seconds and Set All Home longer, reaching Still saving before
confirmation. Both survived reload without Retry. The owner correctly rejected
this latency as unsuitable for routine use. Their expanded timing screenshot
reported `readMs: 13622`, `writeMs: 378`, `hashMs: 43`, `hashCalls: 706`,
`totalMs: 14317`, `outcome: ok`, `replayed: false`. Read accounted for about 95%
of that server time. The confirmation payload is still about 484 KB, but making
it smaller is not the primary remedy for this measured bottleneck. An initially
proposed in-app timing-copy UI was not implemented after the screenshot supplied
the needed evidence.

**Version 7, compact fresh reader:** `tools/rehearsal/Read.js` replaces only the
isolated runtime's read dependency. It reads current tab IDs/grid dimensions and
merges without grid data, then uses one `Values.batchGet` with `FORMULA` rendering
for the six bounded storage grids. Values are reconstructed into the existing
adapter input; the schema parser, validation, lock, targeted writes, receipts,
conflict checks and full response format are unchanged. No caching or trusting
client-held data was introduced. Both load and save use this reader.

Native value types remain intact so numbers/booleans still fail storage checks.
Because literal notes beginning with `=` and real formulas are ambiguous in a
values response, those cells receive a targeted typed-cell probe in batches of
at most 100. Actual formulas remain rejected; literal formula-looking notes
remain literal. Missing/changed probe cells fail closed. Extra columns, reordered
headers/rows, missing/duplicate sheets, wrong destinations and merges are tested.
Google documents [batch value reads](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet)
and [formula rendering](https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueRenderOption).

A fresh read-only capture of all six disposable tables was reconciled through
both readers: identical state and physical write layouts, including 496 groups,
612 copies, the multiline Archmage note and five save receipts. No reset/migration
or app save was performed during this work. The connector capture took 1.3 s,
but that is not an Apps Script timing. A separate direct-REST benchmark using
clasp's credentials was unavailable because Sheets API is disabled for that
OAuth client project; no account/project settings were changed to work around it.
The new save timing report adds `readMethod: values-batch`, `metadataMs`,
`valuesMs` and `formulaCheckMs`. No new permission or diagnostic UI is needed.
All 321 unit tests and 13 rehearsal browser checks passed. Version 7 deployment
readback is owner-only.

**Version 7 owner feedback (October 9):** By manual counting, the page loaded in
approximately 7-8 seconds and a save finished in 2-3 seconds. This is an observed
improvement, not a controlled benchmark or a new server timing trace. The latest
report did not separately confirm a post-save reload; earlier hosted persistence
checks remain valid. No further code or deployment change was made in response
to this timing report.

**Further owner testing (October 9):** The owner reports Save All, adding copies,
removing copies, deleting groups, list operations and restoring a deleted test
group all looked good. Mark these as passed in the owner-run hosted rehearsal.
The owner subsequently confirmed that two-tab conflicts also worked great;
mark that hosted check as passed rather than requesting a repeat. Do not ask for
another broad walkthrough of the same flows. The report does not enumerate every
list operation, reload after each action or new-group creation; resolve any
remaining coverage through targeted checks. Restoring
a deleted group exercises in-app recovery, not whole-workbook backup recovery.
No new deployment or spreadsheet mutation accompanied recording this feedback.

**Version 8, notes and startup instrumentation:** Deployed only to the private
owner-only app. Multiline group notes retain authored line breaks and blank
lines. Each overflowing line uses the established marquee; short lines stay
still. Single-line notes retain their exact prior layout, reduced motion remains
respected, and no data rewrite was needed. This supersedes the deferred notes
display bug. The normal app's remote content/deployments remain unchanged.

Server load timing now covers owner authorization, consent, collection load,
serialization and full template evaluation, with nested include authorization
and file-read costs. No authorization check was removed. The report is appended
after evaluation using [HtmlOutput.append](https://developers.google.com/apps-script/reference/html/html-output#appendaddedcontent).
Startup diagnostics are inlined into the template at build time so they do not
add a server asset read or a Google RPC. Browser timings measure initialization,
two animation frames and available iframe navigation entries; they do not claim
to capture Google's outer page or end-to-end address-bar navigation. Timing
categories overlap and must not be summed into a purported total.

The existing Rehearsal notice has **Copy load timing**, with selectable text as
a fallback when clipboard permissions deny access. It adds no permanent banner
row, permission scope or public RPC. Reports contain timings only, no record
contents, collection IDs, owner email or credentials. A local network-blocked
headless run of the full 496-group / 612-copy snapshot took 49-94 ms to initialize
and 84-141 ms to reach two animation frames. This is a local browser baseline,
not a hosted benchmark or proof that startup is solved.

Verification: 323 unit tests, 15 isolated rehearsal browser checks and four
focused preview checks passed. The latter cover text escaping, shared/copy edits,
unchanged single-line marquee geometry, and multiline/blank/CRLF notes at desktop
and phone sizes. Screenshots were reviewed. Remote version 8 readback is owner-only;
original content, original deployments and root clasp target remain unchanged.
No spreadsheet writes, reset, restore, Git commit or Git push accompanied this work.

**Version 9, group-note correction:** The owner clarified that group notes have
room to grow downward and must not marquee, even line by line. They now use plain
escaped text with `white-space: pre-wrap` and `overflow-wrap: anywhere`, preserving
authored breaks and blank lines while wrapping long prose and unbroken strings.
Individual sticker notes retain the established single-line marquee. The version
8 per-line group marquee is removed. No storage or startup behavior changed.
Fifteen rehearsal browser checks and four focused preview checks passed;
desktop/mobile screenshots were inspected. Deployed to the private test app only.

**Version 9 hosted timing and notes acceptance:** The owner accepted group-note
wrapping. Their copied timing report (recorded in ignored local evidence) measured
2,603 ms server total: 666 ms collection load, including 402 ms spreadsheet reads
and 61 ms hashing; 2 ms JSON serialization; 1,925 ms template evaluation.
Initial authorization/consent took 3/4 ms. Includes within template evaluation
took only 9 ms authorization and 11 ms file reads. Browser initialization took
64 ms and two animation frames 112 ms. The largest measured cost is template
evaluation, approximately 74% of server time, not record reading or UI rendering.
Do not add nested timings or mistake the iframe's 2/5 ms navigation entries for
full-page loading. The unmeasured outer navigation remains a possible extra cost.

**Version 10, static page assembly:** The rehearsal builder inlines all five
static assets in their original order, with one live JSON slot. After the same
owner/consent and fresh-data validation, the server reads that static page and
inserts script-safe JSON using concatenation. No template evaluation, collection
cache, extra RPC or scope is introduced. Missing/duplicate slots or an unreadable
page fail closed without returning collection contents. Save behavior is unchanged.
Google's [static HTML output](https://developers.google.com/apps-script/reference/html/html-service#createhtmloutputfromfilefilename)
and [setContent](https://developers.google.com/apps-script/reference/html/html-output#setcontentcontent)
support this path without [HtmlTemplate.evaluate](https://developers.google.com/apps-script/guides/html/templates).
The new report uses `renderMethod: static-html`, `pageReadMs` and `pageBuildMs`;
the previous `templateMs` and include timings are no longer on the successful path.

Verification: 328 unit tests and 16 rehearsal browser checks passed. Expanding
the previous version 9 template locally with the 496-group / 612-copy snapshot
produces byte-for-byte identical HTML to the new static path (791,774 bytes,
excluding the separately appended timing report). Literal script/slot/replacement
text round-trips without execution or corruption. A network-blocked local browser
run still initialized in 49-94 ms. Remote version 10 readback is owner-only;
original source, deployments and root clasp target are unchanged. No workbook
write/reset, Git commit or Git push was performed. Actual hosted improvement is
not yet verified and cannot be inferred from the local tests.

**Version 10 hosted failure and rollback:** The owner received `RENDER_FAILED`.
The read succeeded, then snapshot serialization, static-file reading, slot
validation or HTML construction threw. The catch discarded the exception, so
the exact cause is unknown; do not assert Google removed a marker or rejected
specific data without evidence. HtmlService fakes and byte-equivalent local HTML
did not establish compatibility with Google's runtime.

Restored the same private deployment to published version 9 and restored its
remote HEAD. Reverted only the assistant's static-render code; all 13 locally
generated app files now match published version 9 by normalized hash. The accepted
notes wrapping and startup diagnostics remain. Failed version 10 source and its
deployment metadata are preserved in ignored evidence. All 325 unit tests and
16 rehearsal browser checks passed on the restored path, including retained
script-like-note round trips. Remote readback confirms version 9, owner-only access,
and unchanged original app content/deployments/root clasp target. No spreadsheet
write/reset/data rollback, Git commit or Git push occurred. This is a code rollback,
not the as-yet-untested full-workbook recovery procedure.

**Rollback confirmed (October 9):** The owner reports that the restored app
reloads successfully. This is not a new timing measurement, and no repeat of the
previously passed functional rehearsal is needed. Before another optimization,
use a separate owner-only, non-writing hosted render probe with safe stage-specific
diagnostics; keep the normal loader on the known working path. Do not expose
record contents or complete HTML in diagnostics. Startup improvement remains
unresolved. Hosted two-tab conflicts are owner-confirmed and need no repeat.

**Synthetic startup diagnostic (versions 11/12):** The owner approved following
through on the failed optimization. A separate owner-only deployment tests only
HTML construction, with synthetic data at collection-like size and no server-side
collection services or save RPC. The main rehearsal URL and remote HEAD stay on 9.
The first hosted report identifies failure at `embed-snapshot`: the raw file has
one marker, but the processed `HtmlOutput` has zero. The baseline template takes
317 ms initially / 302 ms repeated; raw-read plus output creation takes 35 ms,
and a single-print template 31 ms. Output differs from unprocessed source even
for the baseline, so do not equate construction success with UI equivalence.
Version 12 adds exact comparison against the working output and a smaller-change
manual assembly of the existing include slots. Version 13 proves that all three
alternatives differ only by five extra newlines after closed script/style tags,
outside code, styles and embedded data. These times
exclude collection reads, Google outer navigation and browser rendering. No
collection caching, writes, reset, schema changes or production activation.

**Version 14 implemented and hosted-confirmed:** Use `getRawContent` to read the
assembled FastIndex before inserting the serialized fresh snapshot; only then
call `createHtmlOutput`. Retain the original v9 Index/includes path as automatic
fallback, with safe stage-only diagnostics. No marker search on processed HTML.
344 automated tests and 16 rehearsal browser checks pass, including fallback and
normal save/conflict flows. Existing UI/save/read assets remain identical to v9;
the fast asset matches the hosted synthetic probe. Private deployment and HEAD
are version 14; the separate non-writing probe stays on 13. Root app/deployments
and original sheets unchanged. The owner's actual-app timing reports success:
1,196 ms server total, 961 ms sheet read, 6 ms page read, 24 ms page construction,
127 ms browser ready and 226 ms first frames. This completes the requested
follow-through; keep fresh reads instead of risking stale data for more speed.

The [rollout and rollback procedure](../rollout-and-rollback.md) documents the
separate operational preparation: compatible six-tab backups, stopping writers,
restoring to a new destination and rejecting pre-restore browser requests. It
has not been executed against Google and is now optional reference material,
not a launch requirement. No recovery rehearsal or backup UI is planned. Keep a
fresh private workbook copy at rollout. Main 2.0 activation remains a
separate explicit checkpoint; no root clasp push is needed for the private app.

Implementation references: Google's
[script lock documentation](https://developers.google.com/apps-script/reference/lock/lock-service)
supports serializing executions of this script; it does not lock out direct
spreadsheet edits or another script project. The Sheets API's
[batchUpdate contract](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
applies a validated batch atomically, but is not an optimistic concurrency check
against arbitrary outside editors. Storage tabs therefore need a controlled
write path, plus protection/validation for out-of-band edits. Google's
[web-app manifest reference](https://developers.google.com/apps-script/manifest/web-app-api-executable)
defines MYSELF versus anonymous access. Deployment/access verification remains
a go-live gate, not something inferred from a successful local test.

**October 8 follow-up: Manage Lists prototype.** The owner approved a restrained
in-app dialog, consistent with the existing UI. A compact Lists button sits beside
Dashboard (inside Collection at narrow widths). Following owner feedback, both
have visible button boundaries: Lists is enabled and Dashboard/Soon is muted and
disabled. Both retain 32px height without growing the 56px summary row.
The native modal retains the
underlying editor, selection, and scroll; it has its own scrolling content,
keyboard focus containment, Escape/Done dismissal, and reduced-motion support.
It does not shift the page or change the inspector layout. At narrow desktop
widths the summary uses the existing shorter collection-count wording to fit.

- All editable catalogs are available: Size, Creature Type, Race, Sex, Role, Set,
  Paint, and Locations. A navigation rail becomes one list selector on mobile.
  Search, Add, Rename/Edit, and Remove stay in the same dialog, without nested
  popups. Long names wrap within its list, not the main app's fixed-height cells.
  Usage counts now share the main line at desktop dialog widths: ordinary rows
  are about 44px rather than 64px tall. Location eligibility remains secondary
  text, and phone layouts retain stacked metadata instead of squeezing controls.
- Explicit list Add/Save/Remove is independent of the miniature draft. Added
  choices appear immediately in dropdowns but are not automatically selected.
  Discarding miniature changes does not discard applied catalog changes.
  Done/Escape retains unfinished list form text without applying it; its Cancel
  discards that text. All catalog changes remain browser-only and reset on reload.
- Renaming relabels saved assignments, parked/active drafts and their baselines,
  pending locations, active filters, and deletion Undo records. It does not change
  miniature IDs, rewrite notes, merge groups, or create a dirty miniature draft.
  Case-insensitive duplicate names and app-reserved values are rejected.
- Removal consistently says Remove choice, including its confirmation button.
  The explanation distinguishes removing a future choice from clearing existing
  assignments: those remain valid and filterable. Once no saved miniature uses a
  removed choice, it disappears from filters. An already-active criterion stays
  visible until cleared, rather than silently changing the user's search. This
  rule also applies to removed Home/current locations.
  Removal has Undo; re-adding a removed name restores it instead of duplicating it.
  Restore only re-enables a choice: it never reverts miniature fields or locations
  changed since the removal. The owner explicitly confirmed this distinction.
  Built-in n/a and Not specified choices are protected. Paint still does not offer
  either of those sentinel values, but ordinary named statuses are data-driven.
- Locations have shared names and a separate Also offer as a Home location flag.
  New locations default to current-location-only. Home eligibility cannot be
  removed while referenced, and a rename updates both Home/current references.

Accepted future recovery direction: session Undo plus a Show removed / Restore
path when persistent catalogs are implemented, without an automatic expiration.
That recovery UI/storage is now implemented in the local reload rehearsal above.
Preview Undo has no timer and survives closing Lists, but all preview list
changes/history still reset on reload until real saving is deliberately enabled.

This is a UX/behavior preview, not the durable catalog implementation. Catalog
identifiers in this dialog are session-local; persistent catalog IDs, reference
migration, concurrency validation, and write endpoints remain future work.
No spreadsheet, schema, deployment, Git checkpoint, or permissions were changed
by this follow-up. Await owner feedback on the dialog before committing to more UI.

Verification: all 79 Chrome UI scenarios, 74 unit/import tests, and 13 real-data
preview checks passed. Five focused list scenarios were rerun after refining
removal-history cleanup and keyboard focus during Undo. Desktop/phone screenshots
were reviewed with the actual long Set names. Checks include fixed dialog/page
geometry, short windows, focus containment, reduced motion, preserved drafts,
reference relabeling, hidden-choice recovery, and reload restoring the original
612 copies / 496 groups. `git diff --check` passed. Hosting and real writes were
not tested or enabled.

Feedback-polish verification: 19 affected Chrome UI scenarios passed, including
two new removal/reassignment/restore checks (81 scenarios now exist in the suite).
All 74 unit/import tests and 13 real-data checks also passed. Header tests verify
visible button boundaries, enabled/disabled distinction, 32px controls, unchanged
56px summary height, and large counts through desktop/mobile breakpoints.
Desktop and phone screenshots were reviewed. No Git push or clasp upload occurred.

**Long-title layout follow-up:** the imported Paladin name exposed an implicit
minimum-content grid width that expanded the whole inspector, not just its
header. The detail stage now has an explicitly shrinkable column and header.
Read-mode names reuse the existing marquee: pause two seconds, travel slowly,
pause two seconds, reset. Names keep their original font and never ellipsize;
Edit/Close and status badges retain their own space. The full name is also in
the tooltip and DOM text. Resizing remeasures the marquee; Edit/close cancels it,
and reduced-motion preference keeps it stationary. Editable names remain normal
inputs with unclipped focus rings. No data or persistence behavior changes.

Verification for this layout follow-up: all 83 Chrome UI scenarios, 74 unit/import
tests, and 14 imported-data checks passed, including the exact Paladin entry from
the owner's screenshot. Checks cover compact list rows, long names, unchanged
header/button geometry, preserved font size, resize remeasurement, Edit/Discard,
close/reopen, reduced motion, and the two-second-pause/reset timing. Screenshots
were reviewed at desktop and phone sizes. No Git push or clasp upload occurred.

**Completeness indicator follow-up:** Ready and the missing-field-count pills
are replaced by a fixed 24px green check or amber exclamation mark. These now mean
group record completeness, including stickers (see Record Status below), not
whether changes are saved or copies are at Home. Hover,
keyboard focus, or tap reveals an explanation; missing fields are named there
rather than counted in the header. Escape, a second activation, or clicking
outside dismisses it without closing the inspector. It is hoverable and stays
inside the viewport without affecting layout. Changing groups, entering Edit,
opening Lists, scrolling, or resizing clears stale explanations.
Unsaved remains separate; New/Editing states and all validation rules remain
unchanged. Both icons reserve identical space, retaining the long-title marquee
and the header's existing height and action-button positions.

Verification: all 85 Chrome UI scenarios, 74 unit/import tests, and 14 local
imported-data checks passed. Added coverage includes invariant 24px icon/header
geometry at desktop/phone widths, hoverable explanations, keyboard focus/Escape,
real touch taps, viewport containment, and preservation of pending edits and
selection. Desktop/phone screenshots were reviewed. `git diff --check` passed;
no Git push, clasp upload, or spreadsheet write occurred.

**Blank-value display follow-up:** the owner caught Quickling's blank Race being
shown as n/a while Edit and the completeness indicator correctly retained a blank.
Read-only shared fields and browse metadata now show Not entered in restrained
amber for empty/null/whitespace values. This is a display label, not a catalog
choice or a value written back to the record. Explicit n/a and Not specified keep
their existing meanings and ordinary styling. Optional notes are not warnings.
Home and Set no longer substitute Not specified/n/a for missing values; a named
Set with no number explicitly says (# not entered). A number without a Set stays
visible alongside Not entered rather than being lost or presented as complete.
Categorical filters and Race/Sex/Role sorting use actual values rather than a
synthetic n/a. Whitespace-only values do not create empty facet/Set choices.
Editing, draft retention, save rules, and spreadsheet contents are unchanged.

Verification: all 87 Chrome UI scenarios, 74 unit/import tests, and 14 local
imported-data checks passed. Coverage includes blank/null/whitespace fields,
explicit sentinel choices, filter/sort separation in both browse modes, optional
notes, retained Set numbers, Edit/Discard and Save round trips, unchanged card
geometry, and the actual Quickling record. Desktop and phone screenshots were
reviewed. `git diff --check` passed. No Git push or clasp upload occurred.

**Record Status follow-up:** More now contains a separate Complete/Incomplete
section after Stickers, using the same tile layout, narrow-screen fallbacks, and
bounded thin-scrollbar body. Assigned/Missing stays unchanged. Both/neither
selected means any status; selected statuses combine with other criteria using
AND. More's count and Clear include the new choices, global Clear resets them,
and collection shortcut Back restores them with the previous browse context.

A shared predicate drives filtering and the fixed-size header icon: missing
descriptive fields or blank/whitespace stickers make a record incomplete.
Explicit n/a stickers are resolved. Explicit Not specified/n/a details remain
valid; named sets still require Set #. Away status, painting progress, optional
notes, and unsaved location changes are not incomplete data. Groups require all
copies to be resolved; Individuals check the displayed copy's sticker plus the
shared group fields. Thus a complete individual can belong to an incomplete
group. The inspector remains group-wide and its accessible label explicitly
says Group record; the explanation names missing fields and counts copies needing
stickers in this group, including siblings hidden by browse filters.

Filters use applied records, not active/parked drafts. Save updates membership
without closing the inspector; its existing outside-filter explanation appears
when a repaired group no longer matches. Creation still permits a blank sticker,
but that created record is now visibly incomplete. No new required fields or
blocking save rules were introduced. No banner counter or persistent storage was
added; all app changes still reset on reload.

Verification: all 90 Chrome UI scenarios, 74 unit/import tests, and 15 local
imported-data checks passed. New coverage exercises both browse scopes, mixed
groups, AND/OR combinations, Clear/Back restoration, draft isolation, Save
removing the last match without closing inspection, new unstickered entries,
group-wide explanations, and imported Race/Set # omissions. More retains its
width/alignment and keyboard focus with narrow or short windows, long catalogs,
and space-consuming scrollbars. Desktop/phone screenshots were reviewed;
`git diff --check` passed. No Git push, clasp upload, or spreadsheet write occurred.

**Owner acceptance and next phase:** the owner reports that the imported preview
looks extremely good. Git checkpoint `ab920a7` (`Add authoring workflows and
imported collection preview`) is committed and pushed to `origin/main`. Before enabling durable
saving, review the long-term storage model rather than carrying forward every
legacy spreadsheet convention. The owner subsequently approved the contained
implementation below, not ID migration, live sheet rearrangement, or app writes.

**October 8 storage-design decisions:**

- Keep Paint and Home at group level, alongside the shared descriptive fields,
  Set/Set #, and group Notes. Most copies are prepainted or painted together.
  Same-name groups with different Paint/Home are intentional, valid variants;
  notes may describe exceptions. Do not automatically merge groups or derive
  identity from their name/field combination. Copies retain their own identity,
  parent group reference, sticker, Current Location, and individual Note.
- The owner supports a standardized independent identity method. Recommend
  retaining all imported IDs and issuing server-generated UUIDs only for new
  records, with a duplicate check. Generate once; renaming, sorting, correcting a
  sticker, or restoring must not change identity. Temporary `mock-*` IDs are not
  the proposed permanent scheme. If moving copies between variant groups is
  added later, preserve the copy IDs and stickers rather than recreating copies.
- The legacy sheet retained deleted records/IDs for restoration until manual
  purge. Recommend durable soft deletion (for example, `deletedAt`) with a Trash
  view, retaining the complete records and group/copy relationships, not just IDs.
  Current group Undo is browser-only; no persistent Trash exists. Group deletion
  must not accidentally restore copies that were separately deleted beforehand.
  Restore must reuse IDs, while permanent deletion is a separate explicit action.
- Owner-confirmed deletion policy: deleted groups/copies must NOT reserve
  stickers or participate in active duplicate checks, counts, search, or next-ID
  suggestions. The owner may delete a group and assign its physical minis/stickers
  to another group as the interim moving workflow. This supersedes the earlier
  recommendation to reserve deleted stickers. Restore is a separate transition
  back to active inventory and must check for reassignment at that point; never
  silently duplicate or steal a sticker. Internal IDs and sticker codes are
  separate: delete/recreate currently makes a new copy identity, whereas a future
  explicit move operation should preserve the original physical copy identity.
- Header-name-based mapping is the accepted direction, provided loading remains
  efficient. Build one validated header map per table read and retain bulk reads;
  reject missing/duplicate headers rather than silently guessing. This does not
  require a particular physical column order. The adapter now implements this;
  existing required header names remain exact, and unsupported headers fail
  explicitly. No live tab was rearranged by this pass.
- Stable Set/Location catalog IDs are desirable for safe renames, but should
  follow or accompany a designed in-app way to add dropdown choices. Do not
  treat sheet-only catalog editing as the finished workflow. Adding an option
  and renaming an existing option are different operations; keep Home and
  Current Location eligibility distinct without losing shared location identity.
- Keep the missing/not-applicable sticker distinction on the storage checklist.
  None of these decisions enables app writes, migrates data, or authorizes a
  new Trash/catalog-management UI in this pass.

Implementation references: Apps Script provides
[`Utilities.getUuid()`](https://developers.google.com/apps-script/reference/utilities/utilities#getUuid()),
and Google's [performance guidance](https://developers.google.com/apps-script/guides/support/best-practices)
prioritizes minimizing service calls and using batch operations. Expected negligible
header-map overhead at this collection size is an engineering assessment, not a benchmark.

**October 8 contained implementation:** Storage.js maps all four tables by their
validated header names without extra spreadsheet reads. It rejects missing,
duplicate, blank, padded, and unknown headers, as well as data beyond the declared
columns. Tests cover rearrangement, preserved blanks, opaque IDs, and same-name
groups with separate Paint/Home. The historical first-import audit deliberately
retains its exact-layout checks; it is not a general-purpose editor or a migration
tool and must not be rerun to overwrite a rearranged destination.

Deleted groups and their saved editor drafts no longer reserve stickers in the
browser. Active records and active/parked drafts still do. On Undo, a conflicting
active assignment or draft produces an inline explanation in Review Changes and
leaves the deleted record, current editor, and assignments untouched. Releasing
the conflicting assignment allows Undo to restore original IDs and drafts. This
is a safeguard for the existing Undo, not a persistent Trash interface. Removing
a copy within Edit remains staged: its saved sticker is released when Save applies
the removal, not before.

At this earlier checkpoint, server-generated permanent IDs, durable
deletion/restoration and purge, and in-app dropdown additions/renames remained
upcoming work; the catalog prototype above is the subsequent approved step.
Paint/Home ownership and current
app layout are unchanged. This pass adds no app write endpoint and changes no
spreadsheet, deployment, or permissions. Upload is a separate owner action.

Verification: 74 unit/import tests, all 73 Chrome UI scenarios, and 12 imported-data
preview checks passed with no browser script errors. The actual-data suite reverses
all four tables locally and asserts equivalent state before exercising the app;
no remote sheet rearrangement is involved. The UI suite covers deleted-sticker
reuse in existing/new groups, released saved and unapplied IDs, conflicts with
active/parked drafts, and successful Undo after releasing a reused assignment.
`git diff --check` also passed. No Git commit/push or clasp upload was performed
for this implementation pass.

**October 7 approved integration completed:** the owner confirmed preservation of
all blanks/checked-out locations, separate Home/current-location catalogs, temporary
editing that resets on reload, and permission to remove the eight-cell test tab.
Both workbooks were backed up and verified. Groups (496), Copies (612), Lists (258),
and Stickers (900) were imported into 2.0 in one batch, replacing only that test tab.
Full readback matched the candidate; all 19 away copies and six blanks survived.
The original sheet is unchanged. The actual destination rerun adds zero rows.

The local app now has a read-only Storage.js adapter and a clear Preview notice.
All authoring stays in memory, including preview sticker hints; reload reads the
unchanged imported baseline. Full catalogs include unused Sets, with Home and
Current Location separate. Failed loads show an error, not mock data. Verification:
60 unit/CLI tests, 72 existing Chrome scenarios, and 11 actual-data preview checks
passed. **No clasp upload, versioned deployment, or permission change was performed
by the agent.** The initial integration pass did not push Git; the subsequent
checkpoint is recorded above. Git updates do not upload the development site.
The [integration handoff](collection-preview-integration-2026-10-07.md) records
backups, exact writes, verification, authorization caveats, and the next checks.
Earlier preparation-only statements below are historical checkpoints.

**October 7 fresh audit and local dry run completed:** read the live legacy sheet
again across all eight tabs, repeated the reads, and checked its unchanged
modification timestamp. The candidate preserves 496 groups and 612 copies, with
zero blocking data conflicts and six warnings: four blank Race values and two
named Sets without Set #. The existing 2.0 test tab is preserved. The authoritative
sticker catalog contains 900 codes, 345 currently free, beginning with F55.

The [fresh audit, field mapping, and next-session handoff](import-dry-run-2026-10-07.md)
is now the current import reference. Local tooling and 40 unit/CLI tests were
added; seven real-data Chrome preview checks and an actual-data rerun simulation
passed. The full Set catalog includes 21 unused options that the live UI must not
lose by deriving choices only from owned groups. Snapshots/candidates stay under
ignored `.local/`; clasp explicitly includes only the five current app files.
No workbook, runtime app code, deployment, permissions, Git remote, or clasp
project was changed by this import-preparation pass. Review the mapping next;
backups, a fresh capture, and approval must precede an actual import. Live storage
and authorization remain separate work, not implied by a successful dry run.

**October 7 destination confirmed:** the owner accepted the pre-live fixes and
confirmed the new app replaces the old spreadsheet workflow. Read-only discovery
verified that the Apps Script project in `.clasp.json` is already container-bound
to [PPQ Miniature Tracker 2.0](https://docs.google.com/spreadsheets/d/1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY/edit).
It has one `MiniatureDataTable` tab containing only eight test cells at A1:D2;
the full A1:Z1000 value read found no miniature records. The earlier statement
that there is no active spreadsheet storage layer remains true, but must not be
misread as meaning the script has no parent workbook.

Recommend reusing this existing workbook with clean storage tabs, leaving the
old PPQ Miniature Tracker as the import source and legacy reference. Do not create
another destination unnecessarily, copy legacy UI formulas into storage, or
overwrite the test tab incidentally. The fresh source audit/field mapping,
dry-run tooling, and local preview are now complete as described above; actual
import and live persistence/access control remain to be built and tested.
Source/destination IDs, read evidence, and the proposed
sequence are recorded in the [source and destination audit](source-sheet-audit-2026-09.md#destination-discovery-october-7-2026).
This discovery changed documentation only; no spreadsheet, application code,
deployment, or permissions were changed, and the app still runs mock data.

**October 6 pre-live review and approved fix pass:** the owner accepted the banner
for now and requested the planned end-to-end audit before import/live storage.
The review reproduced real bugs beyond the existing 63 regression scenarios.
The follow-up fixes remain mock-only and supersede earlier descriptions below:

- Empty provisional groups remain creation drafts after their sole copy is removed,
  including Close/New and Changes recovery. Create must insert the group, never
  silently take the existing-group update path. Explicit Discard removes the draft.
- Existing copy IDs use the same compact input as new copies without widening
  columns. Apply-ID fills the first blank retained copy, including existing ones;
  n/a is not a target. Stable internal identities do not change with sticker text.
  Changed IDs are checked against unchanged siblings, saved groups, parked drafts,
  and deletion Undo. Untouched legacy duplicates do not block unrelated edits.
- Sticker sequence hints belong to drafts until Save. Discard, clearing the hint's
  ID, or removing its copy stops that hint affecting suggestions. An unrelated
  group's Save cannot persist another draft's manual sequence preference.
- Set # accepts up to three alphanumeric characters starting with a digit, such
  as 40, 4a, or 5b. It is disabled and visibly empty without a named Set. Switching
  back before Save restores the draft number; saving n/a clears it. Untouched
  legacy numbers do not block unrelated corrections.
- A previously valid Paint cannot be cleared to blank. Untouched legacy missing
  paint remains editable without forcing that unrelated correction. Notes are
  optional for both creation and the Ready/missing-field indicator.
- On narrow layouts, opening or recovering an inspector brings its header into
  view. Typing does not repeatedly scroll the page; the desktop layout is unchanged.

Verification: all 72 Chrome regression scenarios passed across the broad run and
focused reruns, including nine new audit regressions. Earlier test assumptions
were updated for editable existing ID cells, disabled inapplicable Set #, optional
Notes, and intentional mobile navigation scrolling. Desktop/mobile screenshots
were reviewed; focused runs reported no browser script errors. Tests use locally
rendered Apps Script HTML and mock fixtures, not the deployed Google iframe.
`git diff --check` passed. The user should still spot-check the development site.
No sheet import, backend write, deployment, Git push, or clasp upload is part of
this pass. The earlier read-only source audit remains the import reference:
[source-sheet audit](source-sheet-audit-2026-09.md).

Before live writes, explicitly settle the storage schema and import mapping,
shared sticker catalog/uniqueness, and authorization. The current Apps Script
manifest exposes the web app to ANYONE_ANONYMOUS and runs as USER_DEPLOYING. There
are no current spreadsheet read/write endpoints, but adding owner-authorized
writes under that deployment without an access decision would be unsafe. Do not
change permissions or connect the source sheet as an incidental bug fix.

Next: owner spot-checks these fixes on the development site; then plan a separate
import/storage phase with a dry run, source backup, and explicit authorization
before durable writes. A successful mock regression suite is not a live-data
readiness guarantee.

**October 6 collection banner, accepted for now:** the owner selected the
quiet collection-summary direction. The banner now shows physical miniature and
group totals as plain text, Away and Missing stickers shortcuts, a disabled
`Dashboard / Soon` affordance, and a stable Review Changes disclosure. The demo
warning lives in the title row, with a fuller explanation on click. Narrow screens
move the shortcuts and Dashboard into a Collection disclosure rather than wrapping
the banner. The browse result count lives beside the facets when there is room;
it is no longer mixed into the collection totals. Header height does not depend on
counts, drafts, or undo availability.

Collection shortcuts open Individuals, scoped to applied copies away from Home or
with blank stickers. Literal n/a is not missing. Counts exclude editor drafts and
pending location moves until Save applies them in memory. Shortcuts temporarily
set aside existing filters, sorting, selection, and scroll; Back (in Clear's slot)
or clicking the active shortcut restores that browse context. Switching between
shortcuts retains the original return destination. Filters can further narrow a
shortcut, and the Groups toggle remains usable. Changes provides distinct pending
location, draft-resume, and undo-deletion actions without adding overlapping counts.
Nothing is saved to the sheet.

Verification: all 63 Chrome regression scenarios passed, followed by four focused
checks after the last spacing refinements. Banner geometry was checked from 320px
through desktop widths, including 600 physical copies across 120 groups; no
browser script errors were reported. Desktop/mobile screenshots were reviewed.
No Git or clasp upload was performed for this pass.

**Future dashboard TODO, explicitly not built now:** collection summaries and
charts, including race/type breakdowns and set completion. Define whether each
chart counts physical copies or distinct group entries. Set-completion percentages
need an authoritative set checklist/denominator and distinct owned set entries,
not total copies. The disabled Dashboard affordance is a reminder, not navigation
to an unfinished screen. No new catalog, charts, or persistence is in this pass.

**October 6 More filter cleanup, awaiting feedback:** More follows the card's
order: Role, Set, Paint status, Stickers. Set is a full-width single-set dropdown
with the same 13px/600-weight typography as the tiles. Paint has one row at normal
width, labelled Painted, Unpainted, In Progress; Work in Progress remains its
actual status/tooltip/accessible name. Stickers replaces Needs stickers only with
Assigned and Missing. These states use OR within the category: mixed groups match
either state, and Individuals filters the actual copy. Explicit n/a is resolved
under Assigned for now, not Missing; blanks, including whitespace, are Missing.
Set names are not rendered as a
large tile grid. Explicit Not specified and unfamiliar saved choices are also
available in the descriptive facets. The More count/Clear cover its new choices;
other facet/search/location selections survive its Clear. The existing popover
width and both content edges are preserved even when a thin scrollbar reserves
space. Height is capped to the visible pane, with above-button placement on short
windows when needed; More grids use fewer columns in narrow panes. The broad
57-scenario run passed, and six affected checks passed again after the
short-window/layout refinements. The requested order, typography, single paint row,
and sticker choices add two regression scenarios, bringing the suite to 59.
Ten focused checks passed after these latest refinements, with no browser script
errors; desktop/mobile screenshots were reviewed.
See the
[More cleanup notes](shared-editing-options.md#more-filter-cleanup-october-6).
Catalog lists may be spreadsheet-managed later; an in-app catalog editor is not
a prerequisite. The subsequent pre-live fix pass above closes the existing-ID
editing gap without a separate batch-management screen. The More cleanup itself
did not add persistence or sticker-assignment changes.

**Current handoff, October 6:** the owner considers the authoring flow good.
After comparing the original dropdown focus appearance, the owner accepted
Option 3: retain the two-pixel blue outline with a 1px outward offset and restore
the compensated three-pixel left scroll gutter. The clipping boundary expands
without shifting fields or changing their widths; the inset option is not used.
Other editor/sticker work is unchanged. The owner clarified readiness
for the sticker shortcut, now implemented: an `Apply B92` action beside Add new
copy shows the actual proposed ID and fills the first blank retained copy's sticker
field, top to bottom, ignoring the blue individual-selection highlight. It never
adds a row or overwrites a sticker. The owner rejected the mandatory manual-first
step: startup now uses a remembered next ID, otherwise scans after the collection's
highest valid assigned ID, or starts at A00 for an empty collection. Current mock
data immediately offers M08. Saved/draft/Undo reservations are still skipped,
and manual entry is optional. Save remembers only the counter in this browser;
miniature data/drafts remain reload-limited and no sheet write is made. Invalid or
blocked local storage falls back to collection scanning. Without a blank retained-copy
row, or when the sequence is exhausted, the action is disabled. Sequence
order is A00 through A99, then B00 through B99; beyond Z99 is deferred and the
shortcut stops there. All 52 Chrome regression scenarios passed after the
automatic-start/counter-memory correction, with no browser script errors; nine
affected shortcut scenarios also passed in a focused run. After restoring accepted
Option 3, four focused focus/layout/copy-control scenarios passed with no browser
script errors; desktop/mobile screenshots were reviewed. See the
[October 6 feedback and proposal](shared-editing-options.md#october-6-feedback-and-sticker-convenience-proposal)
for current behavior and review targets. The pre-live fixes above now support
existing-ID correction; explicit missing-versus-n/a entry UX remains optional
follow-up work rather than a reason to add a separate management screen.

The owner accepted deferring authoritative sticker availability to the data-storage
phase: full ordered sticker catalog minus stored assignments, with temporary draft
reservations excluded. This shared list should drive Apply-ID and a future picker,
recover unused gaps, update locally without a request per click, and be rebuilt
across sessions/devices from stored collection data. Revalidate uniqueness on Save;
a remembered cursor is only a preference, not the source of truth. The current
mock shortcut remains unchanged. This TODO does not start sheet integration now.

**October 5 prototype:** the owner approved the sidebar creation plan and
asked to implement it. `+ New` opens the existing editor with a provisional group
and one copy from either browse mode. Create Group requires Name, Home, at least
one copy, and explicit selections for the descriptive dropdowns. They start
visibly blank; Not specified is a deliberate saved choice, not the default blank
label. Set # is only required for a named set, not `n/a` or Not specified. Create
stays dimmed/disabled until validation passes. Drafts remain unpublished until
Save and survive Close/navigation.
Paint uses a normal dropdown beside Set with exactly three statuses, ordered
Painted / Unpainted / Work in Progress; the owner rejected Not specified here.
New groups start blank and require a paint status before creation. Legacy booleans
still render correctly; Painted only includes Painted, not other status strings.
Long per-copy and group Notes now use the same read-mode two-second pause,
slow scroll, two-second pause, and reset as Home/Set. Original sizing and margins
remain intact, reduced motion disables animation, and edit controls never move.
`+ Add new copy` appends a single row, with a compact ID input for the new copy.
Remove controls fit inside Note without changing column widths. Existing-copy
removal is staged with Undo; deleting a whole group uses an inline named
confirmation and offers Undo deletion that restores its copies and editor work.
All actions remain in mock browser memory. The blank-versus-`n/a` sticker TODO
and explicit sticker-entry UI remain later work. See the current prototype in
[the editor/creation notes](shared-editing-options.md) for the actual behavior.
All 42 regression scenarios passed in a full run after the Paint dropdown and
Notes marquee refinements, with no browser script errors. Desktop/mobile geometry
remains stable, and screenshots were reviewed. The owner uploaded the prior
creation/blank-choice prototype to development; these newest refinements remain
local and await a clasp upload and browser feedback.
Eight affected scenarios also passed after removing Not specified from Paint.

The later October 6 pre-live review above supersedes this checkpoint's next steps.
The owner accepted Option 3's focus appearance. Authoritative sticker availability
and spreadsheet-managed option catalogs remain data-storage work, not a new
administrative screen. The real sheet is still disconnected.

**October 4 baseline:** the user returned to revisit the editor feedback.
The local refinement pass makes Edit become Discard in the header, adds breathing
room between the Details rows, and narrows Set # to a three-digit input. Following
the next design discussion, both modes keep the character fields in three
columns, followed by Set/Paint in their own Miniature group. Inventory now has
its own heading and an attached summary band inside the table frame. Available
shares ID's left inset, with the count centered inside its pill; Home matches both edges and the control styling of
Current Location below, with shared column widths and horizontal scrolling.
The tighter band uses quieter labels and a stronger read-only Home value.
Availability remains visible in Edit and previews the shown locations. Its pill
reserves the group's maximum count width; an external asterisk identifies unsaved
changes without shifting the centered count. Set # is only counted as missing
for a named set, not when Set is `n/a` or itself missing.
Paint is a property beside Set, and Notes no longer has a redundant Additional
heading. Close still retains a draft; Discard removes it and immediately returns
to inspection. This remains a mock-only UX iteration,
not approval to connect the sheet or start creation/sticker work.
All 30 local Chrome regression scenarios pass, with desktop/mobile screenshots
reviewed and no browser script errors. The owner accepted the latest layout for
now, confirmed a clasp upload, and requested a Git checkpoint on October 4.

The proposed next step at that checkpoint was a browser review of editing behavior (Save, Discard, closing and
resuming drafts, shared fields/copy notes, and Home versus current locations).
Then design Add Miniature using this editor as the starting point, including
how to specify physical copies for a new group and add copies to an existing
group. The October 5 discussion and implementation above supersede that boundary.

The earlier passive-label/wrapping TODO is addressed by the October 6 collection
banner prototype above, pending owner feedback. The broader
[Header System Pass](ui-optimization-roadmap.md#14-header-system-pass) can still
review visual hierarchy across the app, browse, and detail headers together.

September 12: the user asked for the first editor prototype
after clarifying cleanliness takes priority over exact layout replication, with
familiar order still important. It is now implemented locally and ready for
browser feedback. See [the editor prototype notes](shared-editing-options.md)
for the actual controls, unified mock Save/Discard/draft-retention boundaries, Home-change
behavior, and review targets. The historical planning below is not a reason to
reopen the layout-options debate. Editing remains an iterative, unfinished phase.

Latest feedback pass: edit fields now have labels and controls without backing
cards, and Set is a controlled dropdown drawn from the current mock set list.
The owner chose keeping drafts on close: no in-app native discard confirmation,
Close/navigation retain unapplied drafts, and a Drafts button resumes them even
through filters. Only Save applies changes; Discard removes the editor draft
without erasing earlier location staging. Drafts remain memory-only until reload.
All 27 local regression scenarios pass. Copy addition, sticker correction, and
dropdown-catalog maintenance are recorded as future design work, not implemented.

For the completed browse phase, refer to the code-grounded
[Groups / Individuals integration checklist](individuals-integration-plan.md).
It covers the approved selector, proposed behavior, measured layout constraints,
review gates, staged TODOs, and regression cases. The original deep dive changed
only documentation. After the user asked to start, a first functional mock-only
build was implemented; see its current progress section for behavior and remaining
UX review points. The owner accepted this phase on September 9; shared-editing
UX is next, to be discussed in the next session before implementation.

For that discussion, [Shared Editing: UX Options](shared-editing-options.md)
compares in-place cards, a focused editor in the same sidebar, per-field editing,
and a modal. It records draft/navigation/field-layout challenges and a proposed
small first prototype. These are alternatives for review, not approved decisions.

September 12 update: the user chose the focused editor in the same sidebar and
provided read/edit screenshots from PPQ Loot Chests as the interaction reference.
The outer pane/context stays stable while fields and header actions change for
editing. The options document records the choice; an A/B layout comparison is
no longer needed. Specific controls and save/navigation semantics remain to be
worked through before a full implementation.

Subsequent clarification: preserve the actual field order/grouping and shapes,
not merely the sidebar outline. Keep the copy table with editable individual
notes, keep group Notes below it, and retain the Size/Type/Race and Sex/Role/Set
rows. The user suggests omitting Availability in edit mode and editing Home;
continued location editing is a design choice. This supersedes the proposed
copy-table removal and expands editing scope beyond shared fields. See the
options document's clarification before using the older shared-only plan below.

September 9 follow-up: mode entry now selects/reveals a matching copy, inspector
rows support reciprocal selection in Individuals, popover dismissal no longer
also closes inspection, and three-digit availability pills have compact padding.
Twenty local regression scenarios pass; the owner confirmed scrolling, reciprocal
selection, and blank-space popover dismissal work well. Popover clicks on actual
rows still perform their normal action, deliberately accepted for now. The
integration checklist records the rationale, handler mechanics, and a possible
future consume-the-dismissal-click change if accidental actions become a problem.

The user confirmed the current development app is running, and corrected the
restart priorities after the stabilization pass:

- This is active UX and functionality design, not preparation to ship. The user estimates development is closer to 30% complete.
- Continue using mock data until the user considers development complete and explicitly approves integration.
- Do not connect the real sheet, even read-only, or introduce real persistence during this phase.
- Spreadsheet schema, missing/n/a semantics, and other integration decisions stay deferred. Do not make them prerequisites for UX work.
- Design and exercise add-mini, editing, sticker management, and group/individual browsing interactions using browser-only mock state.
- The accepted current layout is a baseline for experimentation, not evidence that the application is nearly finished.

### Recovered Flow Notes

- Groups / Individuals: the user's earlier conversation specifies the same browse table, replacing `#` with sticker `ID`, and Home with Current Location plus the existing Home/Away badge treatment. One row per copy; all remaining columns stay unchanged. Both views open the same group inspector. Preserve the clipping/column stability while testing the new content.
- Sticker-first search: roadmap step 10 proposes exact sticker recognition, opening the parent group, scrolling to the copy, and temporarily highlighting it. This is a useful companion proposal, not a reason to change the user's agreed toggle design.
- Shared editing: the user described an Edit action in the current Close-button position, switching shared fields to editable controls and submitting changes for the whole group. Individual sticker/location/note editing is separate. Earlier modal/drawer suggestions are less specific and do not override this later direction.
- Add miniature: roadmap step 13 lists the flow, and `ui-direction.md` suggests a secondary modal/drawer rather than making entry the landing page. No finalized screen-by-screen new-app creation flow was found in these notes.
- Sticker management: `docs/legacy/legacy-workflows.md` records a queue of copies needing stickers, batch dropdown selection, duplicate feedback, Apply Stickers, and a separate batch unassignment flow. These are legacy interaction references, not an approved new-app screen design. Next-available-sticker selection is only a proposed improvement.

### Agreed High-Level UX Sequence

This sequence incorporates the user's end-of-evening feedback. It is not a fixed
screen specification or a list to implement in one pass. Each step is expected
to involve substantial design, browser feedback, and iteration.

1. **Groups / Individuals: accepted September 9.** The approved segmented control remains beside Browse Minis with a 16px gap and a 1px downward optical nudge. Mode-specific rows, search, sorting, copy selection/reveal, and reciprocal inspector selection are implemented. The integration checklist records the accepted behavior and nonblocking follow-ups; no additional browse work is required before starting shared-editing design.
2. **Shared editing.** Retain the user's strong direction: enter edit mode from the detail-header action area, edit shared miniature fields in place, and apply or cancel mock changes. Iterate on the editing experience before deciding how creation should work. Keep group-level edits distinct from individual-copy edits.
3. **Add miniature.** Evaluate this after shared editing has been built and reviewed. Creation might reuse the same editor in a blank/new-entry state, including an editable name, rather than introducing a separate screen. A modal or drawer remains an option, not a commitment. Let experience with the editor reveal what additional controls or steps are actually needed.
4. **Sticker assignment and management.** Follow the preceding flows, not in parallel with them. Individual group editing may offer manual assignment, but a dedicated batch workflow similar to the legacy experience will likely also be useful. When this step begins, the user will explain the pain points and the assistant will propose UX alternatives. Do not settle its detailed design now.

### Iteration And Resume Boundary

- Remain mock-only throughout these UX steps, with no real spreadsheet connection or persistence.
- The assistant is responsible for interpreting intent, filling implementation gaps, and recommending well-fitting UX options. The user should not have to specify every control or pixel.
- Work one interaction-sized slice at a time, review it in the browser, and revise before moving on. Completing an initial implementation does not complete the design step.
- Preserve the existing visual language and stable table behavior where practical; do not treat the current layout as untouchable if a core workflow exposes a limitation.
- The user accepted the Groups / Individuals refinements and asked to document/commit the result. Next session starts with shared-editing UX: agree the smallest Edit -> change shared fields -> Apply/Cancel interaction in the existing detail panel. Keep group metadata drafts distinct from pending copy-location changes, and decide how navigation/close handles unsaved edits. Do not start creation, sticker workflows, or persistence as part of that slice.

## Stabilization Follow-Up (2026-09-07)

Implemented and verified with `tests/regression.cjs` in local headless Chrome:

- Initial JSON escapes script-sensitive characters and preserves the original data.
- Set All Home clears staged-away moves for copies saved at home and stages home for saved-away copies.
- Desktop table width derives from the full workspace and fixed pane insets, not the narrowing browse pane. Opening, resizing, closing, and crossing the desktop breakpoint retain the width model.
- Copy edits, sort changes, and facet selections preserve keyboard focus across rerenders.
- A global Unsaved button reveals pending work, including filtered-out groups. Leaving with pending edits requests the browser's standard warning.
- The top notice explicitly explains mock-only, reload-limited saves.
- Intermediate-width search gets its own row when details are open. Smaller screens scroll the tables instead of squeezing their columns. This is a functional fallback, not a complete mobile redesign.
- Marquee respects reduced-motion preferences. Group notes expose the full text through a tooltip; a touch/keyboard-friendly note reader remains future work.
- Missing paint is no longer incorrectly labeled Unpainted; only explicit false gets that tag.

All eight regression scenarios passed, with no browser script errors. Desktop
screenshot reviewed. The owner subsequently confirmed the current development
app is running; no real sheet reads/writes were added. Historical findings
below describe the pre-fix state, not outstanding bugs unless noted here.

The [command and feedback reference](../development.md) explains Git, clasp,
development URLs, and a short browser feedback session.

## Where We Actually Are

- Apps Script serves a vanilla JavaScript/CSS prototype. No framework or build step.
- `Code.js` builds nine mock groups containing 28 physical copies on every load.
- There is no active spreadsheet read/write layer, spreadsheet ID, or imported real inventory in this checkout.
- Save Changes updates browser memory only. Reloading restores the mock data.
- Legacy sheet schemas and workflows are documented under `docs/legacy`; the old scripts are reference text, not active application code.
- User confirmed the existing Google Sheet remains the source of truth. Subsequent read-only inspection confirmed 496 definitions and 612 physical copies already present; see [the source-sheet audit](source-sheet-audit-2026-09.md). No re-paste is needed to recover the existing inventory.
- User wants adding minis and managing sticker assignments in the first real-use version, in addition to lookup and movement.

## Accepted UI Baseline

- Browser: search, searchable single-location selector, Clear, and shared facet panel.
- Facets: Size, Type, Race, Sex, More. More contains Role and provisional collection flags.
- No permanent applied-filter-chip row. Facets apply immediately, OR within a category and AND across categories.
- Group table: `# | Name | Home | Size | Type | Race | Sex | Role`.
- Availability uses colored available/total pills. Numeric availability sorts by available count; Size uses semantic order; text sorts naturally.
- Keep the hand-tuned table positions, rounded clipping edge, and independent panel scrolling. Do not reintroduce column hiding/reflow midway through opening details.
- Inspector order: Details, Inventory, Additional, separated by titles and spacing.
- Details: equal three-column rows, `Size | Creature Type | Race`, then `Sex | Role | Set`.
- Header: name, completeness tag, neutral Unpainted tag when applicable, unsaved count, Close.
- Inventory: Availability and Home occupy two of three equal tracks; the third stays empty.
- Copies use one table: `ID | Status | Current Location | Note`.
- Reset, Set All Home, Save Changes are compact, right-aligned in one row below the table.
- Additional holds group notes. Individual copy notes are separate data, currently read-only.
- Home and Set use clipped single-line text with selective marquee: two-second pause, scroll, two-second pause, reset.
- Broad header styling remains deferred for a holistic review.

## Deployment Check

`clasp deployments` succeeds and lists HEAD plus two versioned deployments.

- Version 1, description `PPQ Miniature Tracker 2.0 v0.22`, opens in an isolated browser but serves an older eight-group prototype with the early layout.
- Version 2, description `Mini Tracker Version 0.15`, requires Google sign-in in that browser.
- HEAD `/dev` also requires Google sign-in; the latest remote source was not inspected or compared with local files.
- Therefore a public versioned URL is not evidence of what the latest development app looks like.
- No deployment, remote source, or sheet was modified during this review.

Before the next live test, verify the bookmarked development URL and distinguish it from the published versions.

## Verified Findings

### Before Real Data: Data Embedded In Script Can Execute As HTML

`Code.js:3` serializes data with `JSON.stringify`; `Index.html:12` force-prints it
inside a script element. A synthetic note containing a closing script tag and a
second script executed in the isolated local preview. Cell rendering later uses
`escapeHtml`, but that cannot protect the initial HTML parse.

Escape script-sensitive characters when serializing, or load data through a safe
server-response path. This is a real-data integration blocker; current input is
hardcoded mock data, so the test does not demonstrate an existing external writer.

### High: Set All Home Leaves Some Pending Moves Untouched

`Scripts.html:1457` checks saved location rather than normalizing every selected
copy's draft against Home.

Reproduction: open Zhent Soldier, stage A12 from Spare People to Quest Minis,
then click Set All Home. A12 remains at Quest Minis with Unsaved 1. Saving
commits that unexpected move to browser memory.

Normalize all drafts: remove a pending move for copies already saved at Home;
stage Home for copies saved elsewhere.

### High: Resizing With Details Open Breaks The Table Width Lock

`Scripts.html:112-113` registers `syncDesktopLayoutMetrics(force)` directly as
resize and ResizeObserver callbacks. Their event/entries arguments are truthy,
so they unintentionally act as `force`, bypassing the open-panel guard at line 1197.

Reproduction at 1440px: the full table is 1176px, clipped inside a roughly 526px
left wrapper. Resize to 1400px with details still open: the table lock becomes
526px even though the available shell width is unchanged. Columns squeeze.

Use explicit callback arguments and derive the expanded width from stable layout
geometry. Preserve the accepted clipping behavior and verify resize/open/close together.

### Medium: Editing Rebuilds Controls And Loses Keyboard Focus

`handleRootChange` at `Scripts.html:1046` invokes a full rerender, including
`detailContentNode.innerHTML` at line 707. Changing a focused location select
moves focus to BODY. This interrupts keyboard traversal and also restarts marquee.

Preserve the active control or update only the affected controls. The same full
render path is used for facets, sorting, and main search. Optimize selectively.

### Medium: Pending Changes Can Become Invisible

Drafts survive switching groups, but only the selected group's header shows a
count. After staging A12 away and selecting Archmage, the header says Ready and
the summary gives no indication that A12 is still pending. Returning to Zhent
Soldier reveals Unsaved 1 again.

Decide how users find pending work across groups and what happens on page exit.
Closing a panel does not currently delete drafts, but reload loses all browser state.

### Medium: Narrow Layouts Have Functional Limits

- At 1100x650 with details open, the main search field measures only 34px wide.
- At 390px, the browser squeezes all eight columns into the phone width; badges
  and labels clip, with some headers visually running together.
- The copy-location dropdown at that phone width measures about 44px.

Prioritize the supported device widths with the user. At intermediate widths,
keep search usable by adapting controls/panel behavior. A phone layout needs an
explicit strategy instead of shrinking the full desktop table.

### Lower Priority: Long Text And Motion Accessibility

- Group notes are single-line clipped with no full-text reveal (`Scripts.html:741`,
  `.mini-v2-note-body` in Styles). Preserve stable rows, but offer a deliberate
  way to read the complete note.
- Home/Set marquee continues even with `prefers-reduced-motion: reduce`.
  Preserve the accepted animation by default; provide a static readable fallback.
- Completeness currently treats every listed blank field, including Notes and
  Set #, as missing. Missing paint also appears Unpainted. These need explicit
  real-data semantics, not blanket truthiness checks.

## What Passed And What Was Not Tested

An isolated Chrome/Playwright preview assembled the local Apps Script template
using its actual mock-data builder and unmodified client files.

- No runtime page errors in the normal test sequence.
- Availability descending and name ascending produced the expected order.
- Medium OR Large returned nine groups; adding Type Beast returned Warhorse.
- C16 search returned Spirit Folk Fighter. Auto-open/copy focus is not implemented.
- Save/reload confirmed browser-only persistence.
- Desktop screenshot inspection preserved the accepted rounded table clipping and grouped inspector layout.
- A synthetic 600-group dataset rendered; one synchronous search event took about
  53ms on this machine. This is a limited smoke check, not a real-data performance benchmark.
- Rendering and interaction tests reproduced the findings above.

Not tested in the initial app review: authenticated HEAD app, actual sheet contents,
server writes (none exist), concurrent editors, actual full inventory performance,
or other browsers. Actual sheet values and sample formulas were subsequently
inspected in the linked source-sheet audit; app integration is still pending.
Browser tooling and screenshots were kept in a temporary directory outside the repo.

## Superseded Integration-First Restart Proposal

The sequence below is retained as historical technical planning only. It is NOT
the current work order. Follow the mock-only UX direction above; revisit these
integration topics only when the user says the app design is ready.

### A. Small Stabilization Pass

Fix Set All Home, the resize-width bug, and focus preservation. Clarify pending
work visibility and mock save behavior. Protect data embedding before sheet reads.
Keep the accepted layout as the baseline; avoid a broad redesign or framework migration.

### B. Verify And Connect Real Data Read-Only

Identify the source sheet, count definitions and physical copies, verify headers
and IDs, and inspect existing sticker assignments. Do not import duplicates.
Map real data to the current group/copy model, retaining a mock mode for tests.

Settle missing versus intentionally blank/n/a values, per-copy note storage,
unique copy IDs, and unassigned versus n/a stickers. Validate real field lengths
and option vocabularies before changing the hand-tuned layout.

### C. Groups / Individuals Browser And Sticker Focus

Carry forward the user's last approved direction:

- A Groups / Individuals toggle uses the same table and inspector.
- Individuals produces one row per physical copy.
- Replace `#` with sticker `ID` and `Home` with Current Location plus Home/Away badge.
- Name, Size, Type, Race, Sex, Role stay as they are, inherited from the group.
- Opening a copy selects its parent and focuses that copy in the inspector.
- Search, filters, and sorting need explicit group-versus-copy semantics.

### D. Complete The Real-Use Workflows

- Save location changes by stable copy ID, with server validation and clear success/failure feedback.
- Edit shared mini metadata separately from individual notes/locations.
- Add definitions and physical copies without duplicate IDs.
- Assign/unassign stickers with server-enforced uniqueness and the agreed n/a semantics.
- Handle concurrent changes without silently overwriting someone else's work.
- Revisit the current manifest's anonymous/execute-as-deployer settings before enabling real data writes; establish intended users and access.

Finish with relevant responsive polish and the deferred header-system review.
The user specifically includes adding minis and sticker assignment in the real-use target.
