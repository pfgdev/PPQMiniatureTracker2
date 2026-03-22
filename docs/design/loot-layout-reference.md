# Loot Layout Reference

Summary of reusable layout and interaction patterns from the `Loot Chests` app that should guide the Miniature Tracker rebuild.

## Core conclusion

The loot chest side-panel system is worth borrowing, but the desktop width animation should not be copied unchanged.

Recommended adaptation:

- keep the root class-toggle architecture
- keep contained scrolling
- keep outside-click close behavior
- preserve a true sliding desktop interaction where the list area also moves to make room
- do not use snap-open desktop behavior
- animate the layout in a controlled way so the sidebar and list shift together without ugly reflow or page growth

## Reusable patterns

### App shell and sizing

Use a centered shell with shared height tokens derived from one viewport-based base height.

Useful pattern:

- one shell-scoped `--scroll-base`
- derived max heights for list and detail panes
- shell width controlled by one shared max-width token
- side padding controlled by one shell token

### List/detail structure

Portable markup shape:

- one workspace wrapper
- one list card
- one detail aside

JS should drive this with a single root class such as `has-detail`.

### Detail open/close behavior

Desktop:

- the list area should visibly slide and make room for the detail panel
- the detail card should slide in as part of the same motion
- avoid abrupt snapping between closed and open states
- avoid any animation approach that causes chaotic text reflow or changing page height during the motion

Recommended implementation shape:

- use a root desktop state such as `has-detail`
- keep one visible list viewport shell
- keep one inner list stage that can translate
- keep one detail shell clipped to the final panel width
- keep one detail stage that translates in and fades up

Preferred animation strategy:

- animate outer clipping shells and transformed inner stages
- do not animate the width of the text-bearing inner content itself
- do not rely on pure `grid-template-columns` tweening for the desktop motion

This gives the feeling that the list is making room while protecting text from mid-animation re-measurement.

Tablet/mobile:

- stop using the desktop sliding sidebar pattern
- switch to stacked conditional detail rendering instead

### Scroll containment

This is one of the most important pieces to reuse.

Rules:

- use `min-height: 0` on grid and flex parents
- keep scrolling inside the list pane and detail pane
- use `scrollbar-gutter: stable`
- use matched explicit heights for list/detail regions in desktop detail-open mode

### Outside-click deselection

Reuse the pointerdown plus click pattern:

- track whether the interaction began inside the detail panel
- on click, close only if the target is outside all persistent interactive regions
- keep the whitelist logic explicit

This is better than a naive document click close.

## Click behavior contract

This interaction model should be treated as a core reusable behavior, not a detail.

Rules:

- clicking a new row opens the detail panel or swaps the currently shown detail content in place
- clicking the currently selected row closes the detail panel
- clicking empty/background space closes the detail panel
- clicking another row keeps the panel open and replaces the detail content without a close/reopen flicker
- clicking inside the detail panel does not close it
- clicking inside modals, popovers, menus, and other protected interactive zones does not close it
- row-level special controls get first claim on the event before generic row-open logic runs
- pointerdown state should be tracked so inside-panel interactions are not misread as outside clicks on release

Protected-zone examples:

- detail panel content
- modal dialogs
- row action buttons
- popovers
- menus
- filter controls

The important effect is that the detail panel feels safe and predictable even when the screen contains many kinds of interactive elements.

## Breakpoints worth borrowing

- `1020px`: top controls collapse for landscape tablet
- `980px`: desktop side-panel mode begins
- `979px` and below: switch away from desktop side-panel behavior
- `760px`: mobile collapse for filters, detail grids, and action clusters

## Styling lessons

What feels strong in the loot app is not a special font family so much as a disciplined type rhythm.

Useful rhythm to borrow:

- section headers around `22px`
- card headers around `26px`
- body copy around `13px`
- uppercase labels and tags around `11-12px`

The mini tracker should borrow the spacing, scale, and restraint more than any literal font choice.

## File guidance from the other project

Most relevant source files:

- `loot.css.html`
- `lootchests-shell.html`
- `loot-v2-scripts.html`

Shared styling references:

- `global.css.html`
- `v2-cards.css.html`
- `buttons.css.html`

## Direct implementation implications for this project

Next layout pass should focus on:

1. shell-level height tokens
2. fixed-feeling desktop workspace with contained list/detail scrolling
3. `has-detail` class toggle at the app root
4. coordinated desktop slide behavior where the list and detail move together
5. outside-click close using a persistent-target whitelist
6. same-row click closes, new-row click swaps detail in place, and blank-space click closes
7. tighter type and spacing rhythm in the browse table
