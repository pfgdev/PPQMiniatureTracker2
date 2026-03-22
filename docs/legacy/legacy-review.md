# Legacy Review

## Current understanding

The old system appears to use a spreadsheet as both database and UI, with Apps Script providing the business logic.

The important model split seems to be:

- One row in `Entry Form` represents a miniature definition or stock record.
- One row in `Master Inventory` represents one physical miniature copy.
- `Root ID` identifies the miniature definition, such as `048-SPIFOLFIG`.
- `Mini ID` identifies an individual copy, such as `048-SPIFOLFIG-01`.
- `Check Out Minis` is a task-oriented interface for inspecting one `Root ID` and changing the current location of each physical copy.

That is a strong foundation for the new app, because it means the legacy logic is already close to a normalized data model even if the spreadsheet UI is not.

## Inferred sheet responsibilities

### `Entry Form`

Source of truth for miniature-level attributes and desired quantity.

Confirmed by user, this sheet stores at least:

- `Root ID`
- `Name`
- `Quantity`
- `Home Location`
- `Size`
- `Creature Type`
- `Sex`
- `Race`
- `Role`
- `Paint`
- `Set`
- `Set #`
- `Notes`

The script starts reading data rows at spreadsheet row `6`.

Confirmed location details:

- `Root ID` is hidden in column `B`
- `Name` is column `C`
- `Quantity` is column `D`
- `Race` is column `J`
- `Role` is column `K`
- `Home` is column `M`
- `Paint` is column `O`
- `Set` is column `P`
- `Set #` is column `Q`
- `Notes` is column `S`

### `Master Inventory`

One row per physical miniature copy.

Confirmed by screenshot and user notes, this sheet stores at least:

- `Mini ID`
- `Root ID`
- `Mini Number`
- `Sticker`
- `Current Location`
- `Home Location`
- duplicated descriptive fields such as `Name`, `Size`, `Creature Type`, `Sex`, `Race`, `Role`, `Paint`, `Set`, `Set #`, and `Notes`

This is the most important operational table for the new app.

Confirmed location details:

- `Mini ID` is column `B`
- `Root ID` is column `C`
- `Mini #` is column `D`
- `Sticker` is column `E`
- `Current Loc` is column `G`
- `Name` is column `I`
- `Quantity` is column `J`
- `Home` is column `P`
- `Paint` is column `Q`
- `Set` is column `R`
- `Set #` is column `S`
- `Notes` is column `T`

### `Check Out Minis`

A working screen for:

- showing one selected miniature group
- listing the locations of up to 12 individual copies
- changing one or many locations
- resetting pending edits
- setting all shown copies back to home

The old interface uses hard-coded cell ranges to drive this screen.

Confirmed UI behavior from screenshots and user notes:

- `Open Details` populates a left-side detail panel after a short delay
- the detail panel shows the miniature's shared data plus `Home`, `Available`, `Total`, and `Checked Out`
- the mini locations area shows sticker labels for individual physical copies
- `Available` is conditionally formatted for all, some, or none available
- unsaved location edits are highlighted before submit
- the first per-copy location option is `Return Home`

### `Sticker Assignment`

Specialized, but clearly useful operational tooling.

Used to:

- assign sticker values to mini records
- remove sticker values by sticker code

Confirmed UI behavior:

- new individual copies appear in a `Minis Needing Stickers` staging area
- sticker choices are selected in dropdowns and committed with `Apply Stickers`
- currently assigned sticker mappings are shown in an `Assigned Stickers` section
- sticker removal is handled through an `Unassign Stickers` section and `Remove Stickers` button
- duplicate staged sticker selections are highlighted in red by conditional formatting

### `Deleted Minis`

Audit-style log of inventory rows removed when quantity is lowered.

## Inferred workflows

### 1. Sync entry form into inventory

`syncMasterInventory()` does three main things:

- assigns missing `Root ID`s on `Entry Form`
- creates missing physical-copy rows in `Master Inventory` until copy count matches quantity
- removes excess physical-copy rows when quantity is lowered

It then refreshes the `Check Out Minis` root-id list.

### 2. Generate identifiers

`generateRootID(name, uniqueNum)` builds:

- a zero-padded numeric prefix, based on the max existing root-id number
- an abbreviation from the first 3 words, first 3 letters each

Example:

- `Spirit Folk Fighter` -> `048-SPIFOLFIG`

Each physical copy then becomes:

- `048-SPIFOLFIG-01`
- `048-SPIFOLFIG-02`
- and so on

### 3. Open detail view for a miniature group

`onEdit(e)` watches `Check Out Minis` column `I`.

When a row is set to `Open Details`, it:

- clears the editable location cells in the detail panel
- clears other `Open Details` selections in column `I`
- loads the selected root-id's current locations into the detail panel

### 4. Reset pending location changes

`resetMiniLocations()` reloads the detail panel from the current sheet data.

This appears to discard unsaved edits in the detail panel.

### 5. Submit location changes

`submitMiniLocations()` reads a fixed set of 12 mini-id and location cell pairs.

For each pair:

- it finds the matching `Mini ID` in `Master Inventory`
- replaces `<Return Home>` with the stored home location
- writes the new current location back to `Master Inventory`

### 6. Set all shown copies to home

`setAllHome()` fills the editable location cells with each copy's home location without submitting yet.

### 7. Apply and remove stickers

Sticker logic is isolated enough that we can likely keep it out of the initial rebuild unless you consider it core.

The user also confirmed that stickers are per-copy, tied to physical labels on individual miniatures, and should not live on the `Entry Form` record.

## What looks solid

- The distinction between miniature template records and physical-copy records is good.
- The identifier strategy is simple and human-readable.
- Quantity sync is conceptually correct.
- Per-copy movement is the right model for your use case.
- The old checkout screen is basically a prototype for a proper detail view in the web app.
- The sticker-first copy identification is already useful inside the detail panel.
- The sticker assignment sheet already captures an important real-world workflow that should not be lost.

## Fragile or inconsistent parts to confirm

These are the main places where the legacy script looks ambiguous or spreadsheet-coupled.

### Column index drift

There are conflicting comments and indexes around home/current location fields.

Examples:

- `syncMasterInventory()` reads `row[12]` and comments it as both column `Q` and column `M` in different places.
- `submitMiniLocations()` reads home location from `masterData[i][14]`, which is column `O`, but the confirmed `Home` column in `Master Inventory` is `P`.
- `setAllHome()` reads home location from `masterData[i][15]`, which is column `P`, so the code seems right there even though the comment still says column `O`.
- `removeExcessMiniatures()` logs previous location from `deletedMini[5]`, which is column `F`, while the confirmed `Current Loc` column is `G`.

This is the single biggest thing we need from you to verify using real sheet headers.

### Hard-coded UI ranges

The checkout UI depends on specific spreadsheet cells:

- action dropdowns in column `I`
- detail root id in `C4`
- editable location slots in `B24:E24`, `B27:E27`, `B30:E30`
- mini-id helpers in `AI2:AI13`

This is spreadsheet UI plumbing, not business logic. We should not carry this structure into the web app.

### Update range bug risk

`updateCheckedOutLog()` clears `G2:G` but writes values starting at row `1`.

That may overwrite a header or produce an off-by-one mismatch.

### Partial detail hydration

`populateMiniLocations()` only writes locations into the visible detail cells.

The associated mini ids seem to live elsewhere, probably via formulas or helper cells in `AI2:AI13`.

That means some critical behavior is still encoded in the sheet, not in Apps Script alone.

### Search limitation

The user identified a real workflow gap in the old UI:

- if they start from a physical sticker or a miniature found in a drawer, they cannot easily open the correct detail view directly
- they often need to look up the miniature in `Master Inventory` first and then navigate back by official name

This should be a first-class design improvement in the web app.

### Duplicate sticker risk is only visually guarded

The legacy sheet warns about duplicate staged sticker assignments via conditional formatting, which is helpful but not sufficient as a true data-integrity rule.

The rebuild should enforce sticker uniqueness in write logic.

### Deletion behavior

When quantity is reduced, `removeExcessMiniatures()` deletes the last matching inventory rows it finds.

That implies a deletion policy of "last rows added are deleted first." If that was intentional, we should preserve it. If not, we should define a better rule in the rebuild.

## Proposed migration shape

For the new app, the cleanest first version is:

1. Keep Google Sheets as the data store.
2. Stop using sheet cells as UI state.
3. Build an HTMLService web app with explicit server functions for reads and writes.
4. Create a small sheet access layer with named schemas instead of magic column indexes.
5. Rebuild the core workflows first:
   - search/list mini groups
   - view group details
   - search by sticker or location
   - move individual copies
   - return copies home
   - adjust quantity
   - create new miniature record
   - assign and unassign stickers safely

## Questions to answer next

Please confirm these before we lock the new data contract.

1. What are the exact columns, in order, for `Entry Form`?
2. What are the exact columns, in order, for `Master Inventory`?
3. In `Master Inventory`, which column is the true `Current Location`?
4. In `Master Inventory`, which column is the true `Home Location`?
5. Are `Available`, `Checked Out`, and `Total` stored columns or formulas?
6. Are the mini ids in `AI2:AI13` generated by formulas on `Check Out Minis`?
7. Is the deletion rule "remove highest mini number / newest copies first" intentional?
8. Is sticker support required in v1, or can it wait?
9. For v1, which workflows are mandatory on day one?
10. Are `Available`, `Total`, and `Checked Out` formula-driven on `Check Out Minis`, or should we treat them as computed values from `Master Inventory` in the rebuild?

## Best next artifact from you

The most valuable next thing you can provide is a column map.

Ideal format:

- sheet name
- column letter
- column header
- whether it is user-entered, formula-driven, or script-managed

Even screenshots of just the sheet headers would help if that is faster.
