# Source Sheet Audit

Read-only inspection on 2026-09-07.

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

## Working Decision

The source already holds the user's 600+ miniature inventory. There is no need
to manually paste it again just to begin integration.

User is comfortable copying data into a new sheet later if useful. Keep the old
sheet as the source while implementing a read-only adapter. Then choose between
targeted writes to the existing schema and a simpler separate working sheet for
the new app. Preserve Root IDs, copy IDs, sticker strings, and locations either way.
Do not apply mock fixture changes back to real records.

No sheet has been created, copied, imported, or connected to active app code yet.
