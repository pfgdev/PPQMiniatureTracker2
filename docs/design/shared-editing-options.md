# Shared Editing: UX Options

**Current status, October 8:** the app now reads the imported 2.0 snapshot while
all edits remain browser-only. Deleted groups and their unapplied drafts release
stickers immediately; they do not reserve them for Undo. Only an attempted restore
checks for subsequent reuse, leaving both records untouched if there is a conflict.
This supersedes the deleted-sticker reservation rules and mock-only data source
described in the historical checkpoints below. The approved Manage Lists dialog
now previews adding, renaming, and retiring dropdown choices, independently of
miniature Save/Discard. Applied list changes and unfinished list forms are still
browser-only; nothing writes to either spreadsheet. See the
[current handoff](recalibration-2026-09.md#current-direction-imported-preview-no-app-writes).

Prepared September 9, 2026 against `aff153d`; updated October 5 for the creation
and copy-management prototype. The original options remain discussion history.
Stay mock-only: creation, edits, and deletion use browser memory; no spreadsheet
connection or collection persistence. Only the next-sticker counter preference
is remembered in browser-local storage, as requested on October 6.

## Pre-Live Fix Pass: October 6

This approved pass supersedes earlier prototype limitations below. It does not
connect a spreadsheet or persist miniature records.

- Every copy ID is editable in the existing narrow ID cell. Changed IDs validate
  case-insensitively against unchanged siblings, saved records, parked drafts,
  and undoable deletions. Blank and explicit n/a remain allowed; unchanged legacy
  duplicates do not block unrelated corrections. Swapping two IDs within one
  group is supported. Internal copy IDs stay stable.
- Apply-ID targets the first blank retained copy in table order, including an
  existing blank. It skips n/a and does not follow selection, overwrite IDs, or
  append copies. The original saved ID remains reserved until Save applies a
  correction. Deletion Undo reserves saved IDs and unapplied corrections.
- Sequence preferences are draft-local until their editor saves. Discard/removal
  cannot leave the global cursor stranded at Z99. Other parked drafts may guide
  suggestions, but an unrelated metadata Save cannot persist their preference.
  The future authoritative catalog-minus-assignments TODO remains separate.
- A new group with zero copies remains a retained creation draft, not a blank
  existing group. It cannot publish until valid. Discard removes it completely.
- Set # accepts up to three alphanumeric characters beginning with a digit,
  including 4a and 5b. Without a named Set, the control is disabled and visually
  empty. Toggling back before Save restores the draft number; saving clears the
  inapplicable number. Untouched legacy values are preserved for named sets.
- A valid Paint cannot be cleared. Untouched legacy missing paint remains
  tolerated during unrelated edits. Empty Notes never lower Ready status.
- Small-screen selection, New, and draft recovery reveal the inspector header;
  subsequent typing does not jump the page. Desktop geometry remains unchanged.

See [the current handoff](recalibration-2026-09.md) for verification and live-data
gates. Earlier dated sections preserve the design history, not current limitations.

## More Filter Cleanup: October 6

The owner requested a cleanup of More, particularly dated Paint terminology and
missing paint statuses, and questioned whether dozens of long set names or a
scrollbar could fit cleanly. This prototype awaits development-site feedback.

- Following owner feedback, More follows the card's reading order: Role, Set, Paint status, Stickers. Paint uses a single three-column row at normal popover width, labelled Painted, Unpainted, In Progress. The last label retains Work in Progress as its actual value, tooltip, and accessible name; the editor's terminology/data are unchanged. Narrow panes retain the existing readable fewer-column fallback instead of widening the popover or clipping labels. Selecting several paint statuses matches any selected status; Role, Set, sticker, search, and location criteria combine with AND. Unsupported/missing legacy paint is included when no paint criterion is selected, never misclassified as a valid status.
- Set uses one full-width native dropdown with All sets as the default, not a tile for every set or three narrow columns of long names. Its 13px/600-weight typography now matches the facet tile labels. This first version filters one set at a time; the selected full name is also available through its title. The native option menu handles its own scrolling and keyboard type-ahead. Choices come from the mock catalog and saved collection, not filtered results or unpublished drafts. Keep catalog choices available even after the last group using one changes set.
- Stickers has a heading and two multi-select values, Assigned and Missing, replacing Needs stickers only. Following owner feedback, these use the same three-column tracks as Role/Paint at normal width, leaving the third slot empty instead of stretching each choice to half the row; the shared narrow-pane fallback remains. Missing means a blank/whitespace-only ID. Assigned means a recorded nonblank value, including explicit n/a for now; this preserves the resolved-versus-missing distinction without introducing the deferred third-state UX. Groups match if any copy has a selected state, so a mixed group can appear under either filter. Individuals match the particular copy. Selecting both matches either state, and no selection imposes no sticker criterion. Tooltips explain the current n/a and mixed-group treatment.
- Role and the other descriptive facets now include explicit Not specified and unfamiliar saved choices, preserving the existing canonical order. Not specified is not a synonym for unanswered blank data and is not a fourth Paint status.
- More's active count and Clear include Role, every selected paint status, Set, and every selected sticker state. Its Clear preserves the other facets/search/location; global Clear resets everything. Set and sticker selection retain keyboard focus, and scrolling within More is preserved across filter updates. Escape on the native Set control is left to its option menu instead of dismissing the containing popover/editor.
- Filter buttons now separate their label and count bubble with a 6px gap. The count remains centered with equal outer padding on either side of the whole label/badge pair, and button/badge heights remain 30px/18px. Only filter bars at most 320px wide use 9px rather than 11px symmetric button padding, keeping the owner's Type 5 / Sex 2 example on its existing row at 360px viewport width. A regression covers single-/double-digit counts and desktop/mobile spacing; three focused count/focus/More-layout checks passed with no browser script errors.
- More keeps the same outer width as the other popovers. An overflowing thin scrollbar uses existing right padding instead of narrowing or misaligning the content; both overlay and layout-space-consuming scrollbars are covered. Role/Paint grids use fewer columns only in narrow More popovers to preserve readable paint labels. Other facet layouts and editor dropdown styling remain unchanged.
- Height is capped by the existing 460px/72vh limit and the visible workspace. On short windows, More opens above the facet row if the space below is too cramped and the space above is better. Its header remains outside the scrolling body; Set names never increase the popover's height by being listed as tiles.
- The earlier broad 57-scenario run passed, followed by six affected rechecks for short-window/layout refinements. Two further scenarios cover the requested order/typography/single paint row and Assigned/Missing copy/group semantics, bringing the suite to 59 scenarios. Ten focused scenarios passed after these latest refinements, with no browser script errors; desktop/mobile screenshots were reviewed. Geometry checks include 1440, 1100, 980, 390, and 360px, a short 560px window, 65 extra long sets/roles, and a scrollbar forced to reserve real layout space.
- Dropdown catalogs can be managed in the spreadsheet later; an in-app administrative list editor is not required. Optional future filter gaps include availability/Home-versus-Away and more precise missing-data filtering; do not add controls for every field without a use case. Existing-ID editing, the top header labels, and end-to-end review remain separate next slices. No spreadsheet connection or persistence was added.

## Current Creation And Copy-Management Prototype: October 5

The owner approved reusing the sidebar editor and asked to implement the plan.
This prototype is ready for interaction and visual feedback, not final acceptance.

- A separate `+ New` button beside the Groups/Individuals switch opens creation from either mode. The header keeps its height and the toggle's 16px title gap. On a narrow browse pane the action becomes `+`, and the heading shortens to Browse when necessary; this responds to pane width, including desktop compression.
- Creation starts with blank character/set/name/Home/Paint fields and one provisional copy. The existing Details, Miniature, Inventory, and Notes order is preserved. Create Group is the explicit publication boundary; the draft and its copies do not appear in browse results before creation.
- Creation requires a name, Home, at least one retained copy, and deliberate selections for Size, Creature Type, Race, Sex, Role, Set, and Paint. Each added copy needs a current location. Set # is required for a named set and retains its three-digit validation; `n/a` and explicit Not specified do not require a number. Notes may be blank. Editing an existing incomplete group remains possible without filling unrelated omissions.
- Dropdowns start visibly blank, not labelled Not specified. Blank means unanswered and blocks creation for these required choices. Not specified is a separate, saved option for descriptive metadata except Paint; `n/a` remains a deliberate selection where applicable. Home still requires a location, not an unspecified choice. Draft recovery preserves these distinct states, and the missing-field badge does not treat explicit Not specified as an unanswered descriptive field.
- Create Group stays dimmed/disabled until those requirements and sticker/Set # checks pass. Its state updates with edits, copy additions/removals, and draft recovery; its tooltip explains the first blocker. The button and Save action share validation, so bypassing the disabled control cannot publish an invalid draft. Existing-group Save Changes retains its current behavior.
- Close/navigation retains the new draft, and Discard removes it and returns to the prior selection when available. `+ New` reopens an existing unfinished new group instead of producing repeated empty drafts; the global Drafts action also recovers it through filters. Existing editor/location drafts remain separate.
- `+ Add new copy` appends one provisional row per click in creation or editing. It starts at Home and follows Home changes until its location is explicitly edited. Existing copies retain their current locations when Home changes. Set All Home explicitly moves all retained draft copies.
- Only newly added copies get compact sticker inputs within the existing 44px ID column. Blank IDs are allowed, text is trimmed on Save, and assigned stickers are checked case-insensitively against other active copies, siblings, and recoverable deleted groups. Literal `n/a` is exempt from duplicate-code checks. Existing sticker corrections and an explicit Cannot take a sticker choice remain later work; long IDs may need the proposed popover/modal.
- Copy remove buttons share the Note cell with its input, reserving the same small space in each editable row. All four column widths, Home alignment, and scrollbar placement remain intact. Newly appended rows can be cancelled immediately; existing rows show Will be removed and Undo until Save. Counts preview retained rows, while browse counts wait for Save. Stable copy identities are never renumbered or reused.
- Removing the last existing copy points to Delete group rather than silently deleting the group. A draft with no retained copies cannot be saved. Discard restores copy additions/removals and preserves location staging that existed before Edit.
- Delete group is a quiet footer action on existing groups. It opens an inline confirmation naming the saved group and copy count; Cancel/Escape dismisses that confirmation without closing the editor. Confirming removes the saved group and all its copies from both browse modes. Undo deletion restores the most recent deleted group, stable identities, prior location staging, and its unapplied editor draft. Its stickers stay reserved while Undo is available.
- A matching existing name produces an informational suggestion to edit that group and add copies; it does not silently merge distinct groups. Filters are preserved on creation, and the inspector explains when its saved entry falls outside current browse results.
- Paint is a standard dropdown beside Set with exactly three status choices, ordered Painted, Unpainted, Work in Progress. The owner explicitly rejected Not specified for Paint. New groups start blank and need one of those three choices before creation; the save guard also rejects unsupported nonblank statuses. Legacy booleans still display correctly. Missing/unsupported legacy values appear as a dash and remain flagged missing, rather than being labelled Unpainted or offered as extra statuses. Unrelated edits preserve the original stored paint value. Painted only matches Painted explicitly, never other nonblank status strings.
- Long per-copy and group Notes reuse the read-mode marquee: clip without wrapping or ellipsis, pause two seconds, scroll slowly, pause two seconds, and reset to the start rather than reversing. Only overflowing text moves. Travel has no ten-second cap, preserving slow speed for long notes. Original fonts, margins, card/row heights, text, and tooltips remain intact. Reduced-motion preference disables animation; editable notes remain ordinary input/textarea controls.

Review targets: the compact ID input, remove controls beside notes, placement
of Add new copy, draft recovery, and the inline deletion/Undo flow. The blank
versus `n/a` sticker TODO stays in the later sticker UX work. Header label cleanup
remains the separate Header System Pass. No Git/clasp upload was requested for
this prototype.

Validation: all 42 Chrome regression scenarios passed in a full run after the
Paint dropdown and Notes marquee refinements, with no browser script errors.
Coverage includes live enable/disable updates, the Save guard, each required
choice, conditional Set #, and draft/save/reopen round trips. Paint checks cover
legacy booleans, option order, Work in Progress, and Painted only in both browse
modes. Note checks cover exact text, fonts/margins/heights, both pauses, slow
travel, reset, reduced motion, and static edit controls. Existing-group editing
and desktop/mobile geometry also pass. Desktop/mobile screenshots were reviewed,
including the dropdown and both note marquees.
Tests verify unchanged column widths, remove controls contained in Note, and
space for a common three-character sticker code. `TEST_FILTER` can select
scenarios by name for focused local rechecks; it must match at least one.
After removing Not specified from Paint, eight affected editor, paint-filter,
creation, and blank-choice scenarios passed again. Notes marquee behavior was
unchanged.

## October 6 Feedback And Sticker Convenience Proposal

The owner considers the authoring flow good and manual sticker entry adequate,
but would like a fast way to use the next unassigned sticker in a sequence such
as D91, D92. After accepting the direction, the owner clarified that the shortcut
was ready for implementation. It is now implemented for mock-only UX review.

- After comparing the original appearance, the owner accepted Option 3: the original two-pixel blue outward outline with `outline-offset: 1px`, plus a compensated three-pixel left scroll gutter (`padding-left: 3px; margin-left: -3px`). This is restored. The clipping boundary expands without moving or resizing fields, headers, or table columns. The inset (-2px) option is not used. Fonts, dropdown arrows, and native option menus are unchanged. Preserve this accepted treatment rather than repeating the original/inset comparison; Paint's separately requested dropdown and other authoring/sticker work remain untouched.
- The last full run passed all 52 Chrome regression scenarios after the automatic-start/counter-memory correction, with no browser script errors; nine affected shortcut scenarios also passed separately. After restoring accepted Option 3, four focused focus/layout/copy-control scenarios passed with no browser script errors. Focus coverage includes existing/new flows at 1440, 1100, 980, and 390px: the compensated gutter preserves the original control geometry and gives outward rings clearance. Desktop/mobile screenshots were also reviewed. Shortcut layout checks include 360px, keeping headers, columns, editor height, and relative button positions stable when the label changes. Existing storage checks exercise automatic discovery, empty collections, counter-only reload persistence, malformed/stale stored IDs, and blocked embedded-browser storage.
- `+ Add new copy` and `Apply B92` (showing the actual next proposed ID) sit together, with Set All Home on the right. The Apply button reserves a stable 100px width; narrow action rows can wrap without squeezing table columns. No new table column, wider ID cell, or modal was added. Manual entry remains available.
- Each click fills the first blank new-copy sticker field from top to bottom. If rows 2 and 3 are blank, the first click fills row 2 and the second fills row 3. It never appends a copy or overwrites an ID. Neither input focus nor the blue individual-selection highlight changes the target; only Add new copy appends rows. Existing-copy IDs remain read-only, including existing missing stickers.
- The owner rejected requiring a manually entered first sticker. The shortcut is now ready on entry: load a valid remembered next ID, otherwise scan the collection's highest valid letter-plus-two-digit ID and continue after it, or start at A00 if none exists. This fallback does not backfill historical holes below the latest sticker. Current mock data ends at M07, so a blank new-copy row immediately offers Apply M08. Saved preferences take precedence but assigned/reserved codes are still skipped. Manual entry remains optional and can choose another sequence; it is never required to enable the shortcut. Without a blank new-copy row, or when exhausted through Z99, the action is disabled with an explanatory tooltip.
- Save remembers the next available applied-sequence ID in browser-local storage, separately namespaced for mock and collection mode. Only that small preference survives reload: no miniature data or drafts are persisted, and no spreadsheet call is made. Merely suggesting/applying a draft ID does not advance the stored counter; parked drafts are excluded when saving the preference, so reload does not burn their uncommitted IDs. Invalid storage values fall back to collection scanning; a blocked local-storage API does not prevent using the in-memory counter. Collection-wide/server-side persistence remains future integration work, not part of this mock UX change.
- Data-storage TODO accepted by the owner: replace the browser-counter source of truth with the legacy-style difference between the full ordered sticker catalog and stored assignments, excluding temporary draft reservations. Apply-ID and any future sticker picker should share this availability list, including earlier unused IDs. Load the catalog and assignments together, update availability locally during edits, and revalidate uniqueness on durable Save; do not make a server request per button click. Availability must be reconstructible across sessions/devices from stored data; a remembered cursor may be a preference only. Leave the current mock shortcut in place until the data-storage phase; this feedback does not authorize spreadsheet integration now.
- The owner uses A00 through A99, then B00 through B99, continuing by letter and preserving two digits: A99 advances to B00, never A100. Suggested IDs use uppercase letters; manually entered casing is preserved. The action skips saved IDs and reservations in the active draft, parked drafts, and undoable deleted groups (including their unapplied additions), case-insensitively. Save validation also checks other drafts to prevent manual cross-draft duplicates. Merely displaying a suggestion does not consume it; adding it reserves it in that draft, while removal/Discard releases the reservation. Only Save applies assignments in mock memory.
- Beyond Z99 is deferred because it is not a near-term concern. The current shortcut stops and disables itself with an explanation rather than inventing an ordering after Z99. Literal n/a does not select a different sequence or consume a numbered ID. No native prompt or mandatory bootstrap step was introduced.
- Other remaining UX slices: correct/reassign existing stickers and explicitly distinguish missing from Cannot take a sticker; maintain the option catalogs used by Set/Home and other dropdowns; review the passive top labels and wrapping. The owner's permission to remember this counter locally does not authorize real-sheet integration or collection persistence.

## Editor Baseline: October 4 Refinements

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
- October 5 sticker follow-up: creation may allow a blank ID, but blank means an assignment is missing and may warrant a warning. Explicit `n/a` means a sticker cannot be used (for example, the miniature is too small) and must not be treated as missing. Design an explicit choice for this state, potentially in a sticker-entry popover or modal, instead of depending on the user remembering to type `n/a`. This remains a later sticker UX task; see the roadmap's Post-UI TODOs.
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
