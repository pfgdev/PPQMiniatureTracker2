# Groups / Individuals Integration Plan

Prepared 2026-09-08 against `3c5a79d`. This is a code-grounded planning pass,
not authorization to implement everything below. Integration here means wiring
the approved selector into the mock application, NOT spreadsheet integration.

## Current Status: Accepted For This Phase

The user reviewed and accepted the mock-only Groups / Individuals refinements
on September 9. This phase is closed out for now; shared-editing UX is next.
The detailed original checklist remains historical planning and a broader
review/test backlog, not a claim that every optional enhancement was implemented.

- [x] State-driven Groups / Individuals switch, retaining the approved selector geometry.
- [x] Nine group rows versus 28 independently identified copy rows, with centered sticker ID and current location plus Home/Away badge.
- [x] Same-copy search/location predicates, inherited metadata facets, copy-specific Needs stickers, and mode-aware empty state/counts.
- [x] Natural ID/current-location sorts, existing shared sorts, and clearing incompatible sorts on switch.
- [x] Sibling selection targets a copy without closing its group inspector. Group details continue to show every sibling.
- [x] Desktop copy reveal/highlight, copy identity independent of sticker text, and distinct accessible identities for No ID rows.
- [x] Copy highlight hides in Groups and returns in Individuals without rebuilding the inspector or clearing selection. Final-row highlights follow the table's rounded corners without changing cell dimensions.
- [x] Mode-specific browse scroll memory, preserved detail/horizontal scroll, keyboard focus, and global Unsaved navigation.
- [x] Saved-snapshot browse locations/filtering/sorting for this prototype; drafts stay in the inspector until mock Save. This follows the recommended default and is still an explicit UX review point, not a separately confirmed user decision. Groups' location filter now follows this same snapshot rule.
- [x] Save/Reset/Set All Home retain group scope; action tooltips describe it. A saved copy leaving a filter does not abruptly close the inspector.
- [x] Twenty regression scenarios passed in local Chrome, including 600 synthetic copy rows and unchanged header/column/row geometry. No browser script errors.

### September 9 UX Refinements

- Entering Individuals with an inspected group restores a matching remembered copy, or selects the group's first copy in the current results. Reveal it near the fifth visible browse row when scroll limits allow; a short viewport prioritizes visibility. This takes precedence over old browse scroll memory when a copy is selected.
- If filters exclude every copy, leave the parent inspector open without a copy highlight. Never clear filters to force a selection.
- In Individuals, clicking a non-control part of an inspector copy row selects it in both tables and reveals its browse row if offscreen. Enter/Space on a focused copy row also selects it. Re-selecting does not close the inspector; dropdown interactions do not change selection. Hidden siblings can be selected in the inspector without changing browse filters.
- Dismissing a facet or location popover with a background click leaves inspection and pending work intact. A subsequent background click retains the existing inspector-dismissal behavior.
- Three-digit totals use tighter horizontal pill/cell padding, not smaller fonts or wider columns. Synthetic 99/100 -> 100/100 checks passed at 1440, 1100, 980, and 390px; full 100/100 pills fit without changing row heights or column positions. Larger digit counts are not yet a readability guarantee.
- ID bubbles remain deferred as a separate visual experiment. The owner approved scrolling/selection and popover dismissal in browser review; all behavior remains mock-only.

### Accepted Popover Click-Through Behavior

Investigated September 9 and deliberately left as-is after owner review:

- Clicking blank space while a facet/location popover is open dismisses that popover without closing the inspector. This is the owner's main use case and is covered by regression tests.
- Clicking an actual browse row behind/outside the popover also performs that row's normal action. A different row selects it; the already-selected row can close inspection. The owner does not currently consider this a bug.
- `handleRootClick` calls `dismissOutsidePopovers` and stops event propagation, preventing `handleDocumentClick` from also dismissing inspection. It intentionally continues through the root handler, so explicit row/button actions still execute. `stopPropagation()` alone cannot suppress those later statements in the same handler.
- If accidental row actions become a problem, consume the dismissal click before row selection: retain the helper's boolean result and return before the browse/detail row handlers for the applicable targets. Decide separately whether explicit controls (filter switches, dropdowns, Close) should retain their normal action; do not turn all popovers into modal blockers by accident.
- Before changing that policy, add regression cases for different-row and already-selected-row clicks with each popover open, plus ordinary row clicks after dismissal. Keep blank-space dismissal, staged changes, and dropdown behavior covered. No further change is scheduled unless use reveals a problem.

Deliberate first-pass tradeoff: the location label and badge share a fixed
180px content frame within the existing third track, leaving the badge intact
at the wider desktop collapsed edge. Long labels truncate with a full-value
tooltip. This does not change any column widths or pane ratio; it does need
visual approval, especially for Mounts & Misc. Creatures. The existing narrower
desktop pane still clips most or all of the third column.

Nonblocking follow-ups: long-location treatment, draft feedback and group-action
clarity, broader device/zoom/manual checks, and any desired Away-only or exact-
sticker-navigation enhancement. Next phase is shared-editing UX, separately
scoped before implementation. Creation, sticker management, and spreadsheet
integration remain later work.

## Scope And Success

Confirmed requirements:

- Stay entirely on mock data and browser-only saves. No sheet reads/writes, imports, authentication work, or new persistence.
- Keep the approved Groups / Individuals selector beside Browse Minis: 16px horizontal gap, 1px downward transform, existing styling and header height.
- Group mode retains the current table. Individuals mode substitutes sticker ID for `#`, Current Location plus Home/Away treatment for Home, and one row per physical copy. Name, Size, Type, Race, Sex, Role remain inherited from the group.
- Both views open the same group inspector. Do not introduce a separate individual detail layout.
- Preserve rounded clipping, stable column positions, compact row heights, and independent desktop scrolling. Do not casually retune the group table or inspector width.
- Main motivations: inspect a box's actual contents, locate away copies, and provide a useful foundation for later sticker work. Individual notes are not a user-prioritized justification for this phase.
- Build and review in small slices. The checklist is not a mandate for a single large implementation.

The core acceptance exercise is: select Encounter Box G in Individuals mode,
see C16 rather than all ten Spirit Folk Fighters, open its group, and identify
the selected copy without losing the surrounding context.

Not included automatically: shared editing, creation, sticker assignment,
cross-group bulk moves, direct editing in browse rows, a new notes column,
database semantics for unassigned versus n/a stickers, or a broad header redesign.
An Away-only filter and exact-sticker auto-navigation are companion proposals,
not features already present or automatically approved by approving the toggle.

## Existing Implementation Map

References are function names rather than fixed line numbers, which will move.

| Area | Current pattern | Integration consequence |
| --- | --- | --- |
| `Code.js`, `buildMockAppState_`, `createMockGroup_` | Nine groups, 28 copies. Copy has stable `id`, `miniNumber`, `sticker`, `currentLocation`, `home`, and a mock `note`. | Derive individual rows from this model; no second inventory store or schema migration. |
| `Scripts.html`, `state` | `selectedRootId`, shared search/location/facets, one sort, global drafts keyed by copy ID. No browse mode or selected-copy state. | Add explicit view state and copy selection without moving or clearing drafts. |
| `buildShell`, `handleRootClick` | Preview buttons only change their own `aria-pressed`; early return avoids rerendering and document close handling. | Replace preview behavior with a real mode action. Render selection from state; remove preview wording only when wired. |
| `enrichGroup` | Clones copies, computes saved availability, caches one group search string containing every sibling's fields. | Do not reuse this aggregate string as the individual row's search index. Avoid stale derived copy references after mock saves. |
| `getFilteredGroups`, `matchesStructuredFilters` | Search is a case-insensitive substring; location matches group home OR any copy's effective location. Needs stickers is a group-level `some`. | Separate shared predicates from copy predicates. Matching a parent must not automatically admit every sibling. |
| Facet functions | OR within each category, AND across categories. More contains Role, Painted only, Needs stickers only. Button counts indicate active selections, not result counts. | Keep these meanings. A new flag must be included in defaults, clear, badge counts, rendering, and tests. |
| `renderTable` | Always calls `getFilteredGroups`; all row identities/highlights use `rootId`. Header width classes also determine cell widths and centered first-column sorting. | Add a row-level representation and mode-specific header definitions; retain the eight tracks and shared cells. |
| `sortGroups`, comparison helpers | One tri-state sort. Available count starts descending, other keys ascending. Natural text comparison; semantic size order. | ID is not availability, and current location is not home. Use semantic keys and a deliberate switching policy. |
| `ensureSelectionVisibility` | Runs before every full render and closes inspector if parent fails group filters. | Must distinguish explicit filtering from pending edits and mode changes. Otherwise an edit can close its own inspector. |
| `handleRootClick`, `handleRootKeydown` | Clicking the already-selected root closes details. Enter/Space on rows delegates to click. | Clicking another copy of the same parent must select that copy, not close details. |
| `renderDetail`, `renderCopyRow` | Inspector shows all siblings. Copy ID is attached to the select, not its row. | Add a stable target/selected treatment for the copy row; do not filter siblings out of the inspector. |
| `renderAllPreservingScroll`, `captureFocus` | Full innerHTML rebuild, focus recovered using IDs/data attributes, scroll restored now and next animation frame. | Preserve unique copy identity and avoid scroll restoration undoing an intentional copy reveal. |
| `captureScrollState` | Saves page, browse vertical, detail vertical offsets; not nested table horizontal offsets. | Narrow-screen rerenders can reset horizontal scrolling. Include this in the mode-switch strategy. |
| `getEffectiveLocation`, draft actions | Inspector uses draft location, while availability is saved-state. Save/Reset/Set All Home operate on the selected GROUP. | Choose consistent browse membership/display/sort rules for pending moves, and make action scope clear. |
| `review-changes` | Cycles dirty groups, clears hiding filters based on `getFilteredGroups`, then selects a root. | In Individuals mode it must locate an actual dirty copy, not just a parent that happens to pass group filters. |
| `renderSummaryLane`, `renderListHeader` | Summary uses group counts; old header count is now hidden behind prototype. | Count active-mode results truthfully; avoid a second visible header row. |
| `Styles.html` | Fixed table layout, explicit percentages/padding, `--mini-v2-browse-table-width`, rounded outer clip. | Add mode-specific cell internals, not content-sized columns. Beware partial clipping of a nested badge. |
| `tests/regression.cjs` | Nine scenarios, including a test requiring preview clicks NOT to change the table. | Replace only the obsolete preview expectations when integration begins; retain its geometry/keyboard checks and all other regressions. |

## Proposed Behavioral Contract

These are recommended starting rules, not claims that the user has approved
every detail. The review gates below identify the meaningful tradeoffs.

### 1. View State And Rendering

- [ ] Introduce `browseMode` with Groups as the reload default. No local storage for now.
- [ ] Derive Individuals rows from current groups and copies, e.g. references plus `rootId`, `copyId`, and stable source order. Do not flatten a previously filtered group list as the sole filtering step.
- [ ] Keep one source of truth. `saveSelectedDraftChanges` replaces group/copy objects, so never hold a stale flattened cache across saves.
- [ ] Give the active result pipeline an explicit boundary used by table, visible count, selection checks, and empty state. Separate filtering from sorting so a new view cannot inherit an irrelevant sort key.
- [ ] Keep shared metadata rendering and escaping reusable. Do not duplicate all group rendering into an unrelated second table implementation.
- [ ] Clicking the selected mode is a no-op. Switching preserves query and filter values, and never saves or discards edits.
- [ ] Close any open filter/location popover predictably on a real switch; preserve its applied values. Do not let the document outside-click handler close the inspector as a side effect.
- [ ] Avoid rebuilding the inspector for a view-only switch when its parent/data has not changed. This protects dropdown focus, detail scroll, and marquee timing without requiring a broad rendering rewrite.

### 2. Search And Filters

- [ ] Groups: retain current broad substring matching and OR/AND facet semantics unless a specific change is reviewed.
- [ ] Individuals: match shared metadata OR that copy's own identifier/sticker/location fields. Never use the aggregate parent string containing all sibling stickers and locations.
- [ ] Combine copy predicates on the SAME copy. Searching C16 and filtering Quest Minis must yield zero, not C18 because it shares a parent with C16.
- [ ] Individuals location dropdown means current location only. A group whose home is Dwarves must not appear as a physical copy currently in Dwarves when its only copy is in Quest Minis.
- [ ] Preserve the existing group location meaning initially (home OR copy location), and document its difference from Individuals. Keep the chosen location value on switch. Use mode-appropriate accessible labeling/help; consider visible wording only if the difference remains confusing in review.
- [ ] Shared facets (Size, Type, Race, Sex, Role, Painted) apply to parent attributes. Needs stickers applies to the individual copy in Individuals mode, not every child of a group with one unassigned copy.
- [ ] Do not redesign blank/n/a sticker meaning now. Preserve current mock behavior and make the predicate a reusable boundary for the later sticker phase.
- [ ] Source code contains mock copy-note data/search despite the user's not treating individual notes as a current use case. Do not add note editing or a browse notes column. If preserving the existing searchable field, restrict it to the matching copy rather than siblings.
- [ ] Clear filters keeps the selected mode and follows current behavior of not clearing sorting. Empty states describe the active result type without clearing the query or reverting modes.
- [ ] Keep free-text substring behavior for the first slice. Exact-sticker ranking or auto-opening needs a separate rule: do not unexpectedly jump while a user is typing A1 on the way to A12. Existing roadmap step 10 is an optional follow-up.

### 3. Sorting And Counts

- [ ] Shared sort keys are Name, Size, Type, Race, Sex, Role. Preserve their active direction across mode switches.
- [ ] Use distinct keys for `avail`, `home`, `sticker`, and `currentLocation`. Do not reuse `avail` for ID just because it occupies the same column.
- [ ] Recommended initial switching rule: clear an incompatible sort to source order; do not silently turn highest-availability into descending sticker order or Home into Current Location. Per-view sort memory is an alternative if users find the reset disruptive.
- [ ] ID/current location start ascending. Retain tri-state ascending/descending/off and centered ID label/indicator, including existing first-column special alignment.
- [ ] Use natural sticker ordering (A2 before A12) without coercing identifiers to numbers or dropping zeroes. For ties, use name, stable parent order, and copy order/ID so equal rows do not jump.
- [ ] Unassigned sticker placement should be deliberate (recommend after assigned stickers in either direction); no new interpretation of literal n/a values in this phase.
- [ ] Do not mutate `state.groups` or `group.copies` while sorting browse results; inspector copy order remains stable.
- [ ] Visible summary counts active-mode rows and names the unit, e.g. `Visible 9 groups` / `Visible 28 individuals`. Keep the selector/header geometry unchanged.
- [ ] Total Groups and global Unsaved retain their meaning; Unsaved counts edited copies in either view. Sticker Work currently counts groups: keep its unit explicit instead of silently making the number mode-dependent.
- [ ] Update or remove the obsolete hidden header-count renderer intentionally. Use one polite count announcement if adding a live region, not multiple duplicate announcements.

### 4. Selection And Inspector Continuity

- [ ] Track `selectedRootId` and nullable `selectedCopyId`. Copy identity is the internal stable ID, never sticker text, displayed name, row position, or sorted index.
- [ ] Individual browse rows carry both parent and copy identifiers. Reuse the existing `data-copy-id` convention carefully: current change handling matches selects, so adding it to rows must not broaden that handler accidentally.
- [ ] Clicking a different sibling keeps the inspector open and changes the target copy. Clicking the SAME selected copy may retain the current click-again-to-close behavior; test both mouse and keyboard.
- [ ] Only the selected individual row gets the primary selected highlight. Do not highlight all siblings because their root matches. A group-only selection may have no highlighted individual until a copy is chosen.
- [ ] Switching Individuals -> Groups retains the parent. Switching back can recover the last selected visible copy of that parent; never select an unrelated first result merely to fill the panel.
- [x] Updated September 9: when switching from a group with no chosen copy, select its first matching copy and reveal it in browse with context. Restore a remembered matching copy when possible; preserve filters when there is no match.
- [ ] Keep the full group inspector and all its copies visible even when the browse list is filtered to one copy. Do not turn shared metadata into per-copy metadata.
- [ ] Add a stable identifier and a non-color-only accessible indication to the target inspector row. Choose restrained visual emphasis distinct from Away/Unsaved backgrounds.
- [ ] On explicit copy selection, reveal only that row within the detail scroll host after DOM/layout is ready. Avoid scrolling the whole page or changing left-list position. Do not force keyboard focus into a select for a mouse selection.
- [ ] Do not repeat reveal/highlight scrolling on every search keystroke, draft rerender, resize, or marquee sync. Cancel stale scheduled reveals after rapid selection/close/switch.
- [ ] On explicit user filter/search changes, retain existing close-if-selection-no-longer-matches behavior where practical. Mode changes and editing are separate events; do not blindly run the old group-only visibility check for every reason.
- [ ] If switching modes removes the selected copy from the results, keep the valid parent inspector without a falsely selected browse row. Do not clear filters behind the user's back just to preserve a highlight.

### 5. Pending Edits And Action Scope (Review Gate)

Current inconsistency: group search/availability use saved copy state, but the
location dropdown filter uses draft-aware effective locations. The new view
must not accidentally filter on one location while displaying or sorting another.

Recommended starting policy to review: browse locations, location filtering,
Away filtering, and location sorting represent the last mock-saved snapshot.
The inspector continues to show staged locations and Unsaved feedback. Rows do
not disappear or reorder under the user until Save. A restrained pending cue in
browse rows can identify the saved-location/draft distinction without replacing
Home/Away information. Applying this consistently to Groups' location predicate
would change its existing draft-aware behavior, so obtain agreement rather than
silently changing it as part of a refactor.

Alternative: browse follows effective draft locations immediately. This can
work, but then we must retain the editor when its row leaves the filter, handle
changing sort positions, and clearly indicate pending status. Do not ship a
hybrid where counts, badges, sort, and filtering disagree.

- [ ] Decide the snapshot policy before wiring location predicates. Put all new copy-location display/filter/sort/status decisions behind one consistent helper/policy.
- [ ] After a mock Save removes the selected row from a location/Away result, keep the inspector available for context/undo-like staging rather than abruptly closing it. Clear the browse highlight if there is no matching row; subsequent explicit filter changes follow their normal selection rule.
- [ ] Reset restores only that group's drafts. Switching mode or closing details never resets drafts. A global Unsaved action can find pending work from either view and reveal a dirty copy if applicable.
- [ ] Reset / Set All Home / Save Changes remain GROUP-scoped, even if the browse list shows one copy. Do not silently reinterpret them as row-scoped or cross-group actions.
- [ ] Review whether current labels make that scope sufficiently clear. Example: selecting C16 in Encounter Box G and pressing Set All Home will also stage C18 in Quest Minis home. Filtering the browse list must not imply that only C16 is affected.
- [ ] Preserve the current inspector Unsaved group count, global pending count, and unload warning. Ensure a disabled action losing focus lands somewhere sensible without collapsing details.

### 6. Geometry And Accessibility

Read-only local Chrome measurements at `3c5a79d` (not new layout targets):

| Viewport | Table width | Third-column width | Visible third-column width, inspector open |
| --- | --- | --- | --- |
| 1440 / 1280 | 1176px | about 247px | about 195px |
| 1100 | 996px | about 209px | about 2px |
| 980 | 876px | about 184px | 0px |
| 390 | 1020px horizontally scrollable | about 214px | about 49px at initial horizontal position |

Desktop header height was 56px and group rows 33px; at 390px they were 53px and
35px respectively. Measurements depend on browser/font rendering. Preserve
baseline per viewport, not one newly hardcoded height everywhere.

The longest mock location text measured about 149px; the existing Home badge
about 53px. Text + badge + a small gap + cell padding exceed the 195px visible
budget even at wide desktop widths with the inspector open. A cell's 247px
layout width is NOT its visible width. Simply appending a badge at the end of
that cell can cut the badge in half at the panel edge.

- [ ] First prototype/test the location label and badge against the actual clip edge, not only the expanded table. There is no guaranteed zero-tradeoff fit with every current constraint.
- [ ] Keep location-then-badge as the initial requested reading order. If it fails, present alternatives: fixed shorter text budget with full-value reveal, badge-first with clipped location text, or a reviewed change to pane/column room. Do not silently reorder content or resize the inspector.
- [ ] Do not use a badge that moves left during the panel slide as an unnoticed workaround for stable columns. Any content-level movement must be evaluated alongside the original no-shift requirement.
- [ ] At 980-1279px the third column is already mostly hidden when details are open. Record this pre-existing limitation separately from regressions. Decide whether accepting it for this phase is sufficient or whether it blocks the box-contents workflow at the user's normal width.
- [ ] Preserve the eight track widths (6 / 22 / 21 / 16 / 8.5 / 12.5 / 7 / 7 percent) and special metadata padding until a reviewed exception is needed. Semantic CSS names may need separating from width roles so ID retains the centered first track.
- [ ] Current Location header, sort indicator, IDs, and badges must stay single-line. Ensure ID/header triangle do not overlap and long IDs cannot enlarge the first track.
- [ ] Plain sticker text instead of an availability pill may shorten rows; the existing copy badge may size differently under inherited browse styles. Compare row height in every mode/status, not just header height.
- [ ] Do not reuse `.mini-v2-status-cell` unchanged: it permits wrapping. Do not transplant copy-table fixed column widths or dropdown rules into the browse table.
- [ ] Both Home and Away must be explicit text, not just color. Avoid confusing copy Home/Away with group Ready/completeness.
- [ ] Keep pressed state mutually exclusive and state-driven; normal Tab, Enter, Space, visible focus. The existing native-button pattern can remain; do not add tab/radio roles without implementing their associated keyboard behavior.
- [ ] Reveal full clipped text through an accessible name/title as a minimum; touch/keyboard readability still requires review. Do not add dozens of browse marquees as a default fix.
- [ ] Preserve mobile horizontal scrolling for both tables and restore the appropriate nested scrollLeft on rerender. Scroll only the needed host for copy reveal.
- [ ] Introduce at most a small mode-specific styling surface; retain the existing colors, spacing, header, and selector's optical nudge.

### 7. Identity, Scroll, And Scale

- [ ] Drow Ranger Captain already has TWO unstickered copies. They must remain separate clickable rows. Recommended temporary display: a clearly labeled `No ID` placeholder with accessible copy number/internal identity; whether visible per-copy numbering is needed is a small UX review, not a sticker database decision.
- [ ] Duplicate sticker text must never collapse row identity or target the wrong copy. Search may return both; do not auto-open an arbitrary match.
- [ ] Remember browse scroll per mode if useful, including horizontal position. Restore it only for an unchanged query/filter/sort context; otherwise go to the relevant selection or start. Do not blindly transplant a deep 28-copy scroll offset into nine groups.
- [ ] Ensure zero-result -> results restoration recalculates desktop width. `syncDesktopLayoutMetrics` currently also measures the empty wrapper; avoid an empty-state width changing column anchors.
- [ ] Keep per-event derived work bounded: calculate result rows once per render where practical. Avoid calling a full flatten/filter/sort for every row or every summary chip.
- [ ] Use larger synthetic mock datasets to measure rendering and scrolling; no real inventory connection. Do not introduce pagination, virtualization, or framework changes without evidence that they are needed.

## Implementation Slices

### Slice A: Rules And Geometry Proof

- [ ] Review location/badge fit, pending-location policy, and inspector group-action scope using concrete examples above.
- [ ] Confirm incompatible-sort fallback and selected-copy behavior using the recommended defaults unless the user prefers otherwise.
- [ ] Extend test fixtures in the harness only where existing mocks cannot exercise the cases; preserve the current app examples for visual comparison.
- [ ] Agree whether Away-only filtering belongs in this phase or its next small iteration.

### Slice B: First Functional Mock Switch

- [ ] Introduce mode state, derived individual results, and mode-specific headers/rows.
- [ ] Wire selector through normal event/state flow, preserving its exact styling.
- [ ] Make search, existing facets, location matching, sort, empty state, and visible count mode-aware together; do not present the first switch as complete while these still lie about individual results.
- [ ] Add stable copy selection so choosing a sibling cannot close the inspector.
- [ ] Run baseline tests plus identity/filter/sort/geometry tests. Stop for visual and interaction feedback.

### Slice C: Inspector And Draft Continuity

- [ ] Add explicit selected-copy targeting, detail-only reveal, and clear highlight/accessibility.
- [ ] Integrate the reviewed pending-location policy, filtered-out selection behavior, action scope, and global Unsaved navigation.
- [ ] Preserve focus and scroll through switch, edit, Save, Reset, filters, resize, and rapid sibling selection.
- [ ] Test and review with the user before adding another workflow.

### Slice D: Optional Companion And Final Tuning

- [ ] If agreed, add Away-only in More rather than another toolbar: Individuals means that copy is away; Groups means at least one copy away. Update every flag clear/count/filter path. Retain the chosen flag on switches.
- [ ] Decide separately whether exact-sticker Enter navigation/highlighting or automatic opening is warranted; no automatic mode switch merely because a query resembles a sticker.
- [ ] Test long strings, unassigned copies, nested scrolling, zoom, and large mock results; tune only demonstrated issues.
- [ ] User reviews the box-contents/return-location task before declaring the phase complete. Commit/push when requested; the next main phase remains shared editing, not sheet integration.

## Test Matrix

### Existing Mock Oracles

These are initial-state expectations before staging any edits. Group counts
retain the current home-or-current-location interpretation; Individuals counts
use the proposed current-location-only predicate.

| Query/filter | Groups | Individuals |
| --- | --- | --- |
| None | 9 | 28 |
| Search `a12` | Zhent Soldier | A12 only |
| Search `C16` + location Encounter Box G | Spirit Folk Fighter | C16 only |
| Search `C16` + location Quest Minis | Spirit Folk Fighter under current aggregate matching | 0 (C16 is not C18) |
| Location Encounter Box G | Spirit Folk Fighter | C16 only |
| Location Quest Minis | Bregol Jagstone + Spirit Folk Fighter | A97 + C18 |
| Location Spare People | 3 groups | 18 copies |
| Location Dwarves | Bregol Jagstone | 0 copies |
| Location Drow | Drow Ranger Captain | 2 distinct unstickered copies |
| Needs stickers only | Drow Ranger Captain | Those same 2 copies |
| Type Beast | Warhorse | M07 |
| Away-only, if implemented | 3 groups | A97, C16, C18, D25 (4 copies) |

### Automated Checklist

- [ ] Rework the preview-only regression: assert rows/headers/counts DO change, but selector bounds, header height, 16px gap, 1px transform, keyboard operation, and stable layout do not.
- [ ] Switch repeatedly with filters, all sort states, open/closed details, zero results, and dirty copies across multiple groups. No state leakage or browser errors.
- [ ] Test the mock oracles above, case-insensitive/trimmed queries, shared-name matches, sibling exclusion, and same-copy AND matching.
- [ ] Add synthetic mixed assigned/unassigned siblings; current Drow fixture alone cannot detect admitting assigned siblings under Needs stickers.
- [ ] Add A2/A12/A120, A01/A1, blank/long/duplicate sticker labels, duplicate group names with distinct roots, and a one-copy/zero-copy group. A zero-copy group stays a group but produces no individual rows.
- [ ] Test all tri-state sorts, natural IDs, tie stability, ascending/descending Size, clearing incompatible sort, and unchanged inspector copy order.
- [ ] Clicking A12 -> A55 stays open; clicking selected A55 again follows agreed close behavior. Enter/Space follows the same identity rules.
- [ ] Switch from parent-only selection, selected copy, and filtered-out selected copy. Closing clears relevant selection but not drafts.
- [ ] Select C16 from the box filter: inspector shows all 10 siblings and identifies C16. Verify Set All Home's GROUP scope includes C18; do not change it to a filtered subset accidentally.
- [ ] Stage C16 home while filtering Encounter Box G, then Reset and Save in separate runs. Verify row membership, badge/location/sort/count agreement, focus, inspector continuity, and global Unsaved under the chosen policy.
- [ ] Stage changes in several groups; cycle Unsaved from both views with search/location/Away/Needs-sticker filters that hide the pending copy. Each pending group remains reachable.
- [ ] Group A12 staged away then Set All Home still clears its draft. Test multiple dirty siblings and save/reset scope across views. Reload returns mock data; beforeunload warns only while pending.
- [ ] Verify text escaping in new headers, IDs, locations, badges, titles, and data attributes. Keep the existing safe initial-state serialization test.
- [ ] Sample geometry during opening/closing as well as after settling. Include active sort indicator and each badge state. No height changes, partial status pills, moving column anchors, or clipped right border regression.
- [ ] Cover 1440, 1280, 1100, 980, 979, 760, and 390 widths, short viewport heights, browser zoom, and manual real-browser font rendering. Separate known medium-width clipping from new regressions.
- [ ] Preserve browse/detail/page scroll and nested horizontal scroll through edits. An intentional selected-copy reveal must not be undone by the next animation-frame scroll restore.
- [ ] Test reduced motion for any new reveal/highlight, rapid toggles, rapid sibling clicks, disabled-button focus fallback, popover open during switch, and selected button pressed-state synchronization after every rerender.
- [ ] Exercise a synthetic large copy list with most copies under one parent and many one-copy parents. Record actual event timing/scroll usability; optimize only demonstrated hot paths.

### Manual Review Gates

- [ ] Header selector still looks exactly like the approved prototype.
- [ ] ID and Current Location are useful and readable with the inspector open, including the long drawer name and unassigned copies.
- [ ] Mode, result count unit, and location meaning are understandable without permanent instructional prose.
- [ ] Clicking one copy clearly identifies it without making group-scoped actions look copy-scoped.
- [ ] Pending moves behave predictably while hunting down away copies.
- [ ] User considers the box-contents workflow useful enough to accept the phase; do not equate passing automated tests with UX approval.

## Review Evidence And Next Session

The planning pass read the current server mock builder, client event/render/query
paths, layout/animation CSS, existing roadmap, and regression harness. A temporary
local Playwright probe measured the unmodified template and counted mock copies;
the geometry and fixture oracles above come from that probe, not guessed widths.
No application source or deployment was modified by this planning pass.

At preparation time the next action was Slice A. With the functional build now
available, resume with user feedback on location/badge fit and pending-move
behavior before adding a companion feature. This document preserves alternatives
so we can decide them at the relevant iteration instead of expanding scope.
