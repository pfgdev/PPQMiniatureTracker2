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

## Deferred From The Original Prototype

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

Continue mock-only UX development beyond the original browsing prototype:

1. Groups / Individuals browsing, including a proposed switching control that fits the current UI.
2. Shared editing in the existing details area.
3. Add miniature, evaluating reuse of the editor in a blank state before committing to a modal or drawer.
4. Sticker management, including discussion of a legacy-style batch workflow when that phase begins.

Each step is iterative, not a one-pass deliverable. The assistant should propose
interaction details and UX alternatives from the user's intent. These workflows
must be designed and tested before spreadsheet integration. The user's final
evening update is planning only; implementation waits for a later session.

The user explicitly deferred real reads, real writes, and integration-specific
data decisions until development is complete and they approve moving on.
See [the current handoff](recalibration-2026-09.md#current-direction-mock-only-ux-development).
