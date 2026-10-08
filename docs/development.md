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

Use `clasp.cmd status` and `clasp.cmd push` if PowerShell blocks `clasp.ps1`.
Storage.js is now an application file and must be included in the upload. Google
may require spreadsheet authorization once; run `doGet` from the Apps Script
editor if authorization or loading needs attention, and inspect the execution log.
There is no app write implementation. Backups and import evidence are recorded in
the [integration handoff](design/collection-preview-integration-2026-10-07.md).

## A Short Feedback Session

1. Confirm 612 miniatures, 496 groups, and 19 away before editing. Use the Away shortcut and check a miniature's actual current location against the old tracker.
2. Change its location, apply Save, then reload. The original checked-out destination must return. Try creating or deleting a temporary group and repeat the reload check.
3. Test search, Groups/Individuals, and a long Set name. In Edit, check that Home excludes temporary destinations while Current Location includes them. Report the browser width and steps if something feels wrong.

No need to review everything at once. Screenshots plus what you expected and
what actually happened are enough for the next small iteration.

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
node --test tests/import.test.cjs tests/storage.test.cjs
node tests/import-preview.cjs
```
