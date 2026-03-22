# UI Direction

## Shared references

These notes summarize the design patterns the user wants us to borrow from existing PPQ web apps.

Primary visual references:

- `PPQ Spell Scrolls`
- `PPQ Loot Chests`

## What looks worth borrowing

### From Loot Chests

- soft blue-and-cream application shell
- clean bordered panels with subtle gradients
- top action bar with filters and mode buttons
- list-plus-detail layout
- detail panel that appears alongside the list instead of replacing it
- a layout that can shift sideways to make room for detail content
- strong use of pills, status chips, and compact action buttons

### From Spell Scrolls

- a single main browsing surface with filter input at the top
- readable table/list density
- strong detail panel hierarchy with labeled content blocks
- clear separation between browse area and selected-item details

## Recommended direction for Miniature Tracker

Use a hybrid of both:

- borrow the overall color language, panel treatment, and sliding detail behavior from `Loot Chests`
- borrow the simpler, more unified browsing surface from `Spell Scrolls`

That means the miniature tracker should feel like:

- one main searchable inventory browser
- one detail panel for the selected miniature group or selected physical copy
- one consistent design system rather than a collection of one-off widgets

## Proposed layout for v1

### Main view

Top toolbar:

- global search input
- quick filters
- location filter
- availability filter
- optional button for `Add Miniature`

Primary content area:

- main inventory table/list on the left
- detail panel on the right when something is selected

Behavior:

- when nothing is selected, the list can use the full width
- when a miniature is selected, the list compresses and the detail panel slides in
- the detail panel should show group data first, then physical copy data below

### Main list

The default landing view should be optimized for browsing and movement, not data entry.

Suggested visible columns:

- `Name`
- `Home`
- `Available`
- `Total`
- `Checked Out`
- `Size`
- `Creature Type`
- `Sex`
- `Race`
- `Role`
- `Set`

Possible secondary fields can be tucked into details instead of always showing in the table.

### Detail panel

The detail panel should preserve the strengths of the old sheet sidebar:

- quick visual summary of one miniature group
- home, available, total, checked out
- notes and set information
- list of physical copies with sticker and current location
- quick actions like `Set All Home`, `Submit Changes`, and `Reset Changes`

Unlike the sheet version, the detail panel should:

- support more than 12 copies
- allow direct lookup by sticker
- make unsaved changes obvious without relying on spreadsheet coloring alone

## Design system guidance

We should build this as a reusable system, not page-specific styling.

Core reusable pieces:

- app shell
- top nav / tabs
- section panels
- filter bar
- data table
- pills and badges
- stat summary cards
- detail field groups
- editable copy rows
- modal or drawer for create/edit flows
- status banner or save indicator

## Color and state guidance

The old spreadsheet already has meaningful state colors. We should preserve the semantics while making them cleaner.

Suggested semantic states:

- available all: green
- available partial: amber
- available none: red
- unsaved edits: yellow or amber highlight
- home/default state: neutral blue/gray
- selected row: warm highlight, similar to the existing PPQ apps

## Interaction guidance

Important search paths for the new app:

- search by miniature name
- search by sticker
- search by root id
- search by current location
- search by home location

Important workflow priorities:

- browsing and moving copies should be the main landing experience
- adding new miniatures should be easy, but not the primary default view
- creation can live in a modal, drawer, or dedicated secondary flow

## Recommended v1 UX shape

If we stay disciplined, the first real app screen should probably be:

1. A searchable miniature list
2. A right-side detail panel for the selected miniature
3. A per-copy location editor inside that panel
4. A lightweight modal for creating or editing miniature definitions
5. A secondary sticker-assignment workflow

## Things to avoid

- rebuilding the spreadsheet screen literally in HTML
- scattering styles across unrelated components without shared tokens
- over-fragmenting the main inventory into too many tiny tables
- making create-entry forms the first thing the user sees

## Next implementation implication

When we start building, the CSS and component structure should be based on:

- layout primitives first
- semantic color tokens
- reusable panel and table patterns
- one coherent list/detail interaction model

That will let us borrow the best parts of the existing PPQ apps without copy-pasting page-specific UI.
