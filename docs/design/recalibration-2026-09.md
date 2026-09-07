# September 2026 Recalibration

Reviewed 2026-09-07 against commit `217a0d7` (`Refine detail pane inventory layout`).
The worktree was clean at the start. This review changes documentation only.

This is the current handoff. Earlier design documents preserve useful history,
but their proposed layouts and step numbers sometimes conflict with the accepted UI.

## Where We Actually Are

- Apps Script serves a vanilla JavaScript/CSS prototype. No framework or build step.
- `Code.js` builds nine mock groups containing 28 physical copies on every load.
- There is no active spreadsheet read/write layer, spreadsheet ID, or imported real inventory in this checkout.
- Save Changes updates browser memory only. Reloading restores the mock data.
- Legacy sheet schemas and workflows are documented under `docs/legacy`; the old scripts are reference text, not active application code.
- User confirmed the existing Google Sheet remains the source of truth. Subsequent read-only inspection confirmed 496 definitions and 612 physical copies already present; see [the source-sheet audit](source-sheet-audit-2026-09.md). No re-paste is needed to recover the existing inventory.
- User wants adding minis and managing sticker assignments in the first real-use version, in addition to lookup and movement.

## Accepted UI Baseline

- Browser: search, searchable single-location selector, Clear, and shared facet panel.
- Facets: Size, Type, Race, Sex, More. More contains Role and provisional collection flags.
- No permanent applied-filter-chip row. Facets apply immediately, OR within a category and AND across categories.
- Group table: `# | Name | Home | Size | Type | Race | Sex | Role`.
- Availability uses colored available/total pills. Numeric availability sorts by available count; Size uses semantic order; text sorts naturally.
- Keep the hand-tuned table positions, rounded clipping edge, and independent panel scrolling. Do not reintroduce column hiding/reflow midway through opening details.
- Inspector order: Details, Inventory, Additional, separated by titles and spacing.
- Details: equal three-column rows, `Size | Creature Type | Race`, then `Sex | Role | Set`.
- Header: name, completeness tag, neutral Unpainted tag when applicable, unsaved count, Close.
- Inventory: Availability and Home occupy two of three equal tracks; the third stays empty.
- Copies use one table: `ID | Status | Current Location | Note`.
- Reset, Set All Home, Save Changes are compact, right-aligned in one row below the table.
- Additional holds group notes. Individual copy notes are separate data, currently read-only.
- Home and Set use clipped single-line text with selective marquee: two-second pause, scroll, two-second pause, reset.
- Broad header styling remains deferred for a holistic review.

## Deployment Check

`clasp deployments` succeeds and lists HEAD plus two versioned deployments.

- Version 1, description `PPQ Miniature Tracker 2.0 v0.22`, opens in an isolated browser but serves an older eight-group prototype with the early layout.
- Version 2, description `Mini Tracker Version 0.15`, requires Google sign-in in that browser.
- HEAD `/dev` also requires Google sign-in; the latest remote source was not inspected or compared with local files.
- Therefore a public versioned URL is not evidence of what the latest development app looks like.
- No deployment, remote source, or sheet was modified during this review.

Before the next live test, verify the bookmarked development URL and distinguish it from the published versions.

## Verified Findings

### Before Real Data: Data Embedded In Script Can Execute As HTML

`Code.js:3` serializes data with `JSON.stringify`; `Index.html:12` force-prints it
inside a script element. A synthetic note containing a closing script tag and a
second script executed in the isolated local preview. Cell rendering later uses
`escapeHtml`, but that cannot protect the initial HTML parse.

Escape script-sensitive characters when serializing, or load data through a safe
server-response path. This is a real-data integration blocker; current input is
hardcoded mock data, so the test does not demonstrate an existing external writer.

### High: Set All Home Leaves Some Pending Moves Untouched

`Scripts.html:1457` checks saved location rather than normalizing every selected
copy's draft against Home.

Reproduction: open Zhent Soldier, stage A12 from Spare People to Quest Minis,
then click Set All Home. A12 remains at Quest Minis with Unsaved 1. Saving
commits that unexpected move to browser memory.

Normalize all drafts: remove a pending move for copies already saved at Home;
stage Home for copies saved elsewhere.

### High: Resizing With Details Open Breaks The Table Width Lock

`Scripts.html:112-113` registers `syncDesktopLayoutMetrics(force)` directly as
resize and ResizeObserver callbacks. Their event/entries arguments are truthy,
so they unintentionally act as `force`, bypassing the open-panel guard at line 1197.

Reproduction at 1440px: the full table is 1176px, clipped inside a roughly 526px
left wrapper. Resize to 1400px with details still open: the table lock becomes
526px even though the available shell width is unchanged. Columns squeeze.

Use explicit callback arguments and derive the expanded width from stable layout
geometry. Preserve the accepted clipping behavior and verify resize/open/close together.

### Medium: Editing Rebuilds Controls And Loses Keyboard Focus

`handleRootChange` at `Scripts.html:1046` invokes a full rerender, including
`detailContentNode.innerHTML` at line 707. Changing a focused location select
moves focus to BODY. This interrupts keyboard traversal and also restarts marquee.

Preserve the active control or update only the affected controls. The same full
render path is used for facets, sorting, and main search. Optimize selectively.

### Medium: Pending Changes Can Become Invisible

Drafts survive switching groups, but only the selected group's header shows a
count. After staging A12 away and selecting Archmage, the header says Ready and
the summary gives no indication that A12 is still pending. Returning to Zhent
Soldier reveals Unsaved 1 again.

Decide how users find pending work across groups and what happens on page exit.
Closing a panel does not currently delete drafts, but reload loses all browser state.

### Medium: Narrow Layouts Have Functional Limits

- At 1100x650 with details open, the main search field measures only 34px wide.
- At 390px, the browser squeezes all eight columns into the phone width; badges
  and labels clip, with some headers visually running together.
- The copy-location dropdown at that phone width measures about 44px.

Prioritize the supported device widths with the user. At intermediate widths,
keep search usable by adapting controls/panel behavior. A phone layout needs an
explicit strategy instead of shrinking the full desktop table.

### Lower Priority: Long Text And Motion Accessibility

- Group notes are single-line clipped with no full-text reveal (`Scripts.html:741`,
  `.mini-v2-note-body` in Styles). Preserve stable rows, but offer a deliberate
  way to read the complete note.
- Home/Set marquee continues even with `prefers-reduced-motion: reduce`.
  Preserve the accepted animation by default; provide a static readable fallback.
- Completeness currently treats every listed blank field, including Notes and
  Set #, as missing. Missing paint also appears Unpainted. These need explicit
  real-data semantics, not blanket truthiness checks.

## What Passed And What Was Not Tested

An isolated Chrome/Playwright preview assembled the local Apps Script template
using its actual mock-data builder and unmodified client files.

- No runtime page errors in the normal test sequence.
- Availability descending and name ascending produced the expected order.
- Medium OR Large returned nine groups; adding Type Beast returned Warhorse.
- C16 search returned Spirit Folk Fighter. Auto-open/copy focus is not implemented.
- Save/reload confirmed browser-only persistence.
- Desktop screenshot inspection preserved the accepted rounded table clipping and grouped inspector layout.
- A synthetic 600-group dataset rendered; one synchronous search event took about
  53ms on this machine. This is a limited smoke check, not a real-data performance benchmark.
- Rendering and interaction tests reproduced the findings above.

Not tested in the initial app review: authenticated HEAD app, actual sheet contents,
server writes (none exist), concurrent editors, actual full inventory performance,
or other browsers. Actual sheet values and sample formulas were subsequently
inspected in the linked source-sheet audit; app integration is still pending.
Browser tooling and screenshots were kept in a temporary directory outside the repo.

## Recommended Restart Sequence

### A. Small Stabilization Pass

Fix Set All Home, the resize-width bug, and focus preservation. Clarify pending
work visibility and mock save behavior. Protect data embedding before sheet reads.
Keep the accepted layout as the baseline; avoid a broad redesign or framework migration.

### B. Verify And Connect Real Data Read-Only

Identify the source sheet, count definitions and physical copies, verify headers
and IDs, and inspect existing sticker assignments. Do not import duplicates.
Map real data to the current group/copy model, retaining a mock mode for tests.

Settle missing versus intentionally blank/n/a values, per-copy note storage,
unique copy IDs, and unassigned versus n/a stickers. Validate real field lengths
and option vocabularies before changing the hand-tuned layout.

### C. Groups / Individuals Browser And Sticker Focus

Carry forward the user's last approved direction:

- A Groups / Individuals toggle uses the same table and inspector.
- Individuals produces one row per physical copy.
- Replace `#` with sticker `ID` and `Home` with Current Location plus Home/Away badge.
- Name, Size, Type, Race, Sex, Role stay as they are, inherited from the group.
- Opening a copy selects its parent and focuses that copy in the inspector.
- Search, filters, and sorting need explicit group-versus-copy semantics.

### D. Complete The Real-Use Workflows

- Save location changes by stable copy ID, with server validation and clear success/failure feedback.
- Edit shared mini metadata separately from individual notes/locations.
- Add definitions and physical copies without duplicate IDs.
- Assign/unassign stickers with server-enforced uniqueness and the agreed n/a semantics.
- Handle concurrent changes without silently overwriting someone else's work.
- Revisit the current manifest's anonymous/execute-as-deployer settings before enabling real data writes; establish intended users and access.

Finish with relevant responsive polish and the deferred header-system review.
The user specifically includes adding minis and sticker assignment in the real-use target.
