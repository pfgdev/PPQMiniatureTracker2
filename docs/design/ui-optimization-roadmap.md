# UI Optimization Roadmap

## Purpose

This document distills the recent GPT design session into an implementation-friendly UI roadmap for `PPQ Miniature Tracker`.

It is intentionally not a rigid final spec.

Some recommendations below are strong direction.
Some are explicitly marked as experiments that may not pan out once tested in the live app.

## Current Design Identity

The app should become:

- a fast collection browser
- a sticker-aware finder
- an operations-first inspector for moving physical copies

It should not feel like:

- a gallery
- a spreadsheet clone
- a generic CRUD form
- a dashboard that gives equal weight to every field

## Core UX Principles

### 1. Operations First

When a miniature is selected, the right pane should prioritize:

- confirming identity
- understanding availability quickly
- moving or staging physical copies

Mini taxonomy and collector metadata are still useful, but they are secondary.

### 2. Search First

The left pane should behave like a finder, not a spreadsheet.

Primary goals:

- find by name
- find by sticker
- find by location
- narrow by a few useful filters

### 3. Physical Copies Are The Working Surface

The `Physical Copies` section is the heart of the selected-state experience.

That section should eventually sit above most metadata and be clearer about staged changes.

### 4. Calm Utility Styling

Mini Tracker should feel more mature and less decorative than Loot Chests.

Keep:

- soft blue shell
- pills and state colors
- strong dark table headers
- compact action styling

Reduce:

- decorative gradients on major surfaces
- equal-weight boxed cards for every field
- “container inside container” feeling

## Visual System Recommendations

### Major Surface Treatment

Recommended direction:

- remove gradients from major section headers and large surfaces
- use flat pale surfaces plus borders and spacing for hierarchy

Suggested major fills:

- app background: `#EEF3F9`
- panel background: `#F7FAFD`
- section/header background: `#EAF2F7`
- input background: `#FFFFFF`

### Font Stack

Preferred:

```css
Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif
```

If `Inter` is not loaded, system UI is acceptable.

### Type Scale

- app title: `22px / 700`
- section title: `16px / 700`
- subsection title: `14px / 700`
- table header / field label: `11px / 700`, uppercase, `letter-spacing: 0.06em`
- body / table cell: `14px / 500`
- important value: `18px / 700`
- helper text: `12px / 400`
- button text: `13px / 600`
- pill text: `12px / 700`

### Spacing Scale

Use an 8px rhythm:

- `4`
- `8`
- `12`
- `16`
- `20`
- `24`
- `32`

### Radius

- panels: `12px`
- inputs: `10px`
- buttons: `10px`
- pills: `999px`

### Border / Shadow

- default border: `1px solid #C7D5E5`
- soft border: `#D8E2EE`
- minimal elevation only where needed:

```css
0 1px 2px rgba(23, 42, 79, 0.08),
0 4px 12px rgba(23, 42, 79, 0.06)
```

Avoid shadowing every card.

## State Color Tokens

### Base

- primary text: `#18314F`
- secondary text: `#5E7391`
- table header blue: `#445D93`
- primary action blue: `#3F6FCC`
- primary action hover: `#315DB2`
- secondary action background: `#E9F0F8`
- secondary action text: `#27446B`

### Status

- success / ready: background `#DDEFD8`, border `#B9D9B0`, text `#2F6A3A`
- warning / partial: background `#F7E4B5`, border `#E8CB7E`, text `#8B6400`
- danger / none available: background `#F4D7D7`, border `#E6B7B7`, text `#8F2D2D`
- attention / needs sticker: background `#E9DDF6`, border `#D0B7EE`, text `#6B4793`

### Selection / Pending

- selected row: `#F6EDCD`
- pending-change row: `#FFF7E1`
- selected/pending accent line: `#D1A244`

## Recommended Information Hierarchy

### Left Pane

The left pane should prioritize:

1. search
2. a small set of useful filters
3. fast row scanning

### Right Pane

The right pane should prioritize:

1. identity
2. status / availability summary
3. copy operations
4. supporting metadata
5. collector info / notes

## Recommended Right-Pane Structure

### Target Order

1. sticky header
2. summary strip
3. physical copies
4. mini details
5. notes

### Sticky Header

Should eventually contain:

- miniature name
- status pill
- unsaved indicator when applicable

Desktop note:

- the inspector should feel persistent
- long-term, the desktop `Close` button is a candidate for removal or demotion

### Summary Strip

Preferred future direction:

- replace separate `Available`, `Total`, and `Checked Out` cards
- use a stronger compact summary such as `8 / 10 Available`
- keep `Home` visible alongside it
- keep action cluster nearby:
  - `Save Changes`
  - `Reset`
  - `Set All Home`

### Physical Copies

This is the highest-priority content block after summary.

Strong recommendation:

- move this section higher than most metadata

Future table direction to test:

- `Sticker`
- `Current`
- `Move To`
- `Status`

This is a better model than one ambiguous dropdown if staged changes ever become unclear.

### Metadata

Current state is too evenly weighted.

Future regrouping:

- gameplay / encounter info:
  - size
  - creature type
  - role
  - paint
- collector / catalog info:
  - set
  - set #
  - race
  - sex
- notes as a separate wider block

Use grouped definition-list style rather than many equal cards.

## Recommended Left-Pane Structure

### Search / Controls

The unified search field should become the strongest control on the left side.

Suggested placeholder:

`Search name, sticker, location, tag...`

Suggested companion controls:

- location dropdown
- filters button
- clear filters button

### Filters

Longer-term recommendation:

- replace permanent “chip wall” filters with applied filters
- only show filter pills when filters are active

Candidates for filter values:

- location
- size
- creature type
- role
- race
- sex
- set / set family if it proves useful
- painted / unpainted
- availability state
- needs sticker

### Explicit Filter-System Direction

The current `Quick Filters` row is a temporary prototype bridge only.

It is not the intended long-term filter model.

Why it needs to change:

- status buckets like `Ready`, `Partial`, and `Checked Out` are not the primary browse workflow
- the row compresses badly when the inspector opens
- it competes with the search field instead of supporting it

The intended future direction is:

- keep search as the dominant left-side control
- replace the permanent chip row with a `Filters` button or filter popover/modal
- let the user apply targeted filters such as:
  - race
  - sex
  - creature type
  - size
  - role
  - paint
  - needs sticker
  - location
  - availability state only as a secondary filter, not a headline control

After filters are applied:

- show them as removable active-filter pills below the main control row
- when the layout gets tight, truncate the visible active pills and show an overflow label such as `+ 3 more`

This future system should be designed so:

- the search bar never gets crowded out by filter UI
- active filters remain understandable at a glance
- filter UI collapses gracefully when the inspector opens

### Browser Table

Recommended column order:

- `Avail`
- `Name`
- `Home`
- `Size`
- `Type`

Recommended emphasis:

- name is strongest
- availability is a fast visual anchor
- home is useful but quieter
- size and type are lowest-emphasis columns

## Sticker-First Workflow

This should become a first-class interaction.

Desired future behavior:

- user types an exact sticker like `A12`
- app opens the parent mini automatically
- app scrolls the copy table to that sticker
- app highlights that specific row briefly

This is one of the highest-value upgrades over the spreadsheet.

## Recommended Order Of Operations

This is the recommended implementation sequence for step-by-step work with GPT in VS Code.

### 1. Lock Design Tokens

Deliverables:

- shared colors
- font stack
- spacing scale
- radius scale
- button/pill/table-header styles
- flatten major gradients

Why first:

- prevents ad hoc styling
- gives later component work a stable visual language

### 2. Outer Shell / Split Layout

Deliverables:

- stable header shell
- stable left/right layout
- desktop/tablet inspector behavior

Why second:

- every component will feel wrong if the container proportions are wrong

### 3. Left Header + Search / Filter Row

Deliverables:

- stronger search input
- location dropdown
- filters button
- clear button
- active filters row only when needed

Why third:

- the finder workflow should lead the left side

### 4. Replace Quick Filters With Real Filters

Deliverables:

- remove the permanent status-chip row
- add a `Filters` trigger button or popover/modal
- build applied-filter chips that only appear when filters are active
- support compact overflow behavior such as `+ N more`

Why fourth:

- the current quick filters are conceptually weak and compress badly
- the left side should become a real finder before we keep polishing the table below it

### 5. Left Results Table

Deliverables:

- row density
- selected state
- hover state
- availability badges
- text hierarchy

Why fifth:

- this is the main scan surface

### 6. Right Inspector Header

Deliverables:

- name
- status pill
- unsaved indicator space
- desktop/small-screen header behavior

Why sixth:

- this defines the selected-state identity

### 7. Right Summary Strip

Deliverables:

- compact availability summary
- home summary
- action cluster

Why seventh:

- improves hierarchy immediately without rewriting everything else

### 8. Physical Copies Redesign

Deliverables:

- section moved higher
- clearer copy-row model
- clearer staged-change state
- possible `Current` vs `Move To` split

Why eighth:

- this is the actual job of the app

### 9. Metadata Regrouping

Deliverables:

- fewer boxes
- grouped definition-list treatment
- calmer secondary info layout

Why ninth:

- this is useful, but not the main operational win

### 10. Sticker-First Search Behavior

Deliverables:

- exact sticker recognition
- auto-open parent mini
- auto-scroll to copy row
- temporary highlight

Why tenth:

- depends on both search UI and copy table structure being good first

### 11. Advanced Filters

Deliverables:

- deeper filter controls
- removable active filter pills
- cleaner filter logic

Why eleventh:

- easy to overbuild before the core flow is right

### 12. Responsive Polish

Deliverables:

- desktop refinement
- landscape tablet refinement
- full-screen inspector on smaller widths if needed
- sticky inspector header behavior

Why twelfth:

- easier once the hierarchy is already correct

### 13. Add / Edit / Sticker Assignment Flows

Deliverables:

- add miniature flow
- edit miniature flow
- sticker management workflows

Why last:

- these are secondary workflows and should not derail the main browser/inspector experience

## High-Confidence Recommendations

These should be treated as strong direction:

- remove major gradients from section headers and large surfaces
- make search more prominent
- keep left table focused on `Avail / Name / Home / Size / Type`
- move `Physical Copies` higher in the inspector
- reduce equal visual weight across all metadata fields
- keep styling calm and utility-focused

## Experimental Recommendations

These are worth testing, but should not be treated as guaranteed wins:

- remove the desktop `Close` button entirely
- replace permanent state chips with a filters-first system
- compress availability into one summary card instead of separate stat cards
- split copy rows into `Current` and `Move To`
- use an inspector overlay at certain tablet widths instead of keeping both panes equally squeezed

## Suggested Next Small Commits

Recommended first three UI-focused commits:

1. design tokens + flatten major gradients
2. left search/filter row cleanup
3. replace quick filters with a real applied-filter model

## Working Method For GPT Iteration

Use one component-sized request at a time.

Good example asks:

- `Refactor the left search/filter row to match this spec. Do not touch table logic.`
- `Replace the three summary cards with one availability card, one home card, and a right-aligned action cluster.`
- `Move Physical Copies above metadata and split Current vs Move To.`
- `Convert the mini detail cards into grouped definition-list sections.`

Avoid:

- `Redesign the app to be better.`

## Practical Note

This roadmap supersedes earlier high-level direction when the two conflict.

Most importantly:

- the app should be calmer than Loot Chests
- more operational than decorative
- and explicitly optimized for `find mini -> confirm mini -> move copies`
