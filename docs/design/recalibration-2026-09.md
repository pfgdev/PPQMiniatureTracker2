# September 2026 Recalibration

Reviewed 2026-09-07 against commit `217a0d7` (`Refine detail pane inventory layout`).
The worktree was clean at the start. The initial review changed documentation only;
the follow-up stabilization below implements the confirmed fixes.

This is the current handoff. Earlier design documents preserve useful history,
but their proposed layouts and step numbers sometimes conflict with the accepted UI.

## Current Direction: Imported Preview, No App Writes

**Owner acceptance and next phase:** the owner reports that the imported preview
looks extremely good and requested a Git checkpoint. Before enabling durable
saving, review the long-term storage model rather than carrying forward every
legacy spreadsheet convention. This is a design review, not permission to migrate
IDs, move columns, or change field ownership yet.

Review priorities: retain existing immutable group/copy IDs but choose a
server-generated identity scheme for new records; map fields by validated header
names rather than column positions; confirm which properties belong to a group
versus a physical copy (especially Paint); consider stable catalog IDs for Sets
and Locations so renames do not break references; and separate missing/not-applicable
states from display text before writing them permanently. The current adapter
requires exact column order, so do not rearrange the live storage tabs yet.

**October 7 approved integration completed:** the owner confirmed preservation of
all blanks/checked-out locations, separate Home/current-location catalogs, temporary
editing that resets on reload, and permission to remove the eight-cell test tab.
Both workbooks were backed up and verified. Groups (496), Copies (612), Lists (258),
and Stickers (900) were imported into 2.0 in one batch, replacing only that test tab.
Full readback matched the candidate; all 19 away copies and six blanks survived.
The original sheet is unchanged. The actual destination rerun adds zero rows.

The local app now has a read-only Storage.js adapter and a clear Preview notice.
All authoring stays in memory, including preview sticker hints; reload reads the
unchanged imported baseline. Full catalogs include unused Sets, with Home and
Current Location separate. Failed loads show an error, not mock data. Verification:
60 unit/CLI tests, 72 existing Chrome scenarios, and 11 actual-data preview checks
passed. **No clasp upload, versioned deployment, permission change, or Git push
was performed.** The owner must upload before the development site changes.
The [integration handoff](collection-preview-integration-2026-10-07.md) records
backups, exact writes, verification, authorization caveats, and the next checks.
Earlier preparation-only statements below are historical checkpoints.

**October 7 fresh audit and local dry run completed:** read the live legacy sheet
again across all eight tabs, repeated the reads, and checked its unchanged
modification timestamp. The candidate preserves 496 groups and 612 copies, with
zero blocking data conflicts and six warnings: four blank Race values and two
named Sets without Set #. The existing 2.0 test tab is preserved. The authoritative
sticker catalog contains 900 codes, 345 currently free, beginning with F55.

The [fresh audit, field mapping, and next-session handoff](import-dry-run-2026-10-07.md)
is now the current import reference. Local tooling and 40 unit/CLI tests were
added; seven real-data Chrome preview checks and an actual-data rerun simulation
passed. The full Set catalog includes 21 unused options that the live UI must not
lose by deriving choices only from owned groups. Snapshots/candidates stay under
ignored `.local/`; clasp explicitly includes only the five current app files.
No workbook, runtime app code, deployment, permissions, Git remote, or clasp
project was changed by this import-preparation pass. Review the mapping next;
backups, a fresh capture, and approval must precede an actual import. Live storage
and authorization remain separate work, not implied by a successful dry run.

**October 7 destination confirmed:** the owner accepted the pre-live fixes and
confirmed the new app replaces the old spreadsheet workflow. Read-only discovery
verified that the Apps Script project in `.clasp.json` is already container-bound
to [PPQ Miniature Tracker 2.0](https://docs.google.com/spreadsheets/d/1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY/edit).
It has one `MiniatureDataTable` tab containing only eight test cells at A1:D2;
the full A1:Z1000 value read found no miniature records. The earlier statement
that there is no active spreadsheet storage layer remains true, but must not be
misread as meaning the script has no parent workbook.

Recommend reusing this existing workbook with clean storage tabs, leaving the
old PPQ Miniature Tracker as the import source and legacy reference. Do not create
another destination unnecessarily, copy legacy UI formulas into storage, or
overwrite the test tab incidentally. The fresh source audit/field mapping,
dry-run tooling, and local preview are now complete as described above; actual
import and live persistence/access control remain to be built and tested.
Source/destination IDs, read evidence, and the proposed
sequence are recorded in the [source and destination audit](source-sheet-audit-2026-09.md#destination-discovery-october-7-2026).
This discovery changed documentation only; no spreadsheet, application code,
deployment, or permissions were changed, and the app still runs mock data.

**October 6 pre-live review and approved fix pass:** the owner accepted the banner
for now and requested the planned end-to-end audit before import/live storage.
The review reproduced real bugs beyond the existing 63 regression scenarios.
The follow-up fixes remain mock-only and supersede earlier descriptions below:

- Empty provisional groups remain creation drafts after their sole copy is removed,
  including Close/New and Changes recovery. Create must insert the group, never
  silently take the existing-group update path. Explicit Discard removes the draft.
- Existing copy IDs use the same compact input as new copies without widening
  columns. Apply-ID fills the first blank retained copy, including existing ones;
  n/a is not a target. Stable internal identities do not change with sticker text.
  Changed IDs are checked against unchanged siblings, saved groups, parked drafts,
  and deletion Undo. Untouched legacy duplicates do not block unrelated edits.
- Sticker sequence hints belong to drafts until Save. Discard, clearing the hint's
  ID, or removing its copy stops that hint affecting suggestions. An unrelated
  group's Save cannot persist another draft's manual sequence preference.
- Set # accepts up to three alphanumeric characters starting with a digit, such
  as 40, 4a, or 5b. It is disabled and visibly empty without a named Set. Switching
  back before Save restores the draft number; saving n/a clears it. Untouched
  legacy numbers do not block unrelated corrections.
- A previously valid Paint cannot be cleared to blank. Untouched legacy missing
  paint remains editable without forcing that unrelated correction. Notes are
  optional for both creation and the Ready/missing-field indicator.
- On narrow layouts, opening or recovering an inspector brings its header into
  view. Typing does not repeatedly scroll the page; the desktop layout is unchanged.

Verification: all 72 Chrome regression scenarios passed across the broad run and
focused reruns, including nine new audit regressions. Earlier test assumptions
were updated for editable existing ID cells, disabled inapplicable Set #, optional
Notes, and intentional mobile navigation scrolling. Desktop/mobile screenshots
were reviewed; focused runs reported no browser script errors. Tests use locally
rendered Apps Script HTML and mock fixtures, not the deployed Google iframe.
`git diff --check` passed. The user should still spot-check the development site.
No sheet import, backend write, deployment, Git push, or clasp upload is part of
this pass. The earlier read-only source audit remains the import reference:
[source-sheet audit](source-sheet-audit-2026-09.md).

Before live writes, explicitly settle the storage schema and import mapping,
shared sticker catalog/uniqueness, and authorization. The current Apps Script
manifest exposes the web app to ANYONE_ANONYMOUS and runs as USER_DEPLOYING. There
are no current spreadsheet read/write endpoints, but adding owner-authorized
writes under that deployment without an access decision would be unsafe. Do not
change permissions or connect the source sheet as an incidental bug fix.

Next: owner spot-checks these fixes on the development site; then plan a separate
import/storage phase with a dry run, source backup, and explicit authorization
before durable writes. A successful mock regression suite is not a live-data
readiness guarantee.

**October 6 collection banner, accepted for now:** the owner selected the
quiet collection-summary direction. The banner now shows physical miniature and
group totals as plain text, Away and Missing stickers shortcuts, a disabled
`Dashboard / Soon` affordance, and a stable Review Changes disclosure. The demo
warning lives in the title row, with a fuller explanation on click. Narrow screens
move the shortcuts and Dashboard into a Collection disclosure rather than wrapping
the banner. The browse result count lives beside the facets when there is room;
it is no longer mixed into the collection totals. Header height does not depend on
counts, drafts, or undo availability.

Collection shortcuts open Individuals, scoped to applied copies away from Home or
with blank stickers. Literal n/a is not missing. Counts exclude editor drafts and
pending location moves until Save applies them in memory. Shortcuts temporarily
set aside existing filters, sorting, selection, and scroll; Back (in Clear's slot)
or clicking the active shortcut restores that browse context. Switching between
shortcuts retains the original return destination. Filters can further narrow a
shortcut, and the Groups toggle remains usable. Changes provides distinct pending
location, draft-resume, and undo-deletion actions without adding overlapping counts.
Nothing is saved to the sheet.

Verification: all 63 Chrome regression scenarios passed, followed by four focused
checks after the last spacing refinements. Banner geometry was checked from 320px
through desktop widths, including 600 physical copies across 120 groups; no
browser script errors were reported. Desktop/mobile screenshots were reviewed.
No Git or clasp upload was performed for this pass.

**Future dashboard TODO, explicitly not built now:** collection summaries and
charts, including race/type breakdowns and set completion. Define whether each
chart counts physical copies or distinct group entries. Set-completion percentages
need an authoritative set checklist/denominator and distinct owned set entries,
not total copies. The disabled Dashboard affordance is a reminder, not navigation
to an unfinished screen. No new catalog, charts, or persistence is in this pass.

**October 6 More filter cleanup, awaiting feedback:** More follows the card's
order: Role, Set, Paint status, Stickers. Set is a full-width single-set dropdown
with the same 13px/600-weight typography as the tiles. Paint has one row at normal
width, labelled Painted, Unpainted, In Progress; Work in Progress remains its
actual status/tooltip/accessible name. Stickers replaces Needs stickers only with
Assigned and Missing. These states use OR within the category: mixed groups match
either state, and Individuals filters the actual copy. Explicit n/a is resolved
under Assigned for now, not Missing; blanks, including whitespace, are Missing.
Set names are not rendered as a
large tile grid. Explicit Not specified and unfamiliar saved choices are also
available in the descriptive facets. The More count/Clear cover its new choices;
other facet/search/location selections survive its Clear. The existing popover
width and both content edges are preserved even when a thin scrollbar reserves
space. Height is capped to the visible pane, with above-button placement on short
windows when needed; More grids use fewer columns in narrow panes. The broad
57-scenario run passed, and six affected checks passed again after the
short-window/layout refinements. The requested order, typography, single paint row,
and sticker choices add two regression scenarios, bringing the suite to 59.
Ten focused checks passed after these latest refinements, with no browser script
errors; desktop/mobile screenshots were reviewed.
See the
[More cleanup notes](shared-editing-options.md#more-filter-cleanup-october-6).
Catalog lists may be spreadsheet-managed later; an in-app catalog editor is not
a prerequisite. The subsequent pre-live fix pass above closes the existing-ID
editing gap without a separate batch-management screen. The More cleanup itself
did not add persistence or sticker-assignment changes.

**Current handoff, October 6:** the owner considers the authoring flow good.
After comparing the original dropdown focus appearance, the owner accepted
Option 3: retain the two-pixel blue outline with a 1px outward offset and restore
the compensated three-pixel left scroll gutter. The clipping boundary expands
without shifting fields or changing their widths; the inset option is not used.
Other editor/sticker work is unchanged. The owner clarified readiness
for the sticker shortcut, now implemented: an `Apply B92` action beside Add new
copy shows the actual proposed ID and fills the first blank retained copy's sticker
field, top to bottom, ignoring the blue individual-selection highlight. It never
adds a row or overwrites a sticker. The owner rejected the mandatory manual-first
step: startup now uses a remembered next ID, otherwise scans after the collection's
highest valid assigned ID, or starts at A00 for an empty collection. Current mock
data immediately offers M08. Saved/draft/Undo reservations are still skipped,
and manual entry is optional. Save remembers only the counter in this browser;
miniature data/drafts remain reload-limited and no sheet write is made. Invalid or
blocked local storage falls back to collection scanning. Without a blank retained-copy
row, or when the sequence is exhausted, the action is disabled. Sequence
order is A00 through A99, then B00 through B99; beyond Z99 is deferred and the
shortcut stops there. All 52 Chrome regression scenarios passed after the
automatic-start/counter-memory correction, with no browser script errors; nine
affected shortcut scenarios also passed in a focused run. After restoring accepted
Option 3, four focused focus/layout/copy-control scenarios passed with no browser
script errors; desktop/mobile screenshots were reviewed. See the
[October 6 feedback and proposal](shared-editing-options.md#october-6-feedback-and-sticker-convenience-proposal)
for current behavior and review targets. The pre-live fixes above now support
existing-ID correction; explicit missing-versus-n/a entry UX remains optional
follow-up work rather than a reason to add a separate management screen.

The owner accepted deferring authoritative sticker availability to the data-storage
phase: full ordered sticker catalog minus stored assignments, with temporary draft
reservations excluded. This shared list should drive Apply-ID and a future picker,
recover unused gaps, update locally without a request per click, and be rebuilt
across sessions/devices from stored collection data. Revalidate uniqueness on Save;
a remembered cursor is only a preference, not the source of truth. The current
mock shortcut remains unchanged. This TODO does not start sheet integration now.

**October 5 prototype:** the owner approved the sidebar creation plan and
asked to implement it. `+ New` opens the existing editor with a provisional group
and one copy from either browse mode. Create Group requires Name, Home, at least
one copy, and explicit selections for the descriptive dropdowns. They start
visibly blank; Not specified is a deliberate saved choice, not the default blank
label. Set # is only required for a named set, not `n/a` or Not specified. Create
stays dimmed/disabled until validation passes. Drafts remain unpublished until
Save and survive Close/navigation.
Paint uses a normal dropdown beside Set with exactly three statuses, ordered
Painted / Unpainted / Work in Progress; the owner rejected Not specified here.
New groups start blank and require a paint status before creation. Legacy booleans
still render correctly; Painted only includes Painted, not other status strings.
Long per-copy and group Notes now use the same read-mode two-second pause,
slow scroll, two-second pause, and reset as Home/Set. Original sizing and margins
remain intact, reduced motion disables animation, and edit controls never move.
`+ Add new copy` appends a single row, with a compact ID input for the new copy.
Remove controls fit inside Note without changing column widths. Existing-copy
removal is staged with Undo; deleting a whole group uses an inline named
confirmation and offers Undo deletion that restores its copies and editor work.
All actions remain in mock browser memory. The blank-versus-`n/a` sticker TODO
and explicit sticker-entry UI remain later work. See the current prototype in
[the editor/creation notes](shared-editing-options.md) for the actual behavior.
All 42 regression scenarios passed in a full run after the Paint dropdown and
Notes marquee refinements, with no browser script errors. Desktop/mobile geometry
remains stable, and screenshots were reviewed. The owner uploaded the prior
creation/blank-choice prototype to development; these newest refinements remain
local and await a clasp upload and browser feedback.
Eight affected scenarios also passed after removing Not specified from Paint.

The later October 6 pre-live review above supersedes this checkpoint's next steps.
The owner accepted Option 3's focus appearance. Authoritative sticker availability
and spreadsheet-managed option catalogs remain data-storage work, not a new
administrative screen. The real sheet is still disconnected.

**October 4 baseline:** the user returned to revisit the editor feedback.
The local refinement pass makes Edit become Discard in the header, adds breathing
room between the Details rows, and narrows Set # to a three-digit input. Following
the next design discussion, both modes keep the character fields in three
columns, followed by Set/Paint in their own Miniature group. Inventory now has
its own heading and an attached summary band inside the table frame. Available
shares ID's left inset, with the count centered inside its pill; Home matches both edges and the control styling of
Current Location below, with shared column widths and horizontal scrolling.
The tighter band uses quieter labels and a stronger read-only Home value.
Availability remains visible in Edit and previews the shown locations. Its pill
reserves the group's maximum count width; an external asterisk identifies unsaved
changes without shifting the centered count. Set # is only counted as missing
for a named set, not when Set is `n/a` or itself missing.
Paint is a property beside Set, and Notes no longer has a redundant Additional
heading. Close still retains a draft; Discard removes it and immediately returns
to inspection. This remains a mock-only UX iteration,
not approval to connect the sheet or start creation/sticker work.
All 30 local Chrome regression scenarios pass, with desktop/mobile screenshots
reviewed and no browser script errors. The owner accepted the latest layout for
now, confirmed a clasp upload, and requested a Git checkpoint on October 4.

The proposed next step at that checkpoint was a browser review of editing behavior (Save, Discard, closing and
resuming drafts, shared fields/copy notes, and Home versus current locations).
Then design Add Miniature using this editor as the starting point, including
how to specify physical copies for a new group and add copies to an existing
group. The October 5 discussion and implementation above supersede that boundary.

The earlier passive-label/wrapping TODO is addressed by the October 6 collection
banner prototype above, pending owner feedback. The broader
[Header System Pass](ui-optimization-roadmap.md#14-header-system-pass) can still
review visual hierarchy across the app, browse, and detail headers together.

September 12: the user asked for the first editor prototype
after clarifying cleanliness takes priority over exact layout replication, with
familiar order still important. It is now implemented locally and ready for
browser feedback. See [the editor prototype notes](shared-editing-options.md)
for the actual controls, unified mock Save/Discard/draft-retention boundaries, Home-change
behavior, and review targets. The historical planning below is not a reason to
reopen the layout-options debate. Editing remains an iterative, unfinished phase.

Latest feedback pass: edit fields now have labels and controls without backing
cards, and Set is a controlled dropdown drawn from the current mock set list.
The owner chose keeping drafts on close: no in-app native discard confirmation,
Close/navigation retain unapplied drafts, and a Drafts button resumes them even
through filters. Only Save applies changes; Discard removes the editor draft
without erasing earlier location staging. Drafts remain memory-only until reload.
All 27 local regression scenarios pass. Copy addition, sticker correction, and
dropdown-catalog maintenance are recorded as future design work, not implemented.

For the completed browse phase, refer to the code-grounded
[Groups / Individuals integration checklist](individuals-integration-plan.md).
It covers the approved selector, proposed behavior, measured layout constraints,
review gates, staged TODOs, and regression cases. The original deep dive changed
only documentation. After the user asked to start, a first functional mock-only
build was implemented; see its current progress section for behavior and remaining
UX review points. The owner accepted this phase on September 9; shared-editing
UX is next, to be discussed in the next session before implementation.

For that discussion, [Shared Editing: UX Options](shared-editing-options.md)
compares in-place cards, a focused editor in the same sidebar, per-field editing,
and a modal. It records draft/navigation/field-layout challenges and a proposed
small first prototype. These are alternatives for review, not approved decisions.

September 12 update: the user chose the focused editor in the same sidebar and
provided read/edit screenshots from PPQ Loot Chests as the interaction reference.
The outer pane/context stays stable while fields and header actions change for
editing. The options document records the choice; an A/B layout comparison is
no longer needed. Specific controls and save/navigation semantics remain to be
worked through before a full implementation.

Subsequent clarification: preserve the actual field order/grouping and shapes,
not merely the sidebar outline. Keep the copy table with editable individual
notes, keep group Notes below it, and retain the Size/Type/Race and Sex/Role/Set
rows. The user suggests omitting Availability in edit mode and editing Home;
continued location editing is a design choice. This supersedes the proposed
copy-table removal and expands editing scope beyond shared fields. See the
options document's clarification before using the older shared-only plan below.

September 9 follow-up: mode entry now selects/reveals a matching copy, inspector
rows support reciprocal selection in Individuals, popover dismissal no longer
also closes inspection, and three-digit availability pills have compact padding.
Twenty local regression scenarios pass; the owner confirmed scrolling, reciprocal
selection, and blank-space popover dismissal work well. Popover clicks on actual
rows still perform their normal action, deliberately accepted for now. The
integration checklist records the rationale, handler mechanics, and a possible
future consume-the-dismissal-click change if accidental actions become a problem.

The user confirmed the current development app is running, and corrected the
restart priorities after the stabilization pass:

- This is active UX and functionality design, not preparation to ship. The user estimates development is closer to 30% complete.
- Continue using mock data until the user considers development complete and explicitly approves integration.
- Do not connect the real sheet, even read-only, or introduce real persistence during this phase.
- Spreadsheet schema, missing/n/a semantics, and other integration decisions stay deferred. Do not make them prerequisites for UX work.
- Design and exercise add-mini, editing, sticker management, and group/individual browsing interactions using browser-only mock state.
- The accepted current layout is a baseline for experimentation, not evidence that the application is nearly finished.

### Recovered Flow Notes

- Groups / Individuals: the user's earlier conversation specifies the same browse table, replacing `#` with sticker `ID`, and Home with Current Location plus the existing Home/Away badge treatment. One row per copy; all remaining columns stay unchanged. Both views open the same group inspector. Preserve the clipping/column stability while testing the new content.
- Sticker-first search: roadmap step 10 proposes exact sticker recognition, opening the parent group, scrolling to the copy, and temporarily highlighting it. This is a useful companion proposal, not a reason to change the user's agreed toggle design.
- Shared editing: the user described an Edit action in the current Close-button position, switching shared fields to editable controls and submitting changes for the whole group. Individual sticker/location/note editing is separate. Earlier modal/drawer suggestions are less specific and do not override this later direction.
- Add miniature: roadmap step 13 lists the flow, and `ui-direction.md` suggests a secondary modal/drawer rather than making entry the landing page. No finalized screen-by-screen new-app creation flow was found in these notes.
- Sticker management: `docs/legacy/legacy-workflows.md` records a queue of copies needing stickers, batch dropdown selection, duplicate feedback, Apply Stickers, and a separate batch unassignment flow. These are legacy interaction references, not an approved new-app screen design. Next-available-sticker selection is only a proposed improvement.

### Agreed High-Level UX Sequence

This sequence incorporates the user's end-of-evening feedback. It is not a fixed
screen specification or a list to implement in one pass. Each step is expected
to involve substantial design, browser feedback, and iteration.

1. **Groups / Individuals: accepted September 9.** The approved segmented control remains beside Browse Minis with a 16px gap and a 1px downward optical nudge. Mode-specific rows, search, sorting, copy selection/reveal, and reciprocal inspector selection are implemented. The integration checklist records the accepted behavior and nonblocking follow-ups; no additional browse work is required before starting shared-editing design.
2. **Shared editing.** Retain the user's strong direction: enter edit mode from the detail-header action area, edit shared miniature fields in place, and apply or cancel mock changes. Iterate on the editing experience before deciding how creation should work. Keep group-level edits distinct from individual-copy edits.
3. **Add miniature.** Evaluate this after shared editing has been built and reviewed. Creation might reuse the same editor in a blank/new-entry state, including an editable name, rather than introducing a separate screen. A modal or drawer remains an option, not a commitment. Let experience with the editor reveal what additional controls or steps are actually needed.
4. **Sticker assignment and management.** Follow the preceding flows, not in parallel with them. Individual group editing may offer manual assignment, but a dedicated batch workflow similar to the legacy experience will likely also be useful. When this step begins, the user will explain the pain points and the assistant will propose UX alternatives. Do not settle its detailed design now.

### Iteration And Resume Boundary

- Remain mock-only throughout these UX steps, with no real spreadsheet connection or persistence.
- The assistant is responsible for interpreting intent, filling implementation gaps, and recommending well-fitting UX options. The user should not have to specify every control or pixel.
- Work one interaction-sized slice at a time, review it in the browser, and revise before moving on. Completing an initial implementation does not complete the design step.
- Preserve the existing visual language and stable table behavior where practical; do not treat the current layout as untouchable if a core workflow exposes a limitation.
- The user accepted the Groups / Individuals refinements and asked to document/commit the result. Next session starts with shared-editing UX: agree the smallest Edit -> change shared fields -> Apply/Cancel interaction in the existing detail panel. Keep group metadata drafts distinct from pending copy-location changes, and decide how navigation/close handles unsaved edits. Do not start creation, sticker workflows, or persistence as part of that slice.

## Stabilization Follow-Up (2026-09-07)

Implemented and verified with `tests/regression.cjs` in local headless Chrome:

- Initial JSON escapes script-sensitive characters and preserves the original data.
- Set All Home clears staged-away moves for copies saved at home and stages home for saved-away copies.
- Desktop table width derives from the full workspace and fixed pane insets, not the narrowing browse pane. Opening, resizing, closing, and crossing the desktop breakpoint retain the width model.
- Copy edits, sort changes, and facet selections preserve keyboard focus across rerenders.
- A global Unsaved button reveals pending work, including filtered-out groups. Leaving with pending edits requests the browser's standard warning.
- The top notice explicitly explains mock-only, reload-limited saves.
- Intermediate-width search gets its own row when details are open. Smaller screens scroll the tables instead of squeezing their columns. This is a functional fallback, not a complete mobile redesign.
- Marquee respects reduced-motion preferences. Group notes expose the full text through a tooltip; a touch/keyboard-friendly note reader remains future work.
- Missing paint is no longer incorrectly labeled Unpainted; only explicit false gets that tag.

All eight regression scenarios passed, with no browser script errors. Desktop
screenshot reviewed. The owner subsequently confirmed the current development
app is running; no real sheet reads/writes were added. Historical findings
below describe the pre-fix state, not outstanding bugs unless noted here.

The [command and feedback reference](../development.md) explains Git, clasp,
development URLs, and a short browser feedback session.

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

## Superseded Integration-First Restart Proposal

The sequence below is retained as historical technical planning only. It is NOT
the current work order. Follow the mock-only UX direction above; revisit these
integration topics only when the user says the app design is ready.

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
