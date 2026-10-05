# Shared Editing: UX Options

Prepared September 9, 2026 against `aff153d`; updated October 4 while revisiting
the owner's editor feedback. The original options remain discussion history.
Stay mock-only: no spreadsheet connection, persistence, creation, or sticker work.

## Current Editor Prototype: October Refinements

The user prioritized cleanliness first and familiar order second, then asked
for a working prototype. This is an initial UX slice, not a completed edit phase.

- Edit beside Close enters the same sidebar's edit mode and becomes Discard in that same position. Discard immediately returns to inspection and removes the editor draft; Close separately keeps it for later. Name becomes a header input and the status tags become Editing. Header height and pane width are preserved. Discard is no longer duplicated at the footer.
- The character fields stay in three columns under Details: Size / Creature Type / Race, then Sex / Role. The owner rejected a five-column trait row. Set and Paint now share a separate Miniature group in both modes, with Set spanning two columns. It uses the same heading and section spacing as the other groups; the former extra 4px row gap is removed. Edit-mode fields remain labels and controls without backing cards; the character grid retains its 24px row gap.
- Set is a dropdown, not free text. Its mock choices are captured from the initial mock collection and retained even if the final mini using a set is changed. Preserve a current unfamiliar value instead of silently replacing it. Set # is a separate 36px input accepting up to three digits, including leading zeros. New invalid values block Save with feedback; an unchanged legacy value does not block unrelated edits. The selected Set's full text is available through its title and the open option list. A real maintained catalog and adding new dropdown categories are future work.
- Completeness requires Set # only for a named set. An explicit `n/a` set with a blank number is complete; a blank Set flags Set alone, not its dependent number. This does not clear or disable either control.
- Paint is an ordinary property beside Set: Painted / Unpainted / Not specified when inspecting, and a compact Painted checkbox in Edit. An unspecified value is visibly indeterminate and remains unspecified unless changed. The Unpainted header badge and checkbox beside the Details heading have been removed.
- Inventory has its own heading, followed by a light summary band inside the copy table's existing frame, above the dark column-header strip. The Available label and pill share ID's left inset within the combined ID/Status area; the count remains centered inside the pill. Home matches both edges of Current Location's dropdowns below, leaving the space above Note empty. Its edit dropdown shares their height and styling. Quieter labels, a stronger read-only Home value, and reduced padding tighten the band without changing its height between modes. Shared column widths and cell padding keep the band aligned, and the band scrolls with the table on narrow screens.
- The availability count follows the copy locations and Home shown in the inspector, including staged changes in either mode. The pill reserves the group's maximum count width, keeping counts such as 8/10 and 10/10 centered without resizing. An asterisk outside the pill and a tooltip identify an unsaved preview without shifting the count. Browse counts continue to use applied data until Save. Discard restores the earlier location drafts, Reset restores applied locations, and metadata-only edits do not mark the count pending.
- The copy table retains ID / Status / Current Location / Note. IDs remain read-only, while locations and per-copy notes are editable. Group Notes remains below the table as a multiline input, with one Notes label instead of an Additional heading followed by Notes.
- There is one edit-mode Save Changes action below group Notes. It applies all shared fields, copy notes, and shown locations for this group in browser memory, including locations staged before entering Edit. Set All Home remains by the copy table.
- The owner explicitly chose keeping drafts on close. Close, Escape outside a native select, background dismissal, and switching groups retain unapplied editor drafts without a native confirmation. Reopening a group resumes its draft; a global Drafts button cycles through drafts even when filters hide the groups, without clearing filters. Drafts retain their editor scroll position when resumed.
- Discard removes that group's editor draft and returns to inspection, preserving locations staged before Edit was first opened. Save applies the editor and clears its draft. There is no editor Reset/Cancel ambiguity; the existing read-mode location Reset remains unchanged.
- A changed Home updates the designated group/copy home without moving physical copies. A visible helper explains this when changed. Set All Home is the explicit move action. This conservative prototype behavior is for owner review.
- Browse results remain based on applied data until Save. Saving refreshes derived counts/search/sort data without changing IDs; the inspector stays open if its entry leaves the active filter.
- Controls are not rebuilt on each keystroke or browse rerender. Sibling selection, view switches, and filters retain the same editor. Parked drafts remain distinct per stable group ID; one group's Save/Discard cannot apply or erase another's draft.
- Draft retention is browser memory only, not autosave or durable persistence. Refreshing/leaving the app still uses the browser's unload protection and loses drafts if the user proceeds. The removed warning was the in-app native discard confirmation, not the browser's unload safeguard.
- A miniature name is validated when saving. Unrelated missing Notes or other optional/incomplete metadata do not prevent changes; unknown current dropdown values and unspecified Paint are preserved. New taxonomy creation and detailed missing/n/a policy remain future work.

First review targets: overall cleanliness, header editing, Set/# width, Paint
placement, copy-note input density, footer reachability on ten-copy groups,
and whether keeping/resuming drafts feels natural. Native selects can clip long selected values;
their open option list exposes the full choice. No editor marquees are used.
On October 4, the owner accepted the latest layout for now, confirmed a clasp
upload, and requested a Git checkpoint of the editor and its refinements.

All 30 regression scenarios pass in local Chrome, with no browser script errors.
The October pass also checks the header Discard action, the checkbox's unspecified
state, Set # validation and conditional completeness, and availability across staged moves, Home edits,
draft recovery, Discard, Reset, and Save. Geometry checks also cover the band's
fixed read/edit height, Available's left alignment with ID, stable pill width and centered count, and Home control size,
styling, and alignment during horizontal scrolling.
Desktop and mobile screenshots were
reviewed in both modes, including an unspecified Paint value on mobile. The
owner accepted the current visual iteration. Next, review Save, Discard, draft
recovery, and Home/location behavior in the browser before designing creation.

The owner accepted a separate Miniature label for Set/Paint and the attached
Inventory summary band, emphasizing that availability must remain visible in
Edit. Both modes now use that structure; visual feedback will determine further adjustments. Adding
copies, editing sticker IDs, and creation remain outside this feedback pass.

### Future Flows Raised By The Owner

- New miniature groups may reuse this editor. Keep a provisional entry distinct from a real collection entry; explicit Save should be the candidate creation boundary, not clicking outside or opening another miniature. This is design groundwork, not authorization to implement creation now.
- Adding physical copies to an existing group may use staged rows in this table. Decide how users add/remove provisional rows and review quantity before applying; do not silently change totals while merely drafting.
- Correcting an individual sticker ID may belong near its row, but the narrow ID column and future validation/assignment workflow need a separate design conversation. Preserve stable copy identity if a displayed sticker changes; do not widen the table or add ID inputs in this iteration.
- A controlled catalog for sets and other dropdown values needs a maintenance flow analogous to the legacy datalists tab. Do not treat free typing in the miniature's Set field as a substitute for that flow.
- Adding groups/copies, sticker corrections, and catalog maintenance remain deferred until strategies are discussed. No real-sheet integration is a prerequisite for these UX experiments.

## September 12: Chosen Direction

The user selected option B (option 2 in the conversation): a focused editor in
the existing sidebar. The alternative comparison below is retained as history;
another A/B comparison is not a prerequisite. Detailed controls and behavior
still need iteration, and this selection is not authorization to build every
editing feature at once.

The user supplied read/edit screenshots from their PPQ Loot Chests app, which
also informed this project's original design. The relevant pattern is a stable
outer pane and contextual header, with the body changing from read presentation
to an actual form. Name becomes a labeled input, badge-like metadata can become
dropdowns, and header actions can change with mode (Edit Item becomes Cancel
in the example). Controls need not occupy the exact bounds of their read-only
representation. Preserve this app's header height, pane sizing, and browse layout;
do not copy the reference app's unrelated token controls or exact dimensions.

### Clarification: Preserve The Actual Inspector Layout

The user clarified that preserving just the outer sidebar is insufficient:
keep field order, grouping, and shapes as close to the current inspector as
possible. The earlier suggestion to remove the copy table or reorganize all
shared fields into a separate form is superseded. This is a distinct edit mode
with familiar contents, not a different screen inside the same outline.

- Preserve the existing top rows: Size / Creature Type / Race, then Sex / Role / Set. Do not move Paint into Set's place as previously suggested. Use dropdowns/inputs in those familiar positions; any split Set/Set # control needs a local layout trial.
- The user suggests removing Availability in edit mode and making Home editable in its Inventory area. Do not assume this authorizes moving copies when Home changes.
- Retain the copy table and allow each copy's individual Note to be edited. This explicitly expands the current editing discussion beyond shared metadata; ID/sticker editing is not implied.
- Keep group Notes below the inventory/table, editable in that familiar location. Name/Paint controls may adapt in the header as discussed, subject to fixed header-height and readability constraints.
- The user leaves continued Current Location editing to design judgment. Recommendation: retain it if one clearly scoped edit-mode Save/Cancel workflow covers the editable content, rather than adding competing metadata and location Save controls. This transaction policy remains a proposal.
- Preserve existing pending location changes across mode entry/exit; determine the save boundary explicitly. Cancellation should not silently erase work that predates entering edit mode.

Save/Cancel/Revert semantics, dirty-navigation protection, and Home behavior
remain decisions. The historical options and initial-session suggestions below
must be read subject to this clarification. No app code changed here.

## What The Existing Inspector Tells Us

- `renderDetail` in Scripts.html distributes shared fields across Name in the header, six Details cards, Home in Inventory, and Notes in Additional. Paint is shown only as an Unpainted tag when explicitly false.
- Set and Set # are separate values, composed by `getCollectionSummary`. Editing that display string directly would be ambiguous, especially with a year already in parentheses.
- Inventory has a separate, working location-draft workflow with Reset, Set All Home, and Save Changes. Those actions currently affect all copies in the selected group.
- `getMissingFieldLabels` treats even empty Notes as missing. A completeness indicator must not automatically become a rule that prevents unrelated edits from being applied.
- The read layout uses equal three-column cards, a stable header, single-line text, selective marquees, and 24px spacing between groups. Readability during editing may need different controls without altering the accepted browse/read layout.
- `renderAll` normally rebuilds detail HTML. Text editing must not reuse this on every keystroke and repeatedly replace inputs, caret positions, or focused controls.

## Options To Compare

### A. Transform The Existing Cards In Place

One Edit action makes shared fields editable where they already appear.

- Strongest spatial continuity: Role remains exactly where the user found it.
- A single group draft permits several related corrections before Apply.
- Name, Paint, split Set fields, and long Notes need exceptions to the read layout.
- Home and Notes straddle the copy table, so shared edits are scattered. Keeping inventory editable creates two drafts and competing Apply/Save controls.
- A reasonable variant keeps inventory visible but read-only while editing shared details. Existing location drafts must survive unchanged.

Best if correcting one visible trait with minimal visual change dominates use.

### B. Focused Edit Mode In The Same Sidebar

Keep the same outer pane and header height; temporarily replace its body with
a compact shared-fields form. Return to the existing inspector after Apply/Cancel.

- Retains group context without introducing an overlay or another drawer.
- Temporarily omitting the copy table brings Home and Notes near the other shared fields and leaves one clear action pair.
- Retain familiar Size/Type/Race and Sex/Role relationships where practical, rather than defaulting to a tall one-field-per-row form.
- Read-mode and edit-mode body layouts differ deliberately. Preserve the original inspection scroll and selected copy on return; do not animate card heights while typing.
- Naturally accommodates Name, an explicit Paint control, separate Set/Set # inputs, and a multiline Notes editor.
- Could later support a blank creation form, but do not let hypothetical creation requirements dictate this first edit prototype.

Current recommendation to test alongside A, not a settled replacement for the
user's original inline-edit direction. It avoids squeezing an entire editor into
a layout optimized specifically for reading and moving copies.

### C. Edit One Field At A Time

Click a value or small edit action to edit only that field, with local Apply/Cancel.

- Excellent for occasional single-field corrections; minimal layout disturbance.
- Repetitive for several changes and adds either many icons or a less discoverable click-to-edit convention.
- Multiple simultaneous mini-editors would make pending state and cancellation harder to understand.
- Potential later quick-edit shortcut, rather than the initial full editing foundation.

### D. Modal Editor

A separate dialog isolates shared changes and has a clear Apply/Cancel boundary.

- Provides more form width without changing the permanent inspector layout.
- Covers browsing context and adds another interface to design and navigate.
- Keep as a fallback if the sidebar genuinely cannot support readable controls, not the default merely because it is convenient to implement.

## Decisions That Matter Before Wiring

1. **Scope in Individuals.** Shared edits affect every copy, even when an individual is selected. Use concise edit-mode wording such as "Shared details - all 10 copies"; do not imply that changing Role changes only C16.
2. **Entry and exit.** Compare a compact Edit action beside Close with an action beside the Details title. The title-row option avoids crowding long names and tags but needs clear whole-group scope. Do not remove the only obvious way to close the inspector just to fit Edit. Keep header height fixed.
3. **One editing task at a time.** Recommend pausing location controls during shared editing while preserving existing location drafts. Applying shared changes must not apply location changes; cancelling shared changes must not discard them. Use distinct action labels where needed.
4. **Leaving with changes.** Clean edit mode can close freely. Dirty edits need an explicit discard/keep-editing choice before changing groups or closing. Clicking a sibling or toggling browse mode need not leave the same group's editor. Never discard on an incidental outside click. Drafts for many groups are an alternative, but add another discovery/recovery workflow and are not the smallest first step.
5. **Browse stability.** Prefer updating search/sort/filter results on mock Apply, not every keystroke. A changed Role may remove the group from a filter; keep the inspector available, like the existing location-save behavior. Renaming must preserve stable group/copy IDs.
6. **Field affordances.** Use finite choices for Size and Paint; decide how other vocabularies offer existing values without silently dropping an unfamiliar current value. Disable marquee while editing. Inputs should horizontally scroll their own text, not animate it. Split Set and Set # for editing, then recombine for display. Notes should expose the full editable text.
7. **Paint and missing values.** Explicit false is Unpainted; missing is not false. Do not automatically turn unknown paint into an unchecked boolean. Preserve blank/n/a values until their UX is agreed. A pre-existing missing field should not block a valid Role correction. Distinguish completeness warnings from invalid new input.
8. **Home is consequential.** Changing a group's designated Home is not necessarily physically moving its copies. The current mock holds Home on both group and copy objects and derives availability from copy Home/current location. Discuss whether a Home change merely reclassifies Home/Away or also offers a separate move action before enabling it. This is a later slice within editing, not a reason to delay testing Role/Size edits.
9. **Feedback and action placement.** Consider a compact footer within the editor's available pane, not beneath a long copy list. It must not cover Notes or validation messages. Apply can be disabled when unchanged. A restrained edited-field cue can help, but avoid another permanent row of status badges.
10. **Keyboard and validation.** Associate visible labels with controls; preserve caret/focus on updates; make Enter/Space/Escape behavior intentional. Explain invalid input next to its field rather than only recoloring it. Enter in multiline Notes must not submit. Returning from editing should restore a useful focus target.

The labeling and error-feedback baseline follows the
[W3C forms tutorials](https://www.w3.org/WAI/tutorials/forms/) and
[user notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/).
The layout preferences above are project-specific design judgments, not claims
that an accessibility standard requires a particular editor layout.

## Suggested First Session

- Compare A and B using one concrete correction: Spirit Folk Fighter's Role, followed by a second shared trait. Start with a layout/interaction prototype, not every field and edge case at once.
- Check the same edit from Groups and Individuals, especially the scope wording, entry action, and return to the selected copy.
- Include a long name, a long Set, and an already-incomplete group in the layout review even if those fields are not all wired yet.
- Choose the presentation before wiring Apply/Cancel and draft protection. Then expand field coverage in small slices, keeping Home's behavioral decision explicit.
- Keep current location drafts, the read-mode geometry, copy selection, and all existing browse regression cases intact. Add tests for edited values, cancellation, navigation, focus/caret, filter exit on Apply, and no cross-application of the two draft types.

No design choice here is approved solely by its inclusion in this document.
