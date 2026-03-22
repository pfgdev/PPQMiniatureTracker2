# Legacy Workflows

## Check Out Minis flow

This is the most app-like part of the old spreadsheet.

### Open details

1. User finds a miniature row in the list.
2. User sets the `Check In/Out` dropdown to `Open Details`.
3. After a short delay, the left-side detail panel populates.
4. The panel shows shared miniature details plus operational counts and copy-location controls.

### Review availability

The detail panel summarizes current status with:

- `Home`
- `Available`
- `Total`
- `Checked Out`

Color is meaningful:

- green means fully available
- yellow means partially available or there are unsaved pending changes
- red means none are available

### Move individual copies

1. User looks at the `Mini Locations` section.
2. Each visible slot corresponds to one physical copy and shows its sticker label.
3. User changes one or more location dropdowns.
4. Unsaved changes are highlighted.
5. User clicks `Submit Changes` to write the new locations back to `Master Inventory`.

### Reset pending changes

`Reset Changes` reloads the currently selected miniature group's copy locations and discards unsaved dropdown edits.

### Send all shown copies home

`Set All Home` prefills every shown copy location with its `Home` location.

This is a staging action first, not an immediate save. The user still needs `Submit Changes`.

### Return a single copy home

Each individual copy location dropdown includes `Return Home` as the first option.

That allows one miniature to be sent back without affecting the rest.

## UX strengths

- Per-copy movement is explicit and easy to reason about.
- The sticker label is visible at the moment a copy is being moved.
- Availability status is easy to scan because of the conditional formatting.
- The workflow is surprisingly effective despite living in a spreadsheet.

## UX pain points

- The user cannot easily start from a physical sticker and open the right miniature detail view.
- To identify a mini found in a drawer, the user may need to search `Master Inventory` first and then navigate back by name.
- The detail panel is capped at 12 visible copy slots because the UI is cell-grid based.
- The current implementation has noticeable lag because spreadsheet edits trigger Apps Script and formulas indirectly.

## Rebuild opportunities implied by this flow

- Search by sticker, name, root id, or location from one unified web UI.
- Open a miniature detail view directly from a sticker code.
- Show all copies without a hard 12-slot sheet layout.
- Keep the same mental model:
  - a shared miniature definition
  - many physical copies
  - each copy has a current location and optional sticker

## Sticker assignment flow

### Assign stickers to new copies

1. User syncs new miniatures into inventory.
2. New physical copies appear in the `Minis Needing Stickers` section.
3. User chooses sticker dropdown values for one or more rows.
4. Duplicate staged choices are highlighted in red by conditional formatting.
5. User clicks `Apply Stickers`.
6. Sticker values are written onto the matching `Master Inventory` rows.

Important behavior:

- Sticker choices are staged first.
- A chosen sticker does not disappear from the dropdown list until apply happens.
- That is why duplicate-warning feedback is important.

### Remove stickers

1. User goes to the `Unassign Stickers` section.
2. User selects one or more currently assigned sticker values.
3. User clicks `Remove Stickers`.
4. The sticker field is cleared from the matching `Master Inventory` rows.

### UX strengths

- Batch sticker assignment is faster than editing `Master Inventory` directly.
- The assigned-sticker list gives a quick audit view of what is already in use.
- Duplicate-warning formatting catches a common operator mistake.

### Rebuild opportunities

- Prevent duplicate sticker staging immediately in the UI.
- Offer a "next available sticker" action instead of only dropdown scrolling.
- Allow direct lookup by sticker from anywhere in the app.
