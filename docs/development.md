# Save, Upload, And Test

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
There is no deployed app writer. Backups and import evidence are recorded in
the [integration handoff](design/collection-preview-integration-2026-10-07.md).

`Persistence.js` and `PersistenceAdapter.js` are currently an **offline rehearsal
only**, excluded from clasp uploads and not called by the app. Their candidate
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
current label-based preview records and temporary IDs; mapping the UI to the
candidate-schema IDs, load baselines and real response envelope remains work
before an approved disposable-sheet rehearsal.

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
collection rehearsal. Real Google service behavior, authorization, quotas and
backup recovery still require a separately approved disposable-sheet rehearsal.

The save-flow tests cover asynchronous acknowledgment, draft retention, retry
receipts, atomic batches, three-way field/copy conflict review, list independence,
deletion recovery and unchanged panel geometry. The browser suite uses a test-only
inspection hook enabled only by its locally supplied `saveTestMode` state. Neither
the simulator nor that hook accesses Sheets or stores drafts across reloads.

Latest local results: 235 unit checks, all 100 regression scenarios (full run plus
targeted continuations), 16 imported-preview checks and 14 save-flow browser
checks passed. Desktop/phone feedback screenshots were inspected. No deployment
or live spreadsheet save has been tested or enabled in this slice.
