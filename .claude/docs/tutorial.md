# Tutorial System

The tutorial is a guided, scenario-driven mode layered on top of the
single-player engine. It reuses `DinoGame.vue` (and every engine that
sits underneath it) — there is no parallel `DinoGameTutorial`. A few
hooks in `DinoGame`, plus a small controller / hint UI, are enough to
script the entire experience as data.

---

## File Layout

| File | Role |
| --- | --- |
| `frontend/src/game/tutorialScenarios.js` | Scenario definitions (5 scenarios), shared field-construction helpers (`makeCell`, `makeField`, `placeBuilding`, `placeUnit`, `clearArea`, `makePlayers`), shared step predicates (`towerDefenderDead`, `playerOnHabitation`, `playerOnObelisk`, `towerLimitReached`, `scrolledToBottomRight`), and the `loadCompletedScenarios` / `markScenarioCompleted` helpers backed by `localStorage`. |
| `frontend/src/game/mixins/tutorialMixin.js` | Tutorial state and plumbing that lives on the `DinoGame` instance: the three lock-state data flags, the `tutorialFirstProductionDone` latch, the three `tutorial:*BlockChanged` event subscriptions, the `isAnimating → tutorial:animatingChanged` watcher, the `applyTutorialFirstProductionOverride` and `getTutorialContext` methods. Keeps `DinoGame.vue` itself down to one-line guards. |
| `frontend/src/components/tutorial/TutorialPage.vue` | The scenario-list screen (back arrow + list of scenarios with ✓ ticks for completed). |
| `frontend/src/components/tutorial/TutorialController.vue` | The orchestrator. Mounted **inside** `DinoGame` (`v-if="tutorialScenario"`); subscribes to the event bus, advances steps, drives the hint, emits the lock-state events. |
| `frontend/src/components/tutorial/TutorialHint.vue` | The hint UI (text + optional note + optional image + OK button or pulsing dots + click-to-shift). |

### Convention: `// [tutorial]` markers

Every tutorial touchpoint that *can't* live in the mixin — guards in
`DinoGame` methods (`if (this.tutorialScenario) …`), the
`emitter.emit('tutorial:*', …)` calls inside `moveUnit` /
`runBirthSequence` / `processEndTurn` / etc., and the template
`v-if` / prop bindings — is prefixed with a `// [tutorial]` line
comment. Grep `[tutorial]` in `DinoGame.vue` for the complete list of
inline hookups.

`GAME_STATES` in `frontend/src/game/const.js` gained two states:

- `GAME_STATES.tutorial` — scenario list (`TutorialPage`)
- `GAME_STATES.tutorialGame` — `DinoGame` mounted with the chosen scenario

`TUTORIAL_COMPLETED_KEY` is the `localStorage` key for the completed-set
(`{ scenarioId: true }`).

---

## App-Level Routing

`App.vue` owns `currentTutorialScenario` (the resolved scenario object)
and `tutorialRunId` (incremented on every start). The `:key` for the
tutorial-mode `DinoGame` element is built from both so re-entering the
same scenario forces a full remount (fresh field, fresh engines, fresh
controller).

```
[GameMenu  ─Tutorial─▶ GAME_STATES.tutorial]
                          │
                          ▼
                  TutorialPage  ─click scenario─▶ emit 'startTutorialScenario'
                                                       │
                                                       ▼
                                          App.startTutorialScenario(id)
                                                       │
                                                       ▼
                                          GAME_STATES.tutorialGame
                                          DinoGame :tutorial-scenario=...
```

The Help page (`GameHelp.vue`) also exposes a "Start tutorial" button
that emits `goToPage` with `GAME_STATES.tutorial`.

---

## Scenario Data Model

A scenario is a plain object:

```js
{
  id: 'moving',
  title: '1. Moving',
  description: 'Learn how to move your dinos',

  // Optional flags
  useEliminationWin: true,             // honour the usual win check
  firstProducedSpeed: 1,               // force the very first batch's speed
  firstProducedSpeedForbidden: 5,      // OR re-roll if it lands on this
  initialScroll: [3, 3],               // informational only

  // Full INITIAL_SETTINGS-shaped object
  settings: { ... },

  // Per-player FieldEngine setting overrides
  playerOverrides: {
    1: { minSpeed: 1, maxSpeed: 1, maxUnitsNum: 5 },
  },

  // Field + players
  buildField() { ... },                // returns Cell[][]
  buildPlayers() { ... },              // returns Player[]

  // Optional custom goal (replaces / overlays the elimination check)
  goal: { check(ctx) {...}, description: '...' },

  // Step list
  steps: [ ... ],
}
```

### Step Schema

```js
{
  id: 'force-end-turn',            // optional jump target (skipTo)
  text: 'Press End turn.',         // string OR (ctx) => string
  note: 'Click message to move it.',
  anchor: 'near-end-turn',         // see "Hint anchors"
  anchorCell: [12, 12],            // optional — pin to a board cell
  image: 'obelisk',                // optional illustration above text
  waitFor: 'turnEnded',            // see "waitFor values"
  params: { ... },                 // depends on waitFor
  highlightCells: [[13, 10]],      // pulse highlight + scroll
  check: (ctx) => boolean,         // re-evaluated on every state change
  skipIf: (ctx) => boolean,        // step-entry-only skip
  skipTo: 'force-end-turn',        // skip target id
  forceEndTurn: true,              // lock all but End turn
  forceUndo: true,                 // lock all but Undo
  lockAll: true,                   // lock everything (cells + buttons)
  invisible: true,                 // hide the hint while step waits
  isEnd: true,                     // last step — triggers completion overlay
  onEnter: (ctx) => void,          // optional setup callback
}
```

### `waitFor` Values

| Value | Advances when … |
| --- | --- |
| `ok` | Player clicks the hint's OK button |
| `unitSelected` | `GameGrid.selectUnit` emits `tutorial:unitSelected` |
| `unitMoved` | Move animation has completed (`tutorial:moveFinished`) |
| `unitReached` | After every completed move, if `params.coords` cell holds a player-0 unit |
| `turnEnded` | `DinoGame.processEndTurn` emits `tutorial:turnEnded` |
| `turnStarted` | `DinoGame.startTurn` emits `tutorial:turnStarted` AFTER production; `playerIdx === 0` filter |
| `nextUnit` | `selectNextUnit` event fires |
| `scrolled` | The grid container reaches `params.edge` (`right`, `left`, `bottom`, `top`, or the corners `bottom-right` etc., or `any`) |
| `towerCaptured` | `DinoGame.moveUnit` emits `tutorial:towerCaptured` after a real ownership transfer (filtered against same-owner no-ops) |
| `undone` | `DinoGame.undoLastMove` emits `tutorial:undone` |
| `unitKilled` | `DinoGame` emits `tutorial:unitKilled` (move-kills and birth-kills). `params.killerPlayer` defaults to `0` (the human) |
| `unitLimitReached` | Passive check: `units.total + towers.empty > units.max` (matches `InfoPanel.unitsOverLimit`) |
| `scouted` | The existing `scoutArea` event fires |
| `goal` | `scenario.goal.check(ctx)` returns true |
| `win` | `tutorial:gameWon` with `playerIdx === 0` |

`check`-based steps are not gated by `waitFor` at all — they advance
whenever the predicate becomes true.

### `ctx` (TutorialContext)

`getTutorialContext()` in `DinoGame` returns:

```js
{
  getField:        () => this.localField,
  getCurrentPlayer: () => this.currentPlayer,
  getCurrentStats: (playerNum) => this.getCurrentStats(playerNum),
  fieldEngine: this.fieldEngine,
  players: this.players,
}
```

All step predicates (`check`, `skipIf`, `text` when functional, `goal.check`)
receive this object.

---

## Event Bus Surface

`TutorialController` listens to existing game events:

```
selectNextUnit  ─▶  onNextUnit
scoutArea       ─▶  onScouted
```

…and to new tutorial-only events emitted by `DinoGame`:

| Event | Emitted from | Notes |
| --- | --- | --- |
| `tutorial:unitSelected` | `GameGrid.selectUnit` | `{ x, y }` |
| `tutorial:moveFinished` | `DinoGame.moveUnit` (end of try block) | `{ fromCoords, toCoords }` |
| `tutorial:turnEnded` | `DinoGame.processEndTurn` | currentPlayer index |
| `tutorial:turnStarted` | `DinoGame.startTurn`, **after** `restoreAndProduceUnits` | currentPlayer index — moved post-production so passive checks (goals, `unitLimitReached`) see new counts |
| `tutorial:towerCaptured` | `DinoGame.moveUnit` | `{ x, y, player }` only when ownership actually changes |
| `tutorial:undone` | `DinoGame.undoLastMove` (move-undo path) | — |
| `tutorial:unitKilled` | `DinoGame.moveUnit` (neighbour-kill) and `DinoGame.runBirthSequence` (kill-at-birth) | `{ coords, killerPlayer, count, cause? }` |
| `tutorial:gameWon` | `DinoGame.checkEndOfGame` | currentPlayer index |
| `tutorial:animatingChanged` | `DinoGame.watch.isAnimating` | bool |
| `tutorial:scrollingChanged` | `GameGrid.handleTutorialCenterOn` (around `centerOnCell`) | bool |
| `tutorial:inputBlockChanged` | `TutorialController` (watcher) | bool — gates cells + Next unit |
| `tutorial:endTurnBlockChanged` | `TutorialController` (watcher) | bool — gates End turn + `'e'` shortcut |
| `tutorial:undoBlockChanged` | `TutorialController` (watcher) | bool — gates Undo + middle-mouse |
| `tutorialHighlight` | `TutorialController` step watcher | `[[x, y], ...]` to glow, or `null` |
| `tutorialCenterOn` | `TutorialController` step watcher | `[x, y]` — `GameGrid` smooth-scrolls and brackets it with `scrollingChanged` |

`DinoGame` subscribes to the three `tutorial:*BlockChanged` events
**in `created()`** rather than `mounted()`. The child `TutorialController`
runs its `immediate: true` watchers during its own setup, which happens
**before** the parent's `mounted` hook — subscribing later would lose
the initial emission for step 0.

---

## Lock Model

Three independent gate flags, one event each, one piece of `DinoGame`
data each:

| Flag | Blocks |
| --- | --- |
| `tutorialInputBlocked` | `GameGrid.processClick` (cells), `InfoPanel` Next-unit button |
| `tutorialEndTurnBlocked` | `InfoPanel` End-turn button, `DinoGame.processEndTurn`, the `'e'` keyboard shortcut |
| `tutorialUndoBlocked` | `DinoGame.canUndo` (so the Undo button disables) and `DinoGame.undoLastMove` (middle-mouse shortcut) |

The right-click context menu and the gear (Menu) button stay enabled
in every lock state — players can always inspect cells and quit.

`TutorialController` derives the three from the active step:

| Step kind | input | end-turn | undo |
| --- | --- | --- | --- |
| `waitFor: 'ok'` | ❌ | ❌ | ❌ |
| `forceEndTurn: true` | ❌ | ✅ | ❌ |
| `forceUndo: true` | ❌ | ❌ | ✅ |
| `lockAll: true` | ❌ | ❌ | ❌ |
| anything else (default action-waiting) | ✅ | ✅ | ✅ |

The `lockAll` flag is used by the "scroll to corner" step (scenario 1),
where the only meaningful action is a viewport change.

---

## Skip & Advance

`TutorialController.advance()` increments `stepIndex` and then calls
`resolveSkipIf()`. The latter is a synchronous loop:

```
while (currentStep has skipIf+skipTo and skipIf(ctx) is true):
    stepIndex = findIndexById(skipTo)
```

Two safety rails:

1. **Never backwards** — `skipTo` indices must be greater than the
   current `stepIndex` or the loop bails out. Keeps scripts safe even
   if a writer mis-targets a previous id.
2. **Iteration cap** — 50 hops max, then bails (defensive against
   accidental cycles).

`skipIf` is evaluated on step entry (inside `advance()`) **and** mid-
step from `checkPassiveConditions`, but always **after** `check`. The
order matters when a step's `check` and `skipIf` share a predicate:
satisfying `check` advances linearly to the follow-up, and the early
return prevents `skipIf` from then jumping past it. When `check` and
`skipIf` are different predicates (e.g. scenario 3's multikill task —
`check` = "all stationary enemies dead", `skipIf` = "tower defender
already dead"), `check` won't fire on the wrong event and `skipIf` is
free to take over.

---

## Hint Display

`TutorialHint` accepts:

- `text` — already resolved to a string by `TutorialController.resolvedText`
  (handles the `(ctx) => string` form)
- `hintNote` — small italic note below the body. Triggers click-to-shift.
- `anchor` — one of:
  - `center`, `top`, `bottom`, `top-left`, `top-right`, `bottom-left`,
    `bottom-right`
  - `near-end-turn`, `near-undo`, `near-next-unit`, `near-menu` — pinned
    to the matching button via `calc(50vw ± ...)`, since `InfoPanel` is
    a centered `max-width: 400px` plate.
- `anchorCell: [x, y]` — looks up the rendered cell via the
  `data-cell-x` / `data-cell-y` attributes on `GameCell` and recomputes
  on `scroll` + `resize`. Falls back to "below the cell" unless that
  would overflow the viewport, then flips above.
- `image` — resolved via `getImagePath`, rendered above the text (56×56,
  pixelated). Used by the building-explanation steps.
- `showOk` — true iff `step.waitFor === 'ok'`.

When `hintNote` is set, the hint becomes click-to-shift: clicking
anywhere except the OK button toggles a `shifted` state that flips the
anchor to the opposite screen edge. Used to let the player push the
hint out of the way when it overlaps a cell they need to click.

`TutorialController.hintSuppressed` hides the hint entirely while
`gameAnimating` (move / birth / death) or `gameScrolling`
(tutorial-initiated `centerOnCell`) is true. The animation can finish
on screen before the next message appears.

---

## DinoGame Surface

`DinoGame.vue` opts in via `mixins: [gameCoreMixin, tutorialMixin]`.
Everything that *can* be encapsulated lives in `tutorialMixin.js`;
the guards that remain in `DinoGame.vue` change game-flow behaviour
at the call site and are tagged with `// [tutorial]` comments so
they're greppable.

### Prop

```js
tutorialScenario: { type: Object, default: null }
```

When set, the controller behaviour below kicks in. When null, the
component runs as a standard single-player game.

### From `tutorialMixin`

Data:

```js
tutorialInputBlocked: false,       // cells + Next-unit
tutorialEndTurnBlocked: false,     // End turn button + 'e' shortcut
tutorialUndoBlocked: false,        // Undo button + middle-mouse
tutorialFirstProductionDone: false // latch for the first-batch override
```

Methods:

- `handleTutorialInputBlock(b)`, `handleTutorialEndTurnBlock(b)`,
  `handleTutorialUndoBlock(b)` — toggle the matching data flag.
- `applyTutorialFirstProductionOverride(births)` — runs after the
  first turn that actually produces a unit. Honours
  `firstProducedSpeed` (force every newly produced dino to a fixed
  speed; recomputes visibility if `visibilitySpeedRelation` is on) and
  `firstProducedSpeedForbidden` (re-roll if the random speed landed on
  the forbidden value). Latches `tutorialFirstProductionDone` so the
  override only fires once.
- `getTutorialContext()` — see [`ctx`](#ctx-tutorialcontext).

Lifecycle:

- `created` subscribes to `tutorial:inputBlockChanged`,
  `tutorial:endTurnBlockChanged`, `tutorial:undoBlockChanged`.
  `beforeUnmount` unsubscribes.
- A `watch.isAnimating` forwards animation transitions as
  `tutorial:animatingChanged`.

### Behavioural Guards (`if (this.tutorialScenario) …`)

| Method | Tutorial guard |
| --- | --- |
| `loadFieldOrGenerateNewField` | Use `scenario.buildField()` instead of `engine.generateField()` |
| `loadOrCreatePlayers` | Use `scenario.buildPlayers()` instead of `createPlayers(...)` |
| `created` (after FieldEngine construction) | `fieldEngine.setPlayerOverrides(scenario.playerOverrides)` |
| `saveState` | No-op (tutorial sessions never write to localStorage) |
| `checkEndOfGame` | Skip the elimination check unless `scenario.useEliminationWin === true`. Never sets `state = STATES.ready`. Still emits `tutorial:gameWon`. |
| `checkSkipReadyLabel` | Always return true (no "get ready" / "Player N wins" screen) |
| `selectNextPlayerAndCheckPhases` | Skip the `lastPlayerPhase` trigger so the "only player left" notice can't fire mid-scenario |
| `startTurn` (after births) | When births occurred, pass `null` to `initTurn` instead of `scrollCoords` so the camera stays parked on the last birth cell |
| `processEndTurn` / `'e'` shortcut | Early return if `tutorialEndTurnBlocked` |
| `undoLastMove` | Early return if `tutorialUndoBlocked`; emit `tutorial:undone` at the end of the move-undo path |
| `canUndo` | Returns false if `tutorialUndoBlocked` |
| `exitGame` | Routes to `GAME_STATES.tutorial` instead of `window.location.reload()` |

### Template Additions

- `<ReadyLabel v-if="state === STATES.ready && !tutorialScenario" />` —
  belt-and-suspenders against any future path landing in `STATES.ready`
  during a scenario.
- `<TutorialController v-if="tutorialScenario" :scenario="…" :get-context="getTutorialContext" />`
- `<InfoPanel :input-blocked="tutorialInputBlocked" :end-turn-blocked="tutorialEndTurnBlocked" />`
- `<GameGrid :input-blocked="tutorialInputBlocked" />`

---

## Engine / Mixin Changes

### `FieldEngine`

- `playerOverrides` slot + `setPlayerOverrides(overrides)` setter.
- `playerSetting(player, key)` helper: returns
  `playerOverrides?.[player]?.[key]` if defined, else `this[key]`.
- `restoreAndProduceUnits` now reads `minSpeed`, `maxSpeed`, and
  `maxUnitsNum` via `playerSetting(curPlayer, …)`. The per-player path
  is identical to the engine-wide path when no overrides are set.

### `gameCoreMixin.getCurrentStats`

Honours `tutorialScenario.playerOverrides[playerNum]` for `maxUnitsNum`
and `maxBasesNum`, so the bottom-panel limits in the HUD match what
production will actually enforce for that player.

### `GameGrid`

- Listens for `tutorialHighlight` (set the pulsing cell overlay) and
  `tutorialCenterOn` (smooth-scroll, with the
  `tutorial:scrollingChanged(true/false)` bracket).
- `selectUnit` emits `tutorial:unitSelected({ x, y })`.
- `selectNextUnit` now uses `centerOnCell` (smooth) instead of an
  instant `scrollTo` — same animation as the move/birth flow.
- `processClick` early-returns when `inputBlocked` is true.
- New prop `inputBlocked`. New data attributes `data-cell-x` /
  `data-cell-y` on `GameCell` so `TutorialHint.anchorCell` can locate
  cells via the DOM.

### `InfoPanel`

- New props `inputBlocked` (Next-unit) and `endTurnBlocked` (End turn).
- `<GameMenuOverlay>` is wrapped in `<Teleport to="body">` so it
  escapes `InfoPanel`'s `z-index: 1` stacking context and can layer
  above the tutorial hint (`z-index: 10050`). Overlay z-index bumped
  to `10080`.

### `ExitDialog`

- Overall z-index raised to `10090` (above hint, end-scenario overlay,
  and gear menu) so the exit confirmation is always reachable.

---

## Scenarios Cheat-Sheet

| # | Title | Highlights |
| --- | --- | --- |
| 1 | Moving | 50×50, single dino, scripted "select / move / end turn / scroll-to-corner / next-unit / undo / reach highlighted target" walkthrough. Demonstrates `forceEndTurn`, `forceUndo`, `lockAll`, `anchorCell`, click-to-shift hints. |
| 2 | Towers | 20×20, 1 human, no enemies. `firstProducedSpeedForbidden: 5` keeps the variety lesson honest. Custom `goal: total units ≥ 10`. |
| 3 | Combat | 15×15, 1 human + 1 bot. `playerOverrides[1] = { minSpeed: 1, maxSpeed: 1, maxUnitsNum: 5 }` — only the bot's re-spawns are slow. `useEliminationWin: true`. Includes the kill-defender → `forceEndTurn` → spawn-kill lesson with an `invisible` turn-bridge step. |
| 4 | Buildings | 20×20, 1 human + 1 bot. Three tasks (10 dinos / 10 towers / produce a speed-10 dino) backed by `check` predicates. The "limit reached" lesson uses `unitLimitReached` followed by a `forceEndTurn` step and a dynamic `text(ctx)` that prints the live counts. |
| 5 | Fog of war | 22×22, fog on, `visibilitySpeedRelation: true`. `firstProducedSpeed: 1` so the "slow dinos see farther" lesson always lands. New `scouted` trigger gates the "click an unrevealed cell" task. |

---

## Adding a New Scenario

1. Define the scenario object in `tutorialScenarios.js`, push it into
   the `SCENARIOS` array, export it from there.
2. Implement `buildField()` using the placement helpers
   (`placeBuilding`, `placeUnit`, `clearArea`). Mark the player base
   with `player = 0`, enemy bases with `1`, and use `null` for
   unowned/empty.
3. Implement `buildPlayers()` — usually `makePlayers(1, N)`.
4. Decide on `useEliminationWin` + `goal`. Pick a `playerOverrides`
   table if you want the bot to play by different rules.
5. Write the `steps` array. For every action-waiting step:
   - Pick a `waitFor` (see the table) or a `check` predicate.
   - If the player should be locked to one button, set `forceEndTurn`,
     `forceUndo`, or `lockAll`.
   - If a future objective might be already satisfied (e.g. the player
     killed the boss out of order), give the affected steps `skipIf` +
     `skipTo` and tag the destination with `id`.
   - Use `anchorCell` when the hint should pin to a specific cell,
     plus `note` to enable click-to-shift.
   - For lessons that need live counts, use `text: (ctx) => '...'`.
6. If your scenario needs a new event, add the emit in `DinoGame`
   (existing pattern: `emitter.emit('tutorial:<eventName>', payload)`)
   and a handler in `TutorialController`. Document the trigger in this
   file and update the `waitFor` literal in the step-schema comment in
   `tutorialScenarios.js`.
