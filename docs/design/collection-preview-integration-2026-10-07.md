# Collection Preview Integration: October 7, 2026

## Current Status

**Owner feedback:** the owner accepted the imported preview, requested a Git
checkpoint, and selected long-term storage/identity design as the next discussion
before permanent saving. The implementation/upload status below records the
integration pass; no additional clasp upload or schema migration accompanies that
Git checkpoint.

The one-time import into [PPQ Miniature Tracker 2.0](https://docs.google.com/spreadsheets/d/1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY/edit)
is complete and fully reconciled. The local app source now reads that workbook
and keeps all editing in browser memory. **This source has not yet been uploaded
with clasp or deployed.** The existing development page changes only after upload.
No Git push was performed.

This supersedes the preparation-only status in the
[earlier dry-run report](import-dry-run-2026-10-07.md). That document retains the
detailed source mapping and historical audit evidence.

## Owner Decisions

- Preserve all six blank fields. Correct them after permanent saving works.
- Preserve each miniature's actual current location, including checked-out copies.
- Keep Home choices separate from the larger Current Location list, which includes
  encounter boxes and other temporary destinations.
- Keep Edit, Create, Delete, copy controls, and location editing enabled. Reload
  must restore the imported baseline; these app actions cannot update a sheet.
- Treat this as a copied baseline, not synchronization with the old tracker.
- The eight test cells in 2.0 may be cleared/reused or deleted. The test tab was
  deleted only after its backup was verified and in the same batch as the import.
- The owner considers collection visibility low risk. No sharing, manifest access,
  or deployment-permission settings were changed; use the development preview
  first rather than publishing a new public version incidentally.

## Backups And Import Evidence

Created native workbook copies before writing. Metadata and all captured tab
values were read back and matched the originals:

- [Legacy workbook backup](https://docs.google.com/spreadsheets/d/1Y8mOIjLGNwRqUVsYl-bFhXRlDo9X5muLCYDYkiijROg/edit?usp=drivesdk)
- [2.0 pre-import backup](https://docs.google.com/spreadsheets/d/1_3EycQJBoOuprLer8syRTQ5M_7sulpO2D0tCq_IrBWE/edit?usp=drivesdk)

The fresh source capture completed at `2026-10-07T12:12:15.934Z`. Repeated reads
matched each other and the earlier audited snapshot. The source modification
timestamp remained `2026-09-07T17:10:02.743Z` after the import. The original
workbook was never a write target.

Destination ID: `1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY`.

| Imported tab | Sheet ID | Written range | Records |
| --- | --- | --- | --- |
| Groups | 100 | A1:L497 | 496 |
| Copies | 101 | A1:F613 | 612 |
| Lists | 102 | A1:C259 | 258 |
| Stickers | 103 | A1:B901 | 900 |

`tools/import-write-plan.cjs` generated the first-import batch only after the audit
passed and the destination still contained exactly the expected eight test cells.
It refuses existing storage tabs or changed test content, rather than overwriting.
The four new tabs, their literal string values, formatting, and removal of the
test tab were submitted in one Sheets batch. No formulas were copied into storage.

Every imported cell was read back and matched the candidate, accounting only for
the Sheets API omitting trailing blank cells. CellData reads confirmed zero
formula cells. A dry run against the actual imported destination proposed zero
additional rows and zero changes, with the same candidate hash:
`244fedd3f55dd4905725337724a207a268fbd504e1723436085ce36c4071aef8`.

Preserved results: 612 copies, 496 groups, 19 away, 555 assigned stickers, 57 n/a,
zero blank stickers, six incomplete descriptive fields, all Set # suffixes, and
all group notes. Individual notes begin blank because the legacy Notes column was
shared group information. The catalog has 345 free IDs; the first is F55.

Storage tabs use simple gray frozen headers, filters, text-formatted cells, and
bounded column widths. Formatting was verified through API readback, not an
authenticated native Sheets screenshot. Long storage-cell text is intentionally
clipped; full text remains stored and is available through the app/formula bar.

Ignored evidence under `.local/import/`:

- `integration-snapshot.json`: immediately pre-import captured source/destination.
- `approved-write-plan.json`: exact submitted batch, kept out of clasp and Git.
- `import-readback.json`: source plus verified destination ranges after import.
- `import-receipt.json`: backup links, actual write status, and reconciliation facts.
- `post-import/`: repeatable audit against the imported destination. Its
  `remoteWritesPerformed: false` describes that verification run, not the preceding import.

## App Behavior

`Storage.js` opens only the explicit 2.0 ID. It reads Groups, Copies, Lists, and
Stickers; validates headers, identities, relationships, catalog order, and location
membership; and builds the existing client state. Historical blank fields stay
blank. It does not read the old tracker or supply any write operation.

All storage helpers end in `_`. There is no client `google.script.run`, fetch, or
other save request. Save, Create, Delete, Undo, and location changes continue to
modify session memory only. No drafts, miniature changes, or preview sticker
preferences are written to local storage. Reload reconstructs state from the
imported 2.0 tabs. Direct manual edits to those tabs would change that baseline;
leave them alone during this preview phase.

The header reads **Preview: changes reset on reload**, with a fuller explanation
on click. Save tooltips explain that they apply changes only until reload. A read
or validation failure shows a retry message rather than silently loading mocks
or an empty collection. Detailed load errors go to the Apps Script execution log.

The UI now consumes the full catalog, including the 21 unused Set choices. Home
has 56 choices; Current Location has all 71. Blank, n/a, and Not specified retain
their existing distinct editing behavior. Paint remains Painted, Unpainted, and
Work in Progress.

Apply-ID reads the imported ordered sticker catalog minus applied, draft, and
Undo-reserved assignments. It starts at F55 for this baseline, ignores old mock
browser counters, and never invents a code beyond the catalog. Manual sequence
hints can still influence the current session; a reload resets them too. When a
hint has no free code after it, the search returns to remaining earlier catalog
gaps. An exhausted catalog disables Apply rather than suggesting an unlisted ID.

## Verification

- 60 Node unit/CLI tests passed: conversion, first-import request shape, read-only
  adapter, header/relationship validation, and explicit load-failure behavior.
- All 72 existing Chrome regression scenarios passed with no browser errors.
- 11 additional local real-data Chrome checks passed using the actual read-back
  storage tables. These cover counts, searches, long Set text, suffixes, preserved
  warnings, complete catalogs, separate Home choices, header geometry, load errors,
  and reload restoring saved-in-memory edits/additions/removals/deletions/stickers.
- Desktop and phone screenshots were reviewed. `git diff --check` passed.
- `clasp.cmd status` includes six app files, including the new Storage.js, and
  excludes all local snapshots, importer tools, tests, and documentation.

The Google-hosted web app and its authorization have **not** been tested with this
new adapter yet. Local tests supply the verified read-back values through a
read-only SpreadsheetApp test double. The adapter uses the built-in Spreadsheet
service, so no advanced service needs to be enabled, but spreadsheet authorization
may be required on first use. This is an application with no write implementation,
not a claim that Google grants only a narrow read-only OAuth scope.

## Next Session

1. Upload with `clasp.cmd push` after checking `clasp.cmd status`. Do not publish a
   new versioned deployment yet. Open/refresh the `/dev` test deployment.
2. If Google requires spreadsheet authorization, authorize the script as its owner.
   If the preview reports a load failure, run `doGet` in the Apps Script editor
   to complete authorization and inspect its execution log. It performs no writes.
3. Check the totals (612/496), open a checked-out copy, and confirm its destination.
   Try an edit, create, or deletion, then reload and verify the original returns.
4. Review UX with real data before adding durable saving. Preserve the six blank
   fields as cleanup TODOs for that later phase.

The remaining saving phase needs durable IDs, coherent saves across Groups/Copies,
sticker uniqueness and concurrent-edit checks, validation of app-only sentinel
choices such as Not specified, failure recovery, and an explicit access decision.
Those are not enabled or simulated as successful sheet writes in this preview.
