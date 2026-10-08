# September 2026 Recalibration

Reviewed 2026-09-07 against commit `217a0d7` (`Refine detail pane inventory layout`).
The worktree was clean at the start. The initial review changed documentation only;
the follow-up stabilization below implements the confirmed fixes.

This is the current handoff. Earlier design documents preserve useful history,
but their proposed layouts and step numbers sometimes conflict with the accepted UI.

## Current Direction: Imported Preview, No App Writes

**October 8 follow-up: Manage Lists prototype.** The owner approved a restrained
in-app dialog, consistent with the existing UI. A compact Lists button sits beside
Dashboard (inside Collection at narrow widths). Following owner feedback, both
have visible button boundaries: Lists is enabled and Dashboard/Soon is muted and
disabled. Both retain 32px height without growing the 56px summary row.
The native modal retains the
underlying editor, selection, and scroll; it has its own scrolling content,
keyboard focus containment, Escape/Done dismissal, and reduced-motion support.
It does not shift the page or change the inspector layout. At narrow desktop
widths the summary uses the existing shorter collection-count wording to fit.

- All editable catalogs are available: Size, Creature Type, Race, Sex, Role, Set,
  Paint, and Locations. A navigation rail becomes one list selector on mobile.
  Search, Add, Rename/Edit, and Remove stay in the same dialog, without nested
  popups. Long names wrap within its list, not the main app's fixed-height cells.
  Usage counts now share the main line at desktop dialog widths: ordinary rows
  are about 44px rather than 64px tall. Location eligibility remains secondary
  text, and phone layouts retain stacked metadata instead of squeezing controls.
- Explicit list Add/Save/Remove is independent of the miniature draft. Added
  choices appear immediately in dropdowns but are not automatically selected.
  Discarding miniature changes does not discard applied catalog changes.
  Done/Escape retains unfinished list form text without applying it; its Cancel
  discards that text. All catalog changes remain browser-only and reset on reload.
- Renaming relabels saved assignments, parked/active drafts and their baselines,
  pending locations, active filters, and deletion Undo records. It does not change
  miniature IDs, rewrite notes, merge groups, or create a dirty miniature draft.
  Case-insensitive duplicate names and app-reserved values are rejected.
- Removal consistently says Remove choice, including its confirmation button.
  The explanation distinguishes removing a future choice from clearing existing
  assignments: those remain valid and filterable. Once no saved miniature uses a
  removed choice, it disappears from filters. An already-active criterion stays
  visible until cleared, rather than silently changing the user's search. This
  rule also applies to removed Home/current locations.
  Removal has Undo; re-adding a removed name restores it instead of duplicating it.
  Restore only re-enables a choice: it never reverts miniature fields or locations
  changed since the removal. The owner explicitly confirmed this distinction.
  Built-in n/a and Not specified choices are protected. Paint still does not offer
  either of those sentinel values, but ordinary named statuses are data-driven.
- Locations have shared names and a separate Also offer as a Home location flag.
  New locations default to current-location-only. Home eligibility cannot be
  removed while referenced, and a rename updates both Home/current references.

Accepted future recovery direction: session Undo plus a Show removed / Restore
path when persistent catalogs are implemented, without an automatic expiration.
That persistent recovery UI/storage is not implemented yet. Current Undo has no
timer and survives closing Lists, but all list changes/history reset on reload.

This is a UX/behavior preview, not the durable catalog implementation. Catalog
identifiers in this dialog are session-local; persistent catalog IDs, reference
migration, concurrency validation, and write endpoints remain future work.
No spreadsheet, schema, deployment, Git checkpoint, or permissions were changed
by this follow-up. Await owner feedback on the dialog before committing to more UI.

Verification: all 79 Chrome UI scenarios, 74 unit/import tests, and 13 real-data
preview checks passed. Five focused list scenarios were rerun after refining
removal-history cleanup and keyboard focus during Undo. Desktop/phone screenshots
were reviewed with the actual long Set names. Checks include fixed dialog/page
geometry, short windows, focus containment, reduced motion, preserved drafts,
reference relabeling, hidden-choice recovery, and reload restoring the original
612 copies / 496 groups. `git diff --check` passed. Hosting and real writes were
not tested or enabled.

Feedback-polish verification: 19 affected Chrome UI scenarios passed, including
two new removal/reassignment/restore checks (81 scenarios now exist in the suite).
All 74 unit/import tests and 13 real-data checks also passed. Header tests verify
visible button boundaries, enabled/disabled distinction, 32px controls, unchanged
56px summary height, and large counts through desktop/mobile breakpoints.
Desktop and phone screenshots were reviewed. No Git push or clasp upload occurred.

**Long-title layout follow-up:** the imported Paladin name exposed an implicit
minimum-content grid width that expanded the whole inspector, not just its
header. The detail stage now has an explicitly shrinkable column and header.
Read-mode names reuse the existing marquee: pause two seconds, travel slowly,
pause two seconds, reset. Names keep their original font and never ellipsize;
Edit/Close and status badges retain their own space. The full name is also in
the tooltip and DOM text. Resizing remeasures the marquee; Edit/close cancels it,
and reduced-motion preference keeps it stationary. Editable names remain normal
inputs with unclipped focus rings. No data or persistence behavior changes.

Verification for this layout follow-up: all 83 Chrome UI scenarios, 74 unit/import
tests, and 14 imported-data checks passed, including the exact Paladin entry from
the owner's screenshot. Checks cover compact list rows, long names, unchanged
header/button geometry, preserved font size, resize remeasurement, Edit/Discard,
close/reopen, reduced motion, and the two-second-pause/reset timing. Screenshots
were reviewed at desktop and phone sizes. No Git push or clasp upload occurred.

**Completeness indicator follow-up:** Ready and the missing-field-count pills
are replaced by a fixed 24px green check or amber exclamation mark. These now mean
group record completeness, including stickers (see Record Status below), not
whether changes are saved or copies are at Home. Hover,
keyboard focus, or tap reveals an explanation; missing fields are named there
rather than counted in the header. Escape, a second activation, or clicking
outside dismisses it without closing the inspector. It is hoverable and stays
inside the viewport without affecting layout. Changing groups, entering Edit,
opening Lists, scrolling, or resizing clears stale explanations.
Unsaved remains separate; New/Editing states and all validation rules remain
unchanged. Both icons reserve identical space, retaining the long-title marquee
and the header's existing height and action-button positions.

Verification: all 85 Chrome UI scenarios, 74 unit/import tests, and 14 local
imported-data checks passed. Added coverage includes invariant 24px icon/header
geometry at desktop/phone widths, hoverable explanations, keyboard focus/Escape,
real touch taps, viewport containment, and preservation of pending edits and
selection. Desktop/phone screenshots were reviewed. `git diff --check` passed;
no Git push, clasp upload, or spreadsheet write occurred.

**Blank-value display follow-up:** the owner caught Quickling's blank Race being
shown as n/a while Edit and the completeness indicator correctly retained a blank.
Read-only shared fields and browse metadata now show Not entered in restrained
amber for empty/null/whitespace values. This is a display label, not a catalog
choice or a value written back to the record. Explicit n/a and Not specified keep
their existing meanings and ordinary styling. Optional notes are not warnings.
Home and Set no longer substitute Not specified/n/a for missing values; a named
Set with no number explicitly says (# not entered). A number without a Set stays
visible alongside Not entered rather than being lost or presented as complete.
Categorical filters and Race/Sex/Role sorting use actual values rather than a
synthetic n/a. Whitespace-only values do not create empty facet/Set choices.
Editing, draft retention, save rules, and spreadsheet contents are unchanged.

Verification: all 87 Chrome UI scenarios, 74 unit/import tests, and 14 local
imported-data checks passed. Coverage includes blank/null/whitespace fields,
explicit sentinel choices, filter/sort separation in both browse modes, optional
notes, retained Set numbers, Edit/Discard and Save round trips, unchanged card
geometry, and the actual Quickling record. Desktop and phone screenshots were
reviewed. `git diff --check` passed. No Git push or clasp upload occurred.

**Record Status follow-up:** More now contains a separate Complete/Incomplete
section after Stickers, using the same tile layout, narrow-screen fallbacks, and
bounded thin-scrollbar body. Assigned/Missing stays unchanged. Both/neither
selected means any status; selected statuses combine with other criteria using
AND. More's count and Clear include the new choices, global Clear resets them,
and collection shortcut Back restores them with the previous browse context.

A shared predicate drives filtering and the fixed-size header icon: missing
descriptive fields or blank/whitespace stickers make a record incomplete.
Explicit n/a stickers are resolved. Explicit Not specified/n/a details remain
valid; named sets still require Set #. Away status, painting progress, optional
notes, and unsaved location changes are not incomplete data. Groups require all
copies to be resolved; Individuals check the displayed copy's sticker plus the
shared group fields. Thus a complete individual can belong to an incomplete
group. The inspector remains group-wide and its accessible label explicitly
says Group record; the explanation names missing fields and counts copies needing
stickers in this group, including siblings hidden by browse filters.

Filters use applied records, not active/parked drafts. Save updates membership
without closing the inspector; its existing outside-filter explanation appears
when a repaired group no longer matches. Creation still permits a blank sticker,
but that created record is now visibly incomplete. No new required fields or
blocking save rules were introduced. No banner counter or persistent storage was
added; all app changes still reset on reload.

Verification: all 90 Chrome UI scenarios, 74 unit/import tests, and 15 local
imported-data checks passed. New coverage exercises both browse scopes, mixed
groups, AND/OR combinations, Clear/Back restoration, draft isolation, Save
removing the last match without closing inspection, new unstickered entries,
group-wide explanations, and imported Race/Set # omissions. More retains its
width/alignment and keyboard focus with narrow or short windows, long catalogs,
and space-consuming scrollbars. Desktop/phone screenshots were reviewed;
`git diff --check` passed. No Git push, clasp upload, or spreadsheet write occurred.

**Owner acceptance and next phase:** the owner reports that the imported preview
looks extremely good. Git checkpoint `ab920a7` (`Add authoring workflows and
imported collection preview`) is committed and pushed to `origin/main`. Before enabling durable
saving, review the long-term storage model rather than carrying forward every
legacy spreadsheet convention. The owner subsequently approved the contained
implementation below, not ID migration, live sheet rearrangement, or app writes.

**October 8 storage-design decisions:**

- Keep Paint and Home at group level, alongside the shared descriptive fields,
  Set/Set #, and group Notes. Most copies are prepainted or painted together.
  Same-name groups with different Paint/Home are intentional, valid variants;
  notes may describe exceptions. Do not automatically merge groups or derive
  identity from their name/field combination. Copies retain their own identity,
  parent group reference, sticker, Current Location, and individual Note.
- The owner supports a standardized independent identity method. Recommend
  retaining all imported IDs and issuing server-generated UUIDs only for new
  records, with a duplicate check. Generate once; renaming, sorting, correcting a
  sticker, or restoring must not change identity. Temporary `mock-*` IDs are not
  the proposed permanent scheme. If moving copies between variant groups is
  added later, preserve the copy IDs and stickers rather than recreating copies.
- The legacy sheet retained deleted records/IDs for restoration until manual
  purge. Recommend durable soft deletion (for example, `deletedAt`) with a Trash
  view, retaining the complete records and group/copy relationships, not just IDs.
  Current group Undo is browser-only; no persistent Trash exists. Group deletion
  must not accidentally restore copies that were separately deleted beforehand.
  Restore must reuse IDs, while permanent deletion is a separate explicit action.
- Owner-confirmed deletion policy: deleted groups/copies must NOT reserve
  stickers or participate in active duplicate checks, counts, search, or next-ID
  suggestions. The owner may delete a group and assign its physical minis/stickers
  to another group as the interim moving workflow. This supersedes the earlier
  recommendation to reserve deleted stickers. Restore is a separate transition
  back to active inventory and must check for reassignment at that point; never
  silently duplicate or steal a sticker. Internal IDs and sticker codes are
  separate: delete/recreate currently makes a new copy identity, whereas a future
  explicit move operation should preserve the original physical copy identity.
- Header-name-based mapping is the accepted direction, provided loading remains
  efficient. Build one validated header map per table read and retain bulk reads;
  reject missing/duplicate headers rather than silently guessing. This does not
  require a particular physical column order. The adapter now implements this;
  existing required header names remain exact, and unsupported headers fail
  explicitly. No live tab was rearranged by this pass.
- Stable Set/Location catalog IDs are desirable for safe renames, but should
  follow or accompany a designed in-app way to add dropdown choices. Do not
  treat sheet-only catalog editing as the finished workflow. Adding an option
  and renaming an existing option are different operations; keep Home and
  Current Location eligibility distinct without losing shared location identity.
- Keep the missing/not-applicable sticker distinction on the storage checklist.
  None of these decisions enables app writes, migrates data, or authorizes a
  new Trash/catalog-management UI in this pass.

Implementation references: Apps Script provides
[`Utilities.getUuid()`](https://developers.google.com/apps-script/reference/utilities/utilities#getUuid()),
and Google's [performance guidance](https://developers.google.com/apps-script/guides/support/best-practices)
prioritizes minimizing service calls and using batch operations. Expected negligible
header-map overhead at this collection size is an engineering assessment, not a benchmark.

**October 8 contained implementation:** Storage.js maps all four tables by their
validated header names without extra spreadsheet reads. It rejects missing,
duplicate, blank, padded, and unknown headers, as well as data beyond the declared
columns. Tests cover rearrangement, preserved blanks, opaque IDs, and same-name
groups with separate Paint/Home. The historical first-import audit deliberately
retains its exact-layout checks; it is not a general-purpose editor or a migration
tool and must not be rerun to overwrite a rearranged destination.

Deleted groups and their saved editor drafts no longer reserve stickers in the
browser. Active records and active/parked drafts still do. On Undo, a conflicting
active assignment or draft produces an inline explanation in Review Changes and
leaves the deleted record, current editor, and assignments untouched. Releasing
the conflicting assignment allows Undo to restore original IDs and drafts. This
is a safeguard for the existing Undo, not a persistent Trash interface. Removing
a copy within Edit remains staged: its saved sticker is released when Save applies
the removal, not before.

At this earlier checkpoint, server-generated permanent IDs, durable
deletion/restoration and purge, and in-app dropdown additions/renames remained
upcoming work; the catalog prototype above is the subsequent approved step.
Paint/Home ownership and current
app layout are unchanged. This pass adds no app write endpoint and changes no
spreadsheet, deployment, or permissions. Upload is a separate owner action.

Verification: 74 unit/import tests, all 73 Chrome UI scenarios, and 12 imported-data
preview checks passed with no browser script errors. The actual-data suite reverses
all four tables locally and asserts equivalent state before exercising the app;
no remote sheet rearrangement is involved. The UI suite covers deleted-sticker
reuse in existing/new groups, released saved and unapplied IDs, conflicts with
active/parked drafts, and successful Undo after releasing a reused assignment.
`git diff --check` also passed. No Git commit/push or clasp upload was performed
for this implementation pass.

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
passed. **No clasp upload, versioned deployment, or permission change was performed
by the agent.** The initial integration pass did not push Git; the subsequent
checkpoint is recorded above. Git updates do not upload the development site.
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
