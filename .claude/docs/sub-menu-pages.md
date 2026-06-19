# Sub-menu pages

Pages that sit *between* the main menu (`GameMenu.vue`) and an in-game
view — Game Setup, Saved Maps, Help, Tutorial, the New Game submenu —
all follow the same visual pattern. This doc captures the pattern so we
stop redoing the same back-arrow / title alignment work for every new
page.

## What counts as a sub-menu page

Any full-screen view where the user has navigated *into* something and
needs a clear way back. Identifiers:

- Mounted by `App.vue` against a `GAME_STATES.*` value (not on top of an
  active game).
- Renders a title at the top.
- Renders a "go back to the previous screen" affordance (typically an
  arrow at the top-left).
- Uses the brown / parchment palette established by `GameSetup.vue` and
  `LobbyPage.vue` — not the menu's `menu_background.png` plate.

Sub-menus that share the parent's background (e.g. `NewGameSubmenu.vue`
on `menu_background.png`) are a different family — they look like the
main menu and don't need this header treatment.

## Visual contract

| Element | Source |
|---|---|
| Page background | `/images/background.png`, `background-size: cover` |
| Back arrow icon | `/images/arrow_white.png`, flipped with `transform: scaleX(-1)` |
| Title | Centered, h1, `clamp(24px, 5vh, 36px)` |
| Panel surface | `#deae88` (parchment) for selected items; `#926846` (chocolate) for resting; `#5e3e26` for borders |
| Confirm dialog | `ConfirmDialog.vue` (or `ExitDialog.vue` for the specific exit case) — `error_plate.png`, z-index 10090 |
| Buttons (footer) | `#926846` brown plate with `#5e3e26` border; primary action `#5e3e26` |

## Header layout

The established pattern across `TutorialPage.vue`, `GameSetup.vue`,
and `SavedMapsPage.vue`: the back button is **absolutely positioned**
in the top-left corner; the title is a plain centered h1 with
**uniform** padding. The two elements live in different layout flows,
which is exactly what we want — the h1's centering is computed
against the viewport, not against the header row, so the title stays
visually centered no matter how wide the back button is.

The previous mistake was using **asymmetric** h1 padding (e.g.
`padding: 30px 90px 30px 70px;`) to "make room" for the absolute
arrow. The asymmetry then pushed the title off-center: `text-align:
center` centered the box, but the box was offset. Use uniform padding
and let absolute positioning keep the arrow out of the title's way.

```html
<button class="goBackBtn" @click="goBack" title="Back">
  <img :src="getImagePath('arrow_white')" alt="Back" />
</button>
<h1>Page title</h1>
```

```css
/* Page wrapper needs `position: relative` for the absolute button to
   anchor correctly. */
.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  padding: 0;
  z-index: 10;
}

.goBackBtn img {
  width: 40px;
  height: 40px;
  user-select: none;
  /* arrow_white.png already points left — render as-is, no transform.
     Do NOT add `scaleX(-1)`. The dark arrow.png also points left;
     both assets are oriented for "back" use out of the box. The flip
     is only needed for forward-action buttons that reuse the same
     asset (e.g. GameMenuOverlay's Resume button). */
}

.goBackBtn:hover img {
  filter: brightness(1.15);
}

.my-page h1 {
  margin: 0;
  padding: 30px;          /* uniform — NOT asymmetric to dodge the arrow */
  text-align: center;
  white-space: nowrap;    /* keeps multi-word titles on one line */
}
```

Notes:

- Vertical alignment between the arrow center and the title text
  center is approximate — they're in different flows so there's no
  flexbox/grid synchronising them. With the values above (`top:
  34px`, `padding: 30px`) they read as roughly aligned across the
  common viewport sizes. Don't redesign around this; the consistency
  with Tutorial/GameSetup matters more than the last few pixels.
- `LobbyPage.vue` still uses the old asymmetric-padding form; it can
  be migrated whenever it's next touched.

## Back-button arrow asset

Use `arrow_white.png`. Both `arrow.png` (dark) and `arrow_white.png`
(white outlined for the brown background) point **left** in the asset
itself — render as-is for back buttons, no `transform: scaleX(-1)`.
The dark version is fine on light in-game buttons (InfoPanel etc.)
but is hard to see on the brown sub-menu background; reach for the
white one on the brown pages.

## Two-column body layout (list + detail / preview)

Sub-menu pages that show a **list** on one side and a **detail panel**
(preview, settings, form) on the other use a responsive pattern that
mirrors `GameSetup.vue`:

- **≥ 760 px**: two columns side by side. Typical sizing is
  `grid-template-columns: minmax(220px, 320px) 1fr;` so the list has a
  sensible minimum and the detail panel takes the rest.
- **< 760 px (mobile)**: stacked, list on top, detail below. The list
  pane caps its own height (`max-height: 50vh`) so a long roster
  doesn't push the detail off the screen entirely — the user scrolls
  *within* the list to browse, then the page scrolls to reach the
  detail.

When this pattern is used, mobile selection should pull the detail
into view automatically:

1. On list-item click, call `selectItem(...)` which sets the active
   id **and** scrolls the detail into view.
2. Gate the scroll behind a viewport check: only do it when the
   layout is stacked (single column). On desktop both panes are
   already visible, so scrolling would be jarring.
3. Render a "↑ Back to the list" link below the detail panel. CSS
   hides it on desktop; on mobile it scrolls the page back to the
   list. The click handler is a plain `scrollIntoView` on the list
   pane ref. Use the up-arrow glyph (`↑`) rather than a left-arrow —
   on the stacked mobile layout the list is *above* the detail, so
   "up" is the literal direction the page will move.

```js
methods: {
  isMobileLayout() {
    return typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 759px)').matches
  },
  selectItem(id) {
    this.selectedId = id
    if (!this.isMobileLayout()) return
    this.$nextTick(() => {
      this.$refs.detailRef?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  },
  scrollToList() {
    this.$refs.listRef?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
}
```

Keep the breakpoint at **760 px** wherever this pattern shows up, so
the layouts switch in sync.

`SavedMapsPage.vue` is the canonical implementation — copy from there
when adding a new list/detail sub-menu.

## Where the back button should go

- Sub-menus reached **from another sub-menu** should return to that
  parent, not jump to `GAME_STATES.menu`. Example: Tutorial and Game
  Setup live under the New Game submenu now, so their back buttons
  route to `GAME_STATES.newGame`.
- Sub-menus reached from the lobby (Saved Maps in pick mode) should
  return to `GAME_STATES.lobby`.

## Confirmation dialogs

For "Are you sure?" prompts inside a sub-menu (delete, exit, leave) use
`components/dialogs/ConfirmDialog.vue`. Props:

- `message: string` — the question shown above the buttons.
- `handleConfirm`, `handleCancel: Function` — click handlers for the
  two buttons.
- `confirmLabel`, `cancelLabel?: string` — default to `Yes` / `No`. Set
  to `Delete` / `Cancel`, `Leave` / `Stay`, etc., as appropriate.

`ExitDialog.vue` is the original specific-case version with hardcoded
"Do you really want to exit the game?" text and `Yes` / `No` buttons —
keep using it for the in-game exit prompt only; prefer `ConfirmDialog`
for new prompts so we stop forking the same modal.

## Error / empty states

When a sub-menu finds nothing to show (no saved maps, no saved game,
network failure), bounce back to the page that opened it and surface
the message via `MenuError.vue`. The flow:

1. Sub-menu fires `emitter.emit('setError', message)`.
2. Sub-menu fires `emitter.emit('goToPage', parentState)`.
3. `App.vue` updates `currentError` (it listens to `setError`).
4. The parent page renders `<MenuError :error="currentError"
   :set-error="setError" />` (the props are already wired for
   `GameMenu.vue` and `NewGameSubmenu.vue`; add the same line to new
   parent pages as they appear).

The MenuError dialog uses the same `error_plate.png` plate as
ConfirmDialog/ExitDialog, so the visual lineage stays consistent.

## Checklist for new sub-menu pages

- [ ] Background is `background.png` (cover).
- [ ] Header uses the flex three-cell layout (back / title / spacer).
- [ ] Back button uses `arrow_white.png`, scaleX(-1).
- [ ] Back button routes to the actual parent (not the main menu) when
      the parent is itself a sub-menu.
- [ ] Confirmation prompts use `ConfirmDialog` (not `window.confirm`,
      not a one-off inline modal).
- [ ] Empty / error states bounce to the parent and emit `setError`.
- [ ] Brown palette: `#926846` (resting), `#deae88` (selected /
      highlight), `#5e3e26` (borders).
