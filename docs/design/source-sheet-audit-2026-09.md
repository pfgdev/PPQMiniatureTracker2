# Source Sheet Audit

Read-only inspection on 2026-09-07.

**Current status:** the [approved October 7 integration](collection-preview-integration-2026-10-07.md)
copied the verified data into 2.0 after backups. The old source remains unchanged.
The new app source is a no-save preview, awaiting clasp upload.

**Updated import reference:** the [October 7 fresh audit and dry run](import-dry-run-2026-10-07.md)
reread the live source, confirmed the counts below, captured complete catalogs,
and documented exact candidate tables and six preserved warnings. The September
inspection below remains historical context. Neither audit changed a spreadsheet.

Source: [PPQ Miniature Tracker](https://docs.google.com/spreadsheets/d/1mGipFEfW--whXnmIPyW9i9Y8eo4pyKezSooOVacO2_4/edit).

## Confirmed Inventory

| Check | Result |
| --- | --- |
| Definition rows in Entry Form | 496, rows 6-501 |
| Physical-copy rows in Master Inventory | 612, rows 2-613 |
| Sum of definition quantities | 612 |
| Assigned sticker codes excluding n/a | 555 |
| Literal n/a stickers | 57 |
| Blank stickers | 0 |
| Copies away from their stored Home | 19 |
| Location choices in Data Lists column S | 71 unique values |
| Duplicate Root IDs | 0 |
| Duplicate copy IDs | 0 |
| Duplicate assigned sticker codes | 0 |
| Copies with missing parent definitions | 0 |
| Per-definition quantity/copy-count mismatches | 0 |
| Blank current locations | 0 |
| Home/current locations absent from location list | 0 |
| Differences in shared fields between entries and copies | 0 |

Counts come from populated record IDs/names, not allocated sheet row counts.
Duplicate sticker checks exclude n/a, which intentionally appears multiple times
in the existing values. Its intended business meaning still needs confirmation.

## Structure And Integration Implications

- Entry Form row 5 contains headers; data starts at row 6. Root ID is B, Name C,
  Quantity D, Size F, Creature Type G, Sex I, Race J, Role K, Home M, Paint O,
  Set P, Set # Q, Notes S.
- Master Inventory row 1 contains headers; data starts at row 2. Copy ID is B,
  Root ID C, Mini # D, Sticker E, Current Loc G. Shared attributes occupy I:T.
- Inspected Master Inventory I2/I3 formulas look up Entry Form by Root ID and
  spill shared attributes across the row. I1 generates shared headers through a
  formula. Do not write a whole expanded copy row over these formula outputs.
- Master Inventory Quantity repeats the group's quantity; it is not a per-copy
  count. Count rows by unique copy ID instead of summing that column.
- The existing Notes in Master Inventory matches group Notes for every copy.
  No dedicated individual-note column exists among the populated headers; no
  populated values were found beyond column T in the bounded inventory read.
  Individual notes need separate storage and must not replace shared Notes.
- Data Lists provides canonical options and a formula-derived location list.
  The app's small hardcoded location list is only a mock fixture.
- Set # contains strings such as 4a and 5b as well as numbers. Preserve it as text
  in the app contract. There are 114 blank Set # values and 112 n/a Set values;
  current blanket completeness rules will need refinement.
- Real names and set names are longer than several mock examples. Exercise the
  existing truncation/marquee layout with actual records before retuning widths.
- Other tabs: Check Out Minis, Sticker Assignment, Deleted Minis (hidden),
  Settings (hidden), Data Lists, Checked Out Log (hidden).

## Scope Of Inspection

Read effective values across Entry Form A1:U1300, Master Inventory A1:AO1326,
Data Lists A1:AC35 and Q1:T1023. Inspected formulas and validation in small
bounded header/sample ranges. Compared each physical copy's shared fields with
its parent definition. No changes were made to spreadsheet content, permissions,
formulas, scripts, or deployments. This is not a full audit of every legacy formula.

## Destination Discovery: October 7, 2026

Read-only Drive discovery found an existing destination:
[PPQ Miniature Tracker 2.0](https://docs.google.com/spreadsheets/d/1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY/edit).

- Destination spreadsheet ID: `1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY`.
- Apps Script project ID from `.clasp.json`:
  `1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0`.
- A read-only Apps Script `projects.get` request confirmed that project's
  `parentId` equals the destination spreadsheet ID. Its title is
  `PPQ Miniature Tracker 2.0 App Script Project`.
- The workbook has one tab, `MiniatureDataTable` (`sheetId` 0), with 1,000 rows
  and 26 columns. A full allocated-range value read, A1:Z1000, returned only
  A1:D2: test0/test1/test2/test3 and testa/testb/testc/testd. There are no
  miniature records in this tab to reconcile as of this inspection.
- The app is container-bound to this workbook, but `Code.js` still builds mock
  data and has no active spreadsheet read/write layer. Being attached to a sheet
  is not the same as using its cells as storage.

The October 6 source spot-check reconfirmed Entry Form headers, sample group
values, formula-backed Master Inventory fields, and the Data Lists catalogs,
including full/assigned/unassigned sticker lists. It was not a fresh full count;
the September inventory counts above remain the earlier audit baseline.

No spreadsheet content, script source, deployment, sharing, or permissions were
changed during destination discovery. Existing clasp credentials were used only
for the metadata GET; no Apps Script function was executed.

## Working Decision

The source already holds the user's 600+ miniature inventory. There is no need
to manually paste it again just to begin integration.

The user confirmed the new app should replace the old spreadsheet workflow,
not synchronize two separately editable systems. Use the old PPQ Miniature
Tracker as the migration source and preserve it as the legacy reference/fallback.
The existing PPQ Miniature Tracker 2.0 workbook is the recommended destination;
there is no need to create a third workbook just because active storage is not
implemented yet.

Proposed sequence: back up both workbooks, refresh the complete source audit and
mapping, then build a dry-run importer targeting clean Groups/Copies/Lists/Stickers
tabs in 2.0. Preserve its existing test tab until deliberately archived; do not
erase it or copy the old spreadsheet's UI/formulas indiscriminately. Preserve
Root IDs, copy IDs, sticker strings, current locations, group Notes, and textual
Set numbers. Create individual-note storage separately. Validate counts and
relationships and make reruns safe before importing. Preview real data without
durable editing before implementing and testing the live save layer and cutover.
Do not apply mock fixture changes back to real records.

No sheet has been created, copied, or imported by this work, and active app code
still uses mock data. Future imports/writes must explicitly target the verified
destination, never infer a destination from whichever sheet happens to be active.
