# Save, Upload, And Test

## Live Build (October 9)

The owner approved production activation after the hosted rehearsal. The live
build targets the original 2.0 workbook, not the disposable test collection.
Migration/deployment evidence and activation status are recorded in
[rollout and rollback](rollout-and-rollback.md). Do not copy rehearsal data back.
Version 5 is now published at the [owner-only live URL](https://script.google.com/macros/s/AKfycbzC3N1pZaLkodNlBfxnkBLquhP5faZSCB4NCN7fD0IFIrgSk5lBBNsl9Nav0eJV18hA/exec).
The workbook migration and backup comparisons passed. The owner confirmed the
live app loads the expected collection without rehearsal UI and a real change
survives save/reload. Version 5 adds explicit `n/a` Set # for unnumbered sets;
Set = `n/a` still needs no number. Old preview links are not the live app.

Production and rehearsal share `tools/app/build.cjs`. `tools/app/live.cjs`
removes rehearsal notices, timing UI, simulator code and browser test hooks,
while retaining the tested save transport, fast loader, authorization, retry and
conflict handling. Its generated server has only `doGet` and
`saveCollectionChanges` as public endpoints. Deployment access is owner-only.

**Build before every upload:** root `.clasp.json` now uploads the 14 generated
files in `.local/live/app`, not the raw preview fixtures in the repository root.
Make UI changes in root `Scripts.html`/`Styles.html`, shared persistence changes
in the root persistence modules, and server/build changes in `tools/app` or the
shared templates under `tools/rehearsal`. Never edit generated files by hand.
Root `Code.js`, `Storage.js`, `Index.html` and `appsscript.json` remain historical
preview/test fixtures and are not the deployed entry point or manifest.

```powershell
node tools/build-live.cjs
clasp.cmd status
clasp.cmd push
```

The build fails without trusted `.local/live/config.json`; that ignored file
contains the established script, workbook and collection identities plus owner
and save switch. Recover it from the verified deployed `COLLECTION_CONFIG_`
if setting up another machine. Do not run migration preparation again or invent
a new collection identity. `tools/prepare-live.cjs` and `tools/deploy-live.mjs`
are guarded one-time rollout tools, not everyday save or publish commands.
`tools/verify-live.cjs` verifies captured baseline data locally, not current
production data after users start saving. Never run preparation as a reset tool.

`clasp push` updates HEAD and `/dev`, not the versioned `/exec` app. For a live
release, create a new Apps Script version and update the existing owner-only
live deployment after testing. Keep prior compatible versions for rollback.
Before any source upload, inspect uncollected edits in Google's editor.

Production-specific checks (use the installed Playwright path if necessary):

```powershell
node --test tests/live.test.cjs
$env:LIVE_BUILD = '1'
node tests/rehearsal-browser.cjs
Remove-Item Env:LIVE_BUILD
```

Drafts are memory-only. Closing an inspector keeps its draft in this page;
reload/navigation may discard it. Saves are explicit, not automatic. Save All
includes pending work hidden by filters. Existing retry/conflict and unsaved
warnings remain. Group notes wrap with line breaks; copy notes marquee.

## Historical Development Notes

Everything below records the earlier preview/rehearsal phases. Their upload
commands and claims that the normal app cannot save are superseded by the live
build instructions above; do not use them to reconfigure production.

**Pre-activation checkpoint (October 9):** The normal app remained a read-only preview.
The separate private rehearsal app now has real saves to its disposable test
workbook only. Read/write authorization and the first hosted note save/reload
have passed, with revision 1 and the stored note verified through Google readback.
The owner also reports successful Save All, copy addition/removal, group deletion,
list operations, restoration of a deleted test group and two-tab conflict handling
in the hosted rehearsal. These are owner-reported checks. Full-workbook recovery
is not an app feature; the [manual rollout/rollback procedure](rollout-and-rollback.md)
is documented but has not been rehearsed against Google. Per the October 9 owner
decision, that rehearsal is not a launch requirement. Keep recovery lightweight:
a fresh private workbook copy at rollout, the legacy sheet untouched, and manual
recovery/version history if needed. No backup UI, automation or mandatory schedule.
Normal root `clasp push` does not update that test app.
Version 6 confirmed saves reliably, but the owner measured unacceptable
8-15-second waits. A timing screenshot traced 13.6 seconds to reading the sheet.
Version 7 replaces that detailed-cell read with compact batched values while
preserving fresh-read validation. On October 9 the owner manually estimated
7-8 seconds to load and 2-3 seconds to save. Saves are substantially improved;
these observations are not a latency guarantee.
The private app is now version 14, with a hosted-confirmed startup fix. Version 10
had failed because Google's processed HTML lost the snapshot comment marker;
it was rolled back to 9 while separate synthetic diagnostics established the
cause and checked alternatives. Version 14 reads raw template text before
inserting the fresh snapshot, then creates HTML. The old v9 template loader is
retained as an automatic fallback. Group notes wrap; individual notes marquee.
The owner's actual-app report now shows 30 ms for page read/build (previous
template evaluation: 1,925 ms), and 1,196 ms server total (previous: 2,603 ms).
Sheet reading was 961 ms and browser initialization 127 ms in the new run. These
are separate observed loads, not a controlled benchmark or full address-bar
load timings. The owner had 18 EverQuest clients running; local contention may
affect browser/perceived time, not explain server-measured durations. This
optimization pass can stop here unless normal use exposes another concrete issue.
Saving, fresh reads, UI assets, data and the original app are unchanged.

## The Everyday Commands

Save your open files in the editor first. In the project's PowerShell terminal:

```powershell
git status
git diff
git add .
git commit -m "Describe what changed"
git push origin main
clasp status
clasp push -f
```

- `git status` lists changed files; `git diff` shows edits to tracked files.
- `git add .` stages all changes in this folder. Use it only after checking that all changes belong in the commit. To choose files, use `git add Code.js Scripts.html Styles.html` instead.
- `git commit` records a local checkpoint. Change the quoted message each time.
- `git push origin main` copies committed checkpoints to GitHub.
- `clasp status` lists the files that will be uploaded to Apps Script.
- `clasp push -f` uploads local app files, including the manifest. It replaces the remote project source; do not use it to overwrite uncollected edits made in Google's editor.

Run commands one at a time. Stop if any command fails. Neither kind of push
requires the other: GitHub is code history, Apps Script is the running app source.
Neither command imports miniature records or edits spreadsheet cells.

The repo's `.clasp.json` already identifies the Apps Script project. No new
project setup is needed. If authentication expires, run `clasp login` and sign
in with the account that owns the script. Never commit `.clasprc.json` credentials.

## Open The Current App

Open the [Apps Script project](https://script.google.com/home/projects/1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0/edit).
Choose **Deploy > Test deployments**, then open/bookmark the Web app URL ending
in `/dev`, signed in as a script editor. Refresh that page after a clasp push.

The `/dev` test app uses the latest saved source. An existing `/exec` URL is a
versioned deployment and is not updated by a source push. Publishing a new
version is a separate, deliberate step; we are not doing it during this restart.
See Google's [test deployment guide](https://developers.google.com/apps-script/guides/web#test_a_web_app_deployment)
and [clasp guide](https://developers.google.com/apps-script/guides/clasp).

After uploading the October 7 integration, expect **612 miniatures across 496
groups** and **Preview: changes reset on reload**. The app reads the imported
snapshot from the 2.0 workbook, not the old tracker. Save, Create, Delete, and
location edits affect only the current browser session. Reload restores the
imported baseline. Do not paste/import again or edit the storage tabs during
preview testing.

Draft policy (confirmed October 9): closing the sidebar or switching groups keeps
unfinished work in the current page. Refreshing or leaving the app can discard
it; no automatic draft backup or reload recovery is planned. Keep the existing
unsaved-changes warning, but do not treat a browser warning as crash/forced-close
protection. A draft is not a saved collection change.

Use `clasp.cmd status` and `clasp.cmd push` if PowerShell blocks `clasp.ps1`.
Storage.js is now an application file and must be included in the upload. Google
may require spreadsheet authorization once; run `doGet` from the Apps Script
editor if authorization or loading needs attention, and inspect the execution log.
There is no writer in this main app. Backups and import evidence are recorded in
the [integration handoff](design/collection-preview-integration-2026-10-07.md).

`Persistence.js` and `PersistenceAdapter.js` remain excluded from root clasp
uploads and are not called by the main app. The isolated rehearsal includes them
through its separate staging build. Their candidate
schema must not be pasted into
the 2.0 workbook: the current reader still expects the imported preview schema.
No extra upload/migration command is needed for this work. The
[saving-phase checklist](design/recalibration-2026-09.md#saving-phase-remaining-gates)
covers the future write adapter, draft/retry UI, owner access, and a backed-up
test migration before real saving is enabled.

The October 9 offline model now rehearses batch saves with one revision/receipt,
record-scoped conflict checks, and retry-safe ID mappings. Its candidate schema
is version 2, including numbered receipt pieces for large saves. This does not
change the deployed reader or workbook. The disabled transport adapter is now
implemented and tested locally: owner/config checks precede workbook access,
a script lock surrounds reread/validation/commit, and changed cells, revision,
and retry receipt are sent in one batch. Replays do not write again. Formulas,
unexpected schemas, wrong destinations and unverified callers fail closed.

The adapter has no configured destination/owner and is disabled by default.
The Apps Script bridge is private, uses the Advanced Sheets service, and remains
excluded from uploads. That service has NOT been added to the manifest. Tests
use a fake service, not Google authorization or real API calls.

The browser now includes `SaveFlow.html`, a **separate in-memory simulation** for
the Saving/Retry/conflict experience. Include this HTML file in the normal clasp
upload (the allowlist and Index template already include it). Do NOT upload
Persistence.js/PersistenceAdapter.js or enable the Advanced Sheets service for
this preview. No Google save endpoint is called. The simulator still uses the
current label-based preview records and temporary IDs. The separate local-only
contract bridge below now tests candidate-schema IDs, load baselines and the real
response envelope. It is not enabled in the deployed preview.

Every Save/Create, location Save, Save All, confirmed Delete/Undo, and list
Add/Save/Remove/Undo waits for an acknowledgment. While waiting, the submitted
fields are protected; browsing, Close and unrelated drafts remain available.
Only one request may be unresolved at a time. Lost confirmations keep that exact
request for Retry, without permitting Discard to pretend a possibly committed
save never happened. Confirmed rejection offers **Keep Editing**, retaining the
draft. A conflict instead asks **Save Anyway** or **Discard My Changes**.
Save Anyway applies the user's edits over conflicting saved values, preserving
unrelated newer fields. Discard drops this entry's draft and loads its saved
version without sending a save or recording a deletion/sticker allocation.
For Save All, Discard names and affects only the entries that changed elsewhere;
other pending work stays intact. Another intervening change requires a fresh
confirmation. There is no comparison step, autosave, or forced reload.
All state still resets on reload.

To try the new states: open the top **Preview** (or **Demo**) notice, expand
**Try save feedback**, and choose the next outcome. Close the notice, edit and
save normally. Connection problem fails before applying anything; Lost
confirmation applies only in simulated storage and Retry retrieves its receipt;
Changed in another tab changes an existing record's name before checking the
save. Repeated demonstrations alternate a single ` - Updated` suffix rather
than accumulating labels; real parentheses in names are preserved.
Each choice is consumed once, then returns to Normal. For an overlapping
conflict, edit the miniature name yourself before saving. No production controls
or persistent debug settings are introduced. A first-ever new record has no
existing record to conflict with, so use an existing miniature/list choice.

### Local Storage Connection

The approved save UI now has an offline integration with the actual persistence
model and adapter, not just the separate save-feedback simulator.
`PersistenceContract.js` returns versioned, JSON-safe snapshots and save results
under the adapter's lock. `PersistenceClient.html` maps displayed labels and draft
IDs to catalog/group/copy IDs, keeps original record tokens, and reuses exactly
the same submitted payload on retries. Acknowledgment remaps newly created IDs
without losing the selected sidebar. Unrelated drafts are not rebased by another
save. List saves remain independent; their labels update existing assignments
without changing stored references.

Both new files remain excluded from clasp, and Index does not include the client.
The integration browser test supplies the script, a candidate snapshot, and an
injected in-memory transport. Scripts refuses that mode unless the local test
flag and transport are both present. Normal uploads still run the original
read-only imported preview plus browser-memory save simulation. No additional
clasp command, authorization, public RPC, migration, or sheet write is needed.

Local checks (Playwright must be installed or supplied in `PLAYWRIGHT_MODULE`):

```powershell
node --test tests/persistence-client.test.cjs
node --test tests/recovery.test.cjs tests/sticker-availability.test.cjs
node tests/persistence-client-browser.cjs
```

These exercise Save/Create, Save All, location edits, list operations, deletion
and session Undo, lost replies, explicit overwrite/discard, and reload from a
fake workbook using the actual adapter. The optional ignored imported snapshot
also runs all 496 groups through one retry-safe batch while preserving 612 copies,
blank fields, IDs, and the 19 away locations. No test touches Google.

### Reload And Recovery Rehearsal

The local candidate now includes recovery of saved removals after reload:

- **Lists > Show removed > Restore** re-enables a choice with its original ID.
  Restoring a choice never changes miniature fields assigned to something else.
- **Review Changes > Removed miniatures** opens a searchable Groups/Copies dialog.
  Restoring retains original IDs, copy numbers, notes and locations. A group
  restore does not also revive copies removed before the group was deleted.
  Restore the parent group before restoring an individually removed copy.
- Restore rechecks active sticker uniqueness and refuses to reclaim a sticker
  now used elsewhere. Errors stay inline; uncertain responses retry the exact
  request rather than duplicating records. Pending work on the same group must
  be saved or discarded first; unrelated drafts remain intact.
- If an edited group/copy was removed in another tab, explicit **Restore and
  Save** can restore its identity and apply the draft in one validated write.
  This is not autosave and never treats a restore-only response as saving edits.

Next ID follows the owner's confirmed **earliest unused catalog ID** policy.
If A through F are otherwise assigned but D11 is missing, keep offering D11,
even after manually entering a G sticker. Derive availability from the ordered
catalog minus active assignments, with temporary reservations for open/parked
drafts. Discard releases those temporary reservations; a successful save makes
the assignment survive reload. Deleted, blank and n/a copies do not reserve
codes. No sequence pointer is stored and no extra request is made per Apply
click. Concurrent saves still enforce uniqueness on the server. The old
catalog-less mock fallback is not used by the imported collection or storage
connection; existing localStorage sequence hints cannot override the catalog.

The deployed preview can show the same recovery controls within its current
session, but **reload there still resets everything**. Only the local fake
workbook tests exercise durable recovery and saved sticker assignments. Drafts remain
memory-only in both paths; they are not restored after reload. Deleted records,
removed choices and receipts have no automatic expiration or purge.

At this earlier checkpoint, owner-access verification, disposable migration and
real-service save/reload tests were still pending; see the later hosted results
below. Full-workbook recovery remains untested but is no longer a launch requirement.
Neither persistence activation nor a production migration is authorized by this
local rehearsal. No deployment, manifest, spreadsheet or Git push was performed.

Read-only access audit (October 9): Google confirms the app project is bound to
2.0. The sheet is link-readable, not publicly editable. Neither published app
version is owner-only: version 1 permits anonymous users, and version 3 permits
any signed-in Google user. Uploaded Code/Storage match the local preview reader;
the offline persistence modules are not uploaded. No permission was changed.
The recommended next step is a separately approved private workbook copy and
owner-only test app with its own staging/clasp configuration, not a root-project
push or a change to your existing app. See the
[access audit and rehearsal plan](design/recalibration-2026-09.md#october-9-read-only-access-audit-and-test-setup-plan).

**Later October 9 update:** The owner approved and we created the private backup,
disposable schema-2 workbook, and separate `MYSELF` test app. Versions 1-4 were
read-only. The owner confirmed 612 miniatures / 496 groups after granting read
access. Version 5 now connects real saves only to that disposable workbook.
Original app content/deployments, root clasp target, source cells and sharing are
unchanged. See [private rehearsal setup](design/recalibration-2026-09.md#october-9-private-rehearsal-setup-created)
for verified links, IDs, checks, and the remaining rehearsal steps.
Local staging is `.local/rehearsal/app/`; do not use the root clasp project to
update it. The initial migration helper is not a repeatable reset script.
The owner completed **Allow test saves**, saved `Rehearsal save test` in Archmage's
Notes and confirmed it survived reload. Google readback independently verified
the note, revision 1 and its save receipt. The added line break is still stored;
the old read-mode marquee hid it. Following the owner's clarification, version 9
uses plain wrapping text for all group notes, preserving authored breaks and
blank lines. Only individual sticker notes retain their single-line marquee.
Copy-table geometry is unchanged. No stored-data repair was needed.

The next location test revealed repeated unconfirmed-save messages despite
successful writes. Version 6 now waits up to 90 seconds for confirmation, shows
Still saving after 15 seconds without abandoning the reply, and computes record
fingerprints in V8 rather than making hundreds of Utilities calls. Same-request
Retry and conflict checks remain intact. The owner confirmed version 6 works but
remains slow; its timing report showed reads consuming 13.6 of 14.3 seconds.
Version 7 now reads metadata separately and cell values in one compact batch,
with targeted formula checks and no cache. The owner reported approximately
7-8 seconds to load and 2-3 seconds to save after this deployment. This latest
report did not separately confirm a post-save reload; earlier hosted persistence
checks passed. Next, profile remaining startup time separately, including server
read/template work and browser startup, before selecting another optimization.
The Rehearsal save timing object includes separate metadata/value-read times.
Keep using the **Rehearsal: saves to test copy** app; no clasp command is needed.

**Further owner testing (October 9):** Save All, adding/removing copies, deleting
groups, list operations and restoring a deleted test group all looked good.
The owner subsequently confirmed that two-tab conflicts also worked great.
Record these flows as passed in the owner's hosted rehearsal; do not repeat the
broad walkthrough by default. The report did not specify each list operation,
reload after each action or new-group creation. Confirm
any remaining coverage with targeted checks rather than assuming it passed.
There is no full-backup restore control in the app. The private setup includes
a verified pre-migration workbook copy, not an automatic backup system or a
tested rollback procedure for the current six-tab storage format. The owner has
declined an extensive recovery rehearsal as a launch requirement. Preserve a
fresh private copy at rollout and the legacy sheet; handle recovery if needed.
Version 8 fixes multiline-notes display and adds complete server-template plus
browser startup timing; hosted startup diagnosis remains open. A local headless
run with 496 groups / 612 copies initialized in 49-94 ms, with two animation
frames reached in 84-141 ms. This excludes Google/server/network time and does
not establish hosted latency. Startup measurement logs and the in-notice copy
control are only in the isolated bundle, not the normal preview.

The reusable isolated templates are in `tools/rehearsal/`; actual destination
configuration stays in ignored staging. Local tests use fake services:

```powershell
node --test tests/rehearsal.test.cjs tests/rehearsal-hash.test.cjs tests/rehearsal-read.test.cjs
node tests/rehearsal-browser.cjs
```

The browser test needs the same external Playwright setup described below. It
checks actual generated app code without sending anything to Google. No backup
restoration or production activation has been performed.

Pending review preview (October 9): **Review Changes > Show pending changes**
opens a temporary Groups view of draft values. Back occupies the existing Clear
position and restores the earlier browse mode, filters, selection, and scroll,
including a return through Away or Missing Stickers. **Save All Changes** in the
popover applies all pending miniature work in this page together, not just
filtered results. Invalid groups block the batch; unfinished list forms stay
separate. These are browser-only changes, not a connection to the real writer.
The title's back arrow is an additional exit. When empty, the menu simply says
No pending edits; the preview warning lives in the page header rather than being
repeated below the buttons.
See the saving-phase checklist above.

## A Short Feedback Session

1. Confirm 612 miniatures, 496 groups, and 19 away before editing. Use the Away shortcut and check a miniature's actual current location against the old tracker.
2. Change its location, apply Save, then reload. The original checked-out destination must return. Try creating or deleting a temporary group and repeat the reload check.
3. Test search, Groups/Individuals, and a long Set name. In Edit, check that Home excludes temporary destinations while Current Location includes them. Report the browser width and steps if something feels wrong.

No need to review everything at once. Screenshots plus what you expected and
what actually happened are enough for the next small iteration.

### Pending Review Feedback

1. Edit a group, close it without saving, and change a different group's current
   location. Open Review Changes > Show pending changes. Both groups should be
   present, including the proposed name/location values rather than old values.
2. Search within pending results. Review Changes reports total groups and shown
   groups separately; Save All always covers the total. Show all pending resets
   temporary narrowing. Back instead restores the original browse setup.
3. Leave a new group incomplete, then review pending work. Save All is disabled;
   Review opens the problem field. Correct or Discard that draft. Other groups'
   valid drafts must remain untouched until explicitly saved.
4. Save one group, then try Save All. Saved rows leave the review list but their
   inspector stays open. The last save leaves All changes saved and Back. Reload
   restores the imported snapshot, because this is still a preview.

### Manage Lists Feedback

After uploading the current source, open **Lists** beside Dashboard. On narrow
screens it lives inside **Collection**. This is a preview, not durable saving.

1. Open Lists while editing a miniature. Switch categories, search a long Set
   name, then use Done or Escape. The page should not shift, and your miniature
   draft and selection should remain intact. Desktop usage counts share the
   name's line so more choices fit; narrow phones retain readable stacked text.
2. Add a temporary Set. It should appear in the miniature dropdown without being
   selected for you. Discarding the miniature draft should not remove that Set.
3. Rename a used choice. Existing assignments should update without making the
   miniature draft dirty. Remove choice stops future selections rather than
   clearing existing values. Change its last assignment, clear any active filter
   for that value, and verify it disappears from filters. Undo removal makes it
   available again without reverting the miniature changes you just made.
4. Try a current-location-only choice, then enable its Home eligibility. The two
   dropdowns should offer it appropriately. Reload to return all data and choices
   to the imported snapshot. Neither spreadsheet is changed.

List Add/Save/Remove applies explicitly. Done/Escape retains unfinished list form
text for reopening; Cancel clears that form. Before durable saving, catalog IDs
and references still need a deliberate storage implementation.
Persistent Show removed / Restore is planned, not implemented; current Undo
lasts until reload and has no timer.

Also inspect Human Paladin of the Oath of Vengeance (Invisible), or another long
name. Its title should slowly scroll after a two-second pause, pause at the end,
and reset. Edit/Close, the status icon, and the field grid must remain inside the
sidebar. Edit uses the ordinary name input; reducing motion disables scrolling.

Ready/missing-count badges are now a compact green check or amber exclamation
mark. Hover, keyboard-focus, or tap the icon for its explanation, including which
descriptive fields are missing and how many copies in the group need stickers.
Escape or an outside click dismisses only that
explanation; a second tap also closes it. Unsaved remains a separate badge. The
icon should not move buttons, change header height, or change width between states.

Quickling's blank Race now reads **Not entered**, in amber, instead of n/a. Open
Edit to confirm it remains blank. Explicit n/a and Not specified are separate
choices, not placeholders; filtering for either must not include unanswered
values. A missing number for a named Set is also called out in the Set value.
These labels must not change card/header heights or populate fields on Discard.

Under **More > Record status**, select **Incomplete** to find missing details or
stickers, or **Complete** to find records without those omissions. Stickers stays
separate for targeted sticker work. In Groups, any unresolved copy makes its group
incomplete; in Individuals, the criterion checks that copy plus shared details.
The inspector's icon always describes the whole group. Both/neither status
selected shows any status. Saving the last correction removes the entry from an
Incomplete view while keeping its inspector open; drafts do not change results.
Explicit n/a stickers, unpainted/in-progress minis, and away copies are not missing
data. Use Clear or collection-shortcut Back to reset/restore the usual filters.

### October 8 Storage And Sticker Checks

- In preview, delete a group and reuse one of its stickers in another existing
  or new group. Save should succeed; the deleted group must stay out of counts
  and search. Reload still restores the imported baseline.
- Try Review Changes > Undo deletion after reusing that sticker. An inline
  explanation should keep both records untouched. Clear/change the reused
  assignment and apply Save, then retry Undo; original IDs and drafts return.
  Active parked drafts also prevent a conflicting restore until changed/discarded.
- The reader now recognizes existing columns by header, regardless of order.
  Required header names are still exact; missing/duplicate/unknown headers fail
  safely. Tests rearrange local copies of all four tables, so no spreadsheet
  edits are needed to verify this. Historical import tooling remains strict
  about layout and must not be used to overwrite reordered storage tabs.

## Optional Automated Checks

The regression suite runs the local Apps Script template in headless Chrome.
It does not connect to a spreadsheet or change any deployment. Node.js and Chrome
must be installed. Install test tooling outside the app repository once:

```powershell
npm install --prefix "$env:TEMP\ppq-mini-tests" playwright
```

Then run from this repository:

```powershell
$env:PLAYWRIGHT_MODULE = "$env:TEMP\ppq-mini-tests\node_modules\playwright"
node tests/regression.cjs
git diff --check
```

The suite checks safe data embedding, location resets/saves, frozen desktop
columns, keyboard focus, pending edits, sort/filter behavior, narrow-screen
table scrolling, reduced-motion marquee behavior, and browser script errors.
It does not test authenticated Apps Script hosting or real spreadsheet writes.

Additional integration checks (the actual-data preview requires the ignored local
snapshot/readback files captured during import):

```powershell
node --test tests/import.test.cjs tests/storage.test.cjs tests/persistence.test.cjs tests/persistence-adapter.test.cjs tests/save-flow.test.cjs
node tests/import-preview.cjs
node tests/save-flow-browser.cjs
```

The persistence suite is local and service-free. It simulates Save/Create,
location changes, deletion/restoration, list changes, stale tabs, and repeat
requests. If `.local/import/import-readback.json` exists, it also rehearses the
candidate storage format using that saved snapshot; otherwise that check is
explicitly skipped. It never connects to Google or writes spreadsheet data.

The adapter suite simulates lock contention, failed reads, rejected batches,
committed-but-lost responses, identical-request replay, reordered rows/columns,
grid expansion, and literal formula-looking text. It verifies targeted cell
patches preserve unrelated values and formatting. October 9 result: all 222
import/storage/domain/adapter checks passed, including the optional full imported
collection rehearsal. These local checks did not prove Google service behavior,
authorization, quotas or backup recovery. Hosted results follow below; backup
recovery is untested and, by later owner decision, not a launch requirement.

The save-flow tests cover asynchronous acknowledgment, draft retention, retry
receipts, atomic batches, three-way field/copy conflict review, list independence,
deletion recovery and unchanged panel geometry. The browser suite uses a test-only
inspection hook enabled only by its locally supplied `saveTestMode` state. Neither
the simulator nor that hook accesses Sheets or stores drafts across reloads.

Latest local results: 321 unit checks, all 100 regression scenarios (initial run
plus continuation and targeted follow-up), 16 imported-preview checks, 19 save-flow
checks and 18 storage-bridge browser checks passed. The latter include reload
recovery and the owner's D11-first sticker rule. Desktop/phone recovery screenshots
were inspected. Thirteen isolated-writer browser checks now pass,
including consent gating, Save All, actual-wrapper reload, and retry behavior.
The private writer's first Google-hosted note save/reload now passes, confirmed
by the owner and bounded spreadsheet readback. Later location writes persisted
but confirmation was unreliable until version 6. Version 7's compact reader is
locally verified against a fresh capture; the owner now reports approximately
2-3-second saves and 7-8-second startup. The owner has also exercised Save All,
copy addition/removal, group deletion, lists, deleted-group restoration and
two-tab conflicts. Version 8 fixes multiline notes and adds startup diagnostics.
All 323 unit tests, 15 rehearsal browser checks and four focused preview checks
passed; desktop/mobile note screenshots were inspected. Deployment readback is
owner-only and original app content/deployments remain unchanged. Remaining work
is hosted startup diagnosis, any targeted coverage gaps and a lightweight,
explicitly approved rollout with a fresh workbook copy. A recovery rehearsal
is not required. The main app remains read-only.

Version 9 corrects the notes behavior after owner feedback: group notes expand
downward and wrap, with no marquee even for a long single paragraph. Individual
sticker notes keep the established one-line marquee. Fifteen rehearsal browser
checks and four focused preview checks passed, including save/reload, blank
lines, CRLF, long unbroken text, escaping and desktop/mobile table geometry.
Screenshots were inspected; startup and persistence code are unchanged.

Version 10 targets the measured template-generation bottleneck, not the save
path. Build-time asset assembly produces byte-for-byte identical page HTML for
the existing 496-group / 612-copy snapshot (apart from the appended timing report).
All 328 unit tests and 16 rehearsal browser checks passed, including script-like
text, literal replacement markers, missing/duplicate snapshot slots, denied access,
consent, Save All and fresh reloads. Original app content/deployments and the root
clasp target are verified unchanged; no workbook writes or Git push occurred.
The iframe numbers do not measure Google's outer page. This local verification
was subsequently superseded by the hosted failure below.

**Version 10 rollback:** The owner received `RENDER_FAILED`. That code means the
collection read succeeded but one of the subsequent page-building steps threw;
the handler did not retain the underlying exception. It does not prove a specific
parser, marker or data issue. Restored the existing private deployment and HEAD
to owner-confirmed version 9, and reverted only the assistant's static-render
changes locally. All 13 generated app files match version 9 by hash. The failed
version remains preserved for investigation. All 325 unit tests and 16 rehearsal
browser checks pass on the restored path. Remote verification confirms owner-only
access, the original app unchanged and the root clasp target unchanged. No sheet
writes, reset, data restore, Git commit or Git push occurred. The owner subsequently
confirmed that the restored app reloads successfully. This confirms recovery of
loading, not a new performance measurement. Do not deploy another render guess
over the working app.

**Isolated startup investigation:** Diagnostic versions 11/12 use a separate
owner-only URL in the rehearsal project. They include no collection reader,
writer or save RPC; all test data is synthetic. After publishing each diagnostic,
remote HEAD was restored to version 9, and the working deployment remained on 9.
The owner ran version 11: the old static path failed at snapshot insertion because
`HtmlOutput.getContent()` returned zero snapshot slots. Reading the unprocessed
template first avoided the failure. That run measured 317/302 ms for the working
template, 35 ms for raw-then-create, and 31 ms for a single-print template. These
are synthetic construction times, not end-to-end startup or guaranteed savings.
Even the working output differed from unprocessed source, so version 12 compares
alternatives directly against the working output and adds manual assembly using
the original per-asset read path. At that checkpoint, local checks:
338 tests (including 13 probe checks with desktop/mobile copy-button coverage) and
16 rehearsal browser checks passed. Root app/deployments and all sheets unchanged.

**Version 14, startup fix confirmed:** Probe 13 resolved the five-character
difference from the working output: five extra newlines after closed script/style
tags, outside all executable code, styles and embedded data. Raw-template
construction took 35 ms versus 258/268 ms for baseline construction in that
synthetic run. The private app now reads `FastIndex` through `getRawContent`,
inserts serialized data before HTML processing, and falls back to the unchanged
v9 `Index` template if reading, slot checking or output construction fails.
Fallback diagnostics record only the stage, never full HTML/error contents.
All 344 tests and 16 rehearsal browser checks pass, including forced fallback,
script-like notes, literal replacement markers and normal save/conflict flows.
The generated fast page matches the hosted probe by hash; all 12 other existing
files and the save RPC remain identical to v9. Only Code rendering changed and
FastIndex was added. Verified deployment 14 is owner-only; original deployments,
content and root clasp target remain unchanged. No spreadsheet writes or Git push.
The owner then supplied a successful actual-app report: `raw-template`, 6 ms page
read + 24 ms construction, 1,196 ms server total, 961 ms sheet read, 127 ms app
ready / 226 ms first frames. Record this as the real-load confirmation, not
another required save rehearsal. The isolated non-writing diagnostic remains on
version 13 at its separate URL. Timing evidence is saved in ignored
`load-timing-v14.json` and `render-probe-owner-result-v11/v12/v13.json`.
