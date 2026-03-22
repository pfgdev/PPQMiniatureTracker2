# Legacy Sheet Schema

## Entry Form

Purpose:

- One row represents a miniature definition shared by all physical copies.
- This is where global data is entered before syncing into `Master Inventory`.
- If quantity is greater than `1`, each physical copy still shares the same miniature-level metadata from this row.

Behavior confirmed by user:

- Column `B` stores the `Root ID` and is normally treated as a hidden/script-managed field.
- `Root ID` is generated when missing after pressing the `Submit to Inventory` action on this screen.
- Example root ids include values like `002-ARC` for `Archmage`.
- Lowering `Quantity` may cause individual copy rows to be deleted from `Master Inventory`.

Confirmed by screenshot:

- The visible table headers are `Root ID`, `Name`, `Quantity`, `Size`, `Creature Type`, `Sex`, `Race`, `Role`, `Home`, `Paint`, `Set`, `Set #`, and `Notes`.
- The earlier handwritten column map was slightly off: `Race` is in `J`, and `Role` is in `K`.

Confirmed columns:

| Column | Field | Notes |
| --- | --- | --- |
| `B` | Root ID | Hidden, script-managed identifier for the miniature definition |
| `C` | Name | Miniature name |
| `D` | Quantity | Controls how many individual copy rows exist in `Master Inventory` |
| `E` | Blank | Formatting spacer |
| `F` | Size | Examples: `Small`, `Medium`, `Large`, `Huge`, `Gargantuan` |
| `G` | Creature Type | Examples: `Humanoid`, `Fey`, `Monstrosity` |
| `H` | Blank | Formatting spacer |
| `I` | Sex | Examples: `Female`, `Male`, `N/A` |
| `J` | Race | Usually blank if not humanoid |
| `K` | Role | Examples visible in screenshot: `Melee`, `NPC`, `Tank`, `Spellcaster` |
| `L` | Blank | Formatting spacer |
| `M` | Home | Default drawer or storage location |
| `N` | Blank | Formatting spacer |
| `O` | Paint | Boolean checkbox for painted vs. unpainted |
| `P` | Set | Product line or set name, or `N/A` |
| `Q` | Set # | Blank if no set applies |
| `R` | Blank | Formatting spacer |
| `S` | Notes | Freeform descriptive notes |

Known but not yet confirmed:

- whether any additional fields exist beyond `S`

## Sticker System

Purpose:

- Physical stickers on the miniatures map real-world copies to spreadsheet records.
- This solves the problem of not knowing a copy by its generated id alone.

Confirmed behavior:

- Stickers are assigned per physical miniature copy, not per `Entry Form` row.
- Sticker information is handled outside `Entry Form`.
- A separate sticker assignment sheet is used to record the sticker attached in real life.
- Example: a physical copy might have a real sticker like `C29`, and that sticker is then associated with the correct inventory row in the spreadsheet.
- Stickers remain visible in assignment dropdowns until the user actually clicks `Apply Stickers`.
- Conditional formatting warns if the same sticker is accidentally staged for more than one entry before apply.

Implication for the rebuild:

- Sticker should live on the per-copy record in `Master Inventory`, not on the miniature definition record.

## Master Inventory

Purpose:

- One row represents one physical miniature copy.
- This is the operational per-copy inventory table used for tracking sticker assignment and current location.
- Much of the descriptive data appears to be copied or populated from `Entry Form`, while copy-specific fields live directly on this sheet.

Behavior confirmed by user:

- `ID` is the unique per-copy identifier based on `Root ID`, with suffixes like `-01`, `-02`, and so on.
- `Mini #` is another representation of that copy number and matches the numeric suffix in `ID`.
- `Sticker` is column `E` and each sticker is unique to one physical copy.
- Sticker values follow a physical labeling system such as `A00-A99`, `B00-B99`, and so on.
- `Current Loc` is column `G` and stores where the physical miniature currently is.
- Most miniatures are normally in `Home`, but `Current Loc` may differ when they are checked out or moved.

Confirmed columns from screenshot:

| Column | Field | Notes |
| --- | --- | --- |
| `B` | ID | Unique per-copy id, such as `001-BER-01` |
| `C` | Root ID | Shared miniature-definition id |
| `D` | Mini # | Per-copy number, corresponds to `-01`, `-02`, etc. |
| `E` | Sticker | Unique physical sticker code |
| `F` | Blank | Formatting spacer |
| `G` | Current Loc | Current physical drawer or storage location |
| `H` | Blank | Formatting spacer |
| `I` | Name | Copied or populated from `Entry Form` |
| `J` | Quantity | Appears to be `1` for each per-copy row |
| `K` | Size | Copied or populated from `Entry Form` |
| `L` | Creature Type | Copied or populated from `Entry Form` |
| `M` | Sex | Copied or populated from `Entry Form` |
| `N` | Race | Copied or populated from `Entry Form` |
| `O` | Role | Copied or populated from `Entry Form` |
| `P` | Home | Default storage location |
| `Q` | Paint | Copied or populated from `Entry Form` |
| `R` | Set | Copied or populated from `Entry Form` |
| `S` | Set # | Copied or populated from `Entry Form` |
| `T` | Notes | Copied or populated from `Entry Form` |

Likely implications:

- `Home` is stored directly on each per-copy record in addition to the source value on `Entry Form`.
- The web app should treat `ID`, `Sticker`, and `Current Loc` as copy-specific fields.
- The web app should treat the descriptive fields as shared definition data, even if they are duplicated into `Master Inventory` for convenience.

## Check Out Minis

Purpose:

- Provides a worksheet-based operational UI for viewing one miniature group and changing the location of individual physical copies.
- Combines a list view and a detail panel in the same sheet.

Confirmed interaction model from screenshots and user notes:

- Each miniature row has a dropdown action in the `Check In/Out` column with options including `Open Details` and `Clear Details`.
- Choosing `Open Details` populates the left-side detail panel after a short delay.
- The detail panel shows the shared miniature-level data:
  - `Name`
  - `Root ID`
  - `Size`
  - `Creature Type`
  - `Sex`
  - `Race`
  - `Role`
  - `Paint`
  - `Set`
  - `Set #`
  - `Notes`
  - `Home`
  - `Available`
  - `Total`
  - `Checked Out`
- The lower `Mini Locations` section shows up to 12 individual copy slots.
- Each slot displays the physical copy's sticker label and provides a dropdown for selecting a location.
- The first location option for an individual copy is `Return Home`.
- `Reset Changes` discards unsaved pending location changes in the detail panel.
- `Set All Home` fills all shown copy-location dropdowns with each copy's home location without immediately saving.
- `Submit Changes` commits the changed copy locations back to `Master Inventory`.

Confirmed visual behavior:

- If all copies are available, `Available` is green.
- If some but not all copies are available, `Available` is yellow.
- If none are available, `Available` is red and shows `0`.
- Copy location dropdown cells become yellow when they contain unsaved changes.
- Individual copy rows in the mini locations section show sticker labels such as `Sticker [A12]`.

Known implementation details from legacy script:

- Action dropdowns are watched in column `I`.
- The selected `Root ID` is read from column `G`.
- The detail panel root-id helper cell is `C4`.
- The editable location slots are hard-coded to `B24:E24`, `B27:E27`, and `B30:E30`.
- Hidden or helper mini-id cells appear to live in `AI2:AI13`.

Still useful to confirm later:

- whether `Available`, `Total`, and `Checked Out` are formulas, static values, or populated by script
- whether the sticker labels in the detail panel are formula-driven from helper cells or script-written

## Sticker Assignment

Purpose:

- Provides a worksheet-based staging area for assigning stickers to newly created physical copies.
- Also provides a separate workflow for removing sticker assignments from existing copies.

Confirmed interaction model from screenshot and user notes:

- The left-side `Minis Needing Stickers` section lists individual mini copies after they are created from `Entry Form` and synced into inventory.
- Each row shows at least:
  - `ID`
  - `Name`
  - staged `Sticker`
  - `Current Loc`
- The user chooses a sticker from a dropdown for each target row.
- Nothing is committed until the user clicks `Apply Stickers`.
- The center `Assigned Stickers` section shows currently assigned sticker mappings with:
  - `Sticker`
  - `Name`
  - `ID`
- The right-side `Unassign Stickers` section lets the user select already-assigned sticker values for removal.
- The user clicks `Remove Stickers` to clear those sticker assignments from `Master Inventory`.

Confirmed safety behavior:

- Because staged dropdown values do not disappear immediately, duplicate selection is possible before apply.
- Conditional formatting highlights accidental duplicate sticker selections in red.

Implications for the rebuild:

- Sticker assignment should support batch staging and commit, not only one-at-a-time edits.
- Duplicate sticker prevention should be handled explicitly in app logic, not only visual formatting.
- The app should show both:
  - unassigned copies that need stickers
  - currently assigned sticker mappings
