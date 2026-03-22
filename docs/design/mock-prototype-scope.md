# Mock Prototype Scope

## Goal

Use hard-coded data first so we can evaluate the new miniature tracker's:

- main browse flow
- search and filter behavior
- list/detail layout
- per-copy movement workflow
- overall visual language

without being blocked by spreadsheet integration details.

## Included in this first prototype

- searchable inventory list
- location filter
- availability filter chips
- sliding detail panel
- shared miniature metadata
- per-copy location editor
- `Reset Changes`
- `Set All Home`
- mock save that only updates browser state

## Intentionally deferred

- real spreadsheet reads
- real spreadsheet writes
- sticker assignment screen
- add/edit miniature flow
- auth, deployment polish, and error handling

## What we should review first

- does the list feel like the right default landing screen
- does the detail panel show the right information hierarchy
- does per-copy movement feel clearer than the spreadsheet version
- does search-by-sticker from the main list solve a real pain point
- do the colors and panel patterns feel close enough to the existing PPQ apps

## Expected next phase

After UX review, connect this mock structure to a sheet-backed data layer instead of rebuilding the UI from scratch.
