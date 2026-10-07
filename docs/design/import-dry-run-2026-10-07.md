# Import Preparation: October 7, 2026

**Later status:** the owner approved the mapping and removing the test tab. The
[integration handoff](collection-preview-integration-2026-10-07.md) records the
completed import, backups, full readback, and local no-save preview adapter. The
preparation-only statements below describe this earlier checkpoint.

## Outcome And Boundary

Fresh reads of the live legacy workbook produced a local migration candidate:
**496 groups, 612 physical copies, zero blocking data conflicts, six warnings.**
The source counts match September, but this audit used new online reads, not the
September report or a user-supplied export.

No spreadsheet cells, tabs, permissions, scripts, or deployments were changed.
No workbook backups were created yet. The running app still uses mock data.
This pass added local dry-run tooling, tests, and documentation, not a live writer.
No Git push or clasp upload was performed.

## Verified Workbooks

| Role | Workbook | ID |
| --- | --- | --- |
| Source | [PPQ Miniature Tracker](https://docs.google.com/spreadsheets/d/1mGipFEfW--whXnmIPyW9i9Y8eo4pyKezSooOVacO2_4/edit) | `1mGipFEfW--whXnmIPyW9i9Y8eo4pyKezSooOVacO2_4` |
| Destination | [PPQ Miniature Tracker 2.0](https://docs.google.com/spreadsheets/d/1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY/edit) | `1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY` |

The Apps Script project identified by `.clasp.json` is bound to the destination,
as verified by the earlier October 7 metadata GET. `Code.js` still calls
`buildMockAppState_()`. Being bound to a workbook does not mean its data is loaded.

The destination has only `MiniatureDataTable`, with eight test cells at A1:D2.
A full A1:Z1000 value read found no miniature records there. The candidate plan
preserves this tab and adds four separate storage tabs. It does not create a
third workbook or overwrite the test cells.

## Capture Evidence

Snapshot completed at `2026-10-07T04:11:17.462Z`. All eight source tabs were read
across their allocated grids using formatted values:

| Tab | Captured range |
| --- | --- |
| Entry Form | A1:U1300 |
| Master Inventory | A1:AO1326 |
| Data Lists | A1:AC1023 |
| Sticker Assignment | A1:Y1003 |
| Check Out Minis | A1:AK718 |
| Deleted Minis | A1:AA200 |
| Settings | A1:Z1000 |
| Checked Out Log | A1:Z1000 |

All eight value reads were repeated and matched. The source Drive modification
timestamp before and after capture was `2026-09-07T17:10:02.743Z`. These checks
give consistency evidence, not an atomic snapshot or a lock against later edits.
The connector did not return a file version, so no version-pinning claim is made.

Formula/validation evidence was also captured for Entry Form B5:S8, Master
Inventory B1:T3, Data Lists A1:AC3, Sticker Assignment J5:M8, and Check Out Minis
B23:E24. This samples the legacy mechanics; it does not audit every formula.
The snapshot is **not a complete workbook backup**: it does not preserve all
formatting, formulas, validation rules, and script behavior for restoration.

Local files are under `.local/import/`, excluded from Git and clasp:

- `source-snapshot.json`: captured values, metadata, and sample formula evidence.
- `dry-run/report.json` and `report.md`: validation results and proposed actions.
- `dry-run/candidate.json`: four proposed storage tables, not uploaded anywhere.
- `dry-run/app-state.json`: local prototype preview data, not a production state.
- `dry-run/preview-results.json`, `preview-desktop.png`, `preview-phone.png`: checks.

Snapshot SHA-256: `b2f02c9afc86ee80fb7cb2b1cabee942d070bda980faf7aef580dabe56dd93ff`

Candidate SHA-256: `244fedd3f55dd4905725337724a207a268fbd504e1723436085ce36c4071aef8`

## Reconciliation

| Check | Result |
| --- | --- |
| Definitions / physical rows / sum of quantities | 496 / 612 / 612 |
| Assigned stickers / literal n/a / blank stickers | 555 / 57 / 0 |
| Away from group Home | 19 copies |
| Duplicate group IDs, copy IDs, or assigned stickers | 0 |
| Orphan copies or per-group quantity mismatches | 0 |
| Shared-field differences between definitions and derived copy rows | 0 |
| Missing current locations or unknown catalog values | 0 |
| Populated unmapped columns in definitions or inventory | 0 |
| Pending sticker assignment/removal or checkout location differences | 0 |
| Deleted records / checkout log records | 0 / 0 |
| Painted / Unpainted / Work in Progress | 427 / 69 / 0 groups |
| n/a Sets / alphanumeric Set numbers | 112 / 13 groups |

`Settings!A1` contains `26`. Preserve it in the old workbook/snapshot; it is not
adopted as an authoritative new ID counter. Do not import legacy UI controls,
lookup formulas, or checkbox defaults as collection records.

## Proposed Storage Mapping

All candidate cells are strings. Preserve IDs and Set numbers as literal text,
including leading zeroes and suffixes such as `4a`, `5b`, and `11B`. A future
writer must use literal string cells / RAW semantics, not interpret text beginning
with `=` as a formula. App numeric calculations can convert values when reading.

### Groups: 496 Rows

One row per Entry Form definition, starting at source row 6 (headers in row 5).

| Destination field | Entry Form column | Rule |
| --- | --- | --- |
| rootId | B | Preserve identity; never derive it again from the name |
| name | C | Preserve |
| size | F | Preserve |
| creatureType | G | Preserve |
| sex | I | Preserve |
| race | J | Preserve, including blank |
| role | K | Preserve |
| home | M | Preserve; default location belongs to the group |
| paint | O | TRUE becomes Painted; FALSE becomes Unpainted |
| set | P | Preserve, including explicit n/a |
| setNumber | Q | Preserve as text, including blank |
| notes | S | Preserve shared description/notes |

Column D Quantity validates the number of physical copy rows. Do not persist
another manually editable quantity that can drift from Copies. The current
candidate does not introduce per-copy Paint; it retains the existing group model.

### Copies: 612 Rows

One row per Master Inventory record, starting at source row 2.

| Destination field | Master Inventory column | Rule |
| --- | --- | --- |
| id | B | Preserve stable internal copy ID |
| rootId | C | Preserve parent relationship |
| miniNumber | D | Preserve positive per-group sequence as text |
| sticker | E | Preserve assigned code, n/a, or blank as distinct values |
| currentLocation | G | Preserve actual location, never replace with Home |
| note | None | New, initially blank per-copy note |

Master Inventory I:T contains derived/shared group fields, not independent copy
attributes. Compare them with Entry Form for consistency, but do not duplicate
them into Copies. Its Notes column repeats group Notes; it is **not** an
individual note and must not be moved into `Copies.note`.

### Lists: 258 Rows

Columns: `field`, `value`, `sortOrder`. Preserve the source order and choices,
including options not used by any owned miniature.

| Field | Data Lists column | Choices |
| --- | --- | --- |
| size | F | 6 |
| creatureType | H | 15 |
| sex | J | 3 |
| race | L | 22 |
| role | N | 11 |
| set | O | 71 |
| home | Q | 56 |
| currentLocation | S | 71 |
| paint | App enum | 3 |

Paint order is Painted, Unpainted, Work in Progress. The source location list S
already combines Home Q and Additional Locations R; retain the combined choices
without copying its formulas. Home remains a distinct catalog from current
location. Keep the app's blank placeholder separate from an explicit value such
as n/a or Not specified; blank is not a new catalog choice.

### Stickers: 900 Rows

Columns: `sticker`, `sortOrder`. Read the authoritative catalog from Data Lists V.
It contains A00-A99, B00-B99, through I00-I99, plus an n/a sentinel. Exclude that
sentinel from consumable sticker IDs; retain n/a on the 57 copies that use it.

Compute availability as **catalog minus assigned codes**, preserving catalog
order, rather than max-used-plus-one or a browser-only counter. Assignment
comparison is case-insensitive and excludes blank/n/a. The result matches the
legacy Unassigned/Assigned outputs in W/X: **345 free codes, first F55** at this
capture. Recompute at use time; F55 is not a reservation or hardcoded default.

## Six Preserved Warnings

| Entry Form row | Group | Field | Existing context |
| --- | --- | --- | --- |
| 38 | Human Rogue Male (`033-HUMROGMAL`) | Set # blank | Icons of the Realms: Premium Figures - Wave 4 |
| 76 | Dwarf Battlemaster (`071-DWABAT`) | Set # blank | D&D 2 Player Starter Set |
| 95 | Quickling (`090-QUI`) | Race blank | Fey |
| 118 | Brigganock Miner (`113-BRIMIN`) | Race blank | Fey |
| 128 | Darkling Elder (`123-DARELD`) | Race blank | Fey |
| 129 | Darkling (`124-DAR`) | Race blank | Fey |

These do not block faithful transfer. Do not invent race values or numbers.
The two products may legitimately lack individual printed numbers. Later decide
whether completeness needs an explicit unnumbered-set rule rather than forcing
an arbitrary number or changing the Set to n/a. The four Race values can remain
blank until the owner decides their meaning. No source cleanup is required merely
to import them unchanged. Blank Set # for the 112 n/a Sets is not a warning.

## Tooling And Verification

`tools/import-core.cjs` converts and validates an already captured snapshot.
`tools/import-dry-run.cjs` writes local JSON/Markdown only. There is no network
client, Apps Script write function, or `--apply` mode in this tooling.

Validation checks verified workbook IDs, capture metadata, full grid ranges,
headers, relationships, counts, uniqueness, known options, formula error tokens,
unexpected populated columns, legacy derived values, and unapplied staging work.
Unfamiliar data blocks review instead of being silently coerced or dropped.

Destination planning uses stable identities. An identical rerun adds zero rows;
conflicting or destination-only records block rather than being overwritten or
deleted. Unrelated tabs stay untouched. This is a plan, not transactional write
implementation. A blocked or unreadable input invalidates previous output payloads.

Verification completed:

- 40 Node unit/CLI tests passed, using synthetic fixtures only.
- Actual collection dry run: zero blockers, six warnings.
- Actual-data rerun simulation: zero additions to all four tables; same candidate hash.
- Seven local Chrome preview checks passed with no browser script errors.
- Preview checked 496/612 browsing, A00 lookup, 19 away, n/a not missing, `4a`
  editing/discard, longest owned Set marquee, largest copy group, missing Race,
  and a 390px phone inspector. Desktop/phone screenshots were visually reviewed.

The browser preview injects the candidate locally into the existing mock-mode
template. It does not publish a site, read a live backend, persist edits, or prove
Google iframe/authorization behavior. No runtime app files were changed by this
import pass; it does not replace the earlier 72-scenario UI regression run.

Commands from the repository, with Node.js installed:

```powershell
node --test tests/import.test.cjs
node tools/import-dry-run.cjs --input .local/import/source-snapshot.json

# Optional browser checks; use the Playwright installation documented in development.md.
$env:PLAYWRIGHT_MODULE = "$env:TEMP\ppq-mini-tests\node_modules\playwright"
node tests/import-preview.cjs

git diff --check
clasp.cmd status
```

The dry-run command does not refresh the snapshot. Fresh capture requires online
read-only metadata/range reads, the same before/after checks, and an updated local
snapshot. The browser test also expects that local snapshot. A checkout on another
machine will not contain these ignored data files.

`.claspignore` now explicitly allows only `appsscript.json`, `Code.js`,
`Index.html`, `Scripts.html`, and `Styles.html`; `clasp.cmd status` confirmed this.
New backend application files must be added deliberately when implemented.
Use `clasp.cmd` if PowerShell blocks the installed `clasp.ps1` shim.

## Integration Details To Address Next

- Read all catalog options, not just values in owned groups. In particular,
  **21 Set choices are currently unused** and would be lost from the UI if it
  continues deriving the Set dropdown only from group data. They are in Lists.
- Preserve the separate Home/current-location catalogs (56 versus 71 choices).
  The current editor's shared location option source needs an explicit decision.
- Replace the prototype sticker hint with shared catalog availability. A stored
  preference, if retained, must be collection-scoped and revalidated against saved
  copies and drafts. The server must arbitrate simultaneous sticker assignments.
- Use stable server-generated identities for new entries. Preserve migrated IDs;
  neither the legacy Settings value nor the prototype's local IDs establishes the
  future durable identity/revision strategy.
- Define coherent group-plus-copies saves, stale-edit/conflict handling, duplicate
  validation, failure recovery, and durable deletion/Undo before enabling writes.
- Decide who may access collection data and who may change it. The current
  `ANYONE_ANONYMOUS` / `USER_DEPLOYING` manifest is not an authorization model for
  owner-authorized storage operations. No permission changes were made here.

## Suggested Next Session

1. Review this mapping and the six preserved warnings. Approval is for the
   migration structure; resolving every incomplete value is not a prerequisite.
2. Back up both workbooks, verify those backups, and refresh the source/destination
   capture before any real import. Ask the owner to pause legacy edits for cutover.
3. Implement a separately approved importer targeting the explicit 2.0 ID. Add
   storage tabs without touching the test tab. Reconcile counts, literal values,
   identities, and rerun behavior with a read-back after the actual import.
4. Add an authorized read-only development preview backed by 2.0 so the owner can
   inspect the real collection and full catalogs without durable editing.
5. Implement and test live saves/creation/deletion, shared sticker assignment,
   concurrency, failure recovery, and access control before live cutover. Retain
   the old workbook as a reference/fallback, not a second writable source of truth.

Zero dry-run blockers means the captured data can be mapped consistently. It does
not mean the production storage, permissions, or live save flow is ready.
