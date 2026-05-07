# Plan: Unit Move Animation

Created: 2026-05-04
Updated: 2026-05-05
Status: Implemented

## Overview

Animate unit movement along the BFS path instead of teleporting from source to destination. The simplest possible animation: render the unit on each successive cell of the path with a fixed delay (`MOVE_ANIMATION_DELAY ≈ 100 ms`) between steps.

The animation must also play for **enemy** moves that pass through the local player's visible area:

- **Single-player**: animate every cell of the bot's path that is currently visible to the human player (or the entire path when fog of war is off / globally revealed).
- **Multiplayer**: the server computes the path, slices it per-recipient by that recipient's visibility, and includes the visible slice in the state patch. Each client animates only the slice it received.

Undo (move-undo only) skips reverse animation: the unit simply disappears at the source/destination — visual polish is deferred.

The structure must allow swapping the per-cell jump for smooth interpolation (and later limb/leg frames) without touching call-sites — the call to "play the move" stays the same; only the renderer/coroutine changes.

## Requirements

From user specification:

- Add per-cell movement animation: hide unit on the current cell, show on the next, repeat along the path.
- The path is already computed by `WaveEngine`; reuse its work — do not recompute pathing inside the animator.
- Define the per-step delay as a single constant in `frontend/src/game/const.js` (start at 100 ms). Backend mirrors it where needed (e.g. for any timing-sensitive guards).
- Display **enemy** (bot or other player) moves to the local player, but only the portion of the path inside the player's current visibility. Cells in fog stay dark — the unit "appears" at the first visible cell and "disappears" past the last visible cell.
- Single-player: animate bot moves locally using the human player's visibility.
- Multiplayer: server slices each move's path per recipient based on that recipient's visibility, then sends the slice in the state patch; clients animate the slice they receive.
- Undo: do not animate in reverse; the unit just disappears (current `applyFieldDiff` behaviour). Leave a hook for fancier handling later.
- Block new player input (move/scout/end-turn/undo) while an animation is in flight, both single- and multiplayer.
- Architect for future enhancements: smooth interpolation between cells, walk-cycle frames (legs).

## Analysis

### How moves work today

**Single-player move (`DinoGame.vue:moveUnit`)**

```
fieldEngine.moveUnit(x0, y0, x1, y1, unit)   // delete src, set dst — instantaneous
captureBuildingIfNeeded → setAction (obelisk) → killNeighbours
checkEndOfGame
recalc visibility for src area + add visibility around dst
compute undo diff
```

`fieldEngine.moveUnit` (frontend/src/game/fieldEngine.js:106) is one-shot: it deletes from src and assigns to dst. There is no intermediate state today.

**Bot move loop (`DinoGame.vue:makeBotMove`)** — synchronous `while (this.unitCoordsArr.length > 0)` calling `botEngine.makeBotUnitMove(..., this.moveUnit)`. Bot calls `moveUnit(coords, target)` synchronously. To insert delays, this must become async.

**Path computation (`waveEngine.js`)** — `WaveEngine.getReachableCoordsArr` and `canReach` use BFS but **do not return the path**. We need a new `getPath(x0, y0, x1, y1, movePoints)` that returns `[[x0,y0], ..., [x1,y1]]`. Implementation: BFS with parent map, then trace back from `(x1,y1)`.

**Multiplayer move (`MultiplayerDinoGame.vue:moveUnit`)** — sends `{fromCoords, toCoords}` over WS; server replies with a patch including the full filtered field. Server today doesn't tell the client the path between source and destination — only the new state.

**Server move (`backend/game/services/game_logic.py:apply_move_txn`)** uses `apply_move_to_cell` (in `move_validation.py`) which similarly is one-shot. The server doesn't currently compute or persist the path.

### Architecture choice for the animator

A small Vue-agnostic helper module `frontend/src/game/moveAnimator.js` exposes:

```js
animateMovePath(field, path, unit, { delay, isVisible })
```

- `path` is the already-computed list of cells starting at the source (where the unit currently is) and ending at the destination.
- For each adjacent pair `(prev, next)` in the path:
  - If `isVisible(next)` (or `isVisible(prev)`): set `field[next].unit = unit`, clear `field[prev].unit`, `await sleep(delay)`.
  - If neither end is visible: still update `field` (so the unit's position remains correct under the fog), but skip the sleep so we don't waste real time on invisible steps.
- Returns a `Promise` that resolves when the unit reaches the last cell.

Why not put this in `fieldEngine`? Because `fieldEngine` is also used by the bot to compute side-effects. Animation is a presentation concern; we keep it separate. The new `moveUnit` flow becomes: `await animator.run(path)` → finalize side-effects (capture/kill/visibility/diff). The presence of an `isVisible` callback gives both modes the right scoping (own player's visibility set, locally; per-recipient slice, on the wire).

This module is pure-async / DOM-free, so it stays unit-testable.

### Why slice the path on the server (multiplayer) instead of sending everything

Sending the whole path would leak information about cells the recipient cannot see (units passing through fog). Slicing per recipient keeps the server-authoritative visibility model intact. The slice is a list of `[x,y]` coords plus the originating unit's data so the client can render the moving sprite even before the destination cell becomes part of its visibility set. The slice is computed once per recipient inside the existing `_filter_patch_for_player` flow (consumer-side filtering), against that recipient's visibility set.

### Affected files

**Frontend**
- `frontend/src/game/const.js` — add `MOVE_ANIMATION_DELAY = 100`.
- `frontend/src/game/waveEngine.js` — add `getPath(x0, y0, x1, y1, movePoints)`.
- `frontend/src/game/moveAnimator.js` — **new**, the async animator described above.
- `frontend/src/components/game/DinoGame.vue` — make `moveUnit` async, drive animation, gate inputs (`isAnimating`), animate bot moves; pass current-player visibility set to `isVisible`.
- `frontend/src/components/game/MultiplayerDinoGame.vue` — apply server-supplied path slice in `applyStatePatch` (animate before swapping in the final field), gate inputs, also animate own moves locally.
- `frontend/src/components/game/GameUnit.vue` — if needed, add a CSS hook (`isMoving` class) for future smoother transitions; in v1 it just stays as-is.
- `frontend/src/game/eventBus.js` — no new events needed (existing `moveUnit` event chain stays); a single `isAnimating` boolean lives on the controller.
- `frontend/src/game/websocket/gameWebSocket.js` — no payload change; the patch already flows through `onStateUpdate`.

**Backend**
- `backend/game/services/move_validation.py` (or a new `path.py`) — add `compute_path(field, width, height, x0, y0, x1, y1, move_points, enable_scout_mode)`. BFS with parents, mirroring `WaveEngine.getPath`.
- `backend/game/services/game_logic.py:apply_move_txn` — compute path against the **pre-move** field and stash it in the patch as `path: [[x,y], ...]` (full path).
- `backend/game/consumers.py:_filter_patch_for_player` — slice `patch.path` by the recipient's visibility set (computed alongside the existing field filter), attach as `pathSlice: [[x,y], ...]`. Strip `path` (full) before sending. The unit's data needed to render the moving sprite comes from the existing `lastMove` source cell in the pre-patch field — but since the patch field has already been mutated, include `movingUnit: <unit dict>` in the patch as well.

**Frontend tests**
- `frontend/tests/waveEngine.spec.js` (new or extend existing) — `getPath` happy path, dest unreachable, start === dest, single-step move, around obstacles.
- `frontend/tests/moveAnimator.spec.js` (new) — uses fake timers; verify cell-by-cell mutation order, delay between steps, `isVisible` skip behaviour, resolves at end.
- `frontend/tests/DinoGame/dinogame.move.spec.js` (extend) — input gated while animating, undo state recorded only after animation finishes.

**Backend tests**
- `backend/game/tests/test_path.py` (new) — `compute_path` parity with frontend (same BFS shape).
- `backend/game/tests/test_move_animation_patch.py` (new) — `apply_move_txn` includes full `path`; `_filter_patch_for_player` produces the right slice for each recipient (including empty slice when fully fogged).

### Dependencies

- WaveEngine path API is added once and used by both the animator and the bot (the bot can keep using `getReachableCoordsArr`; the path itself is only needed when actually moving).
- `MOVE_ANIMATION_DELAY` is a single constant on the frontend; backend doesn't need a mirror constant unless we add server-side throttling later (out of scope).

### Risks/Considerations

1. **Async refactor of `moveUnit` cascades to the bot loop.** The synchronous `while` in `makeBotMove` becomes `for` over an awaited helper. End-turn handling must wait for the last animation to finish before `processEndTurn`.
2. **Re-entrancy / interleaving.** While an animation is in flight, the player must not be able to issue another move (or end turn). A flag (`isAnimating`) on the controller, checked in `emitMoveUnit`/`processEndTurn`/`emitScoutArea`/`undoLastMove`, suffices.
3. **Visibility recompute during animation.** v1 keeps the visibility set frozen at move-start so that an animating own-unit doesn't reveal new cells mid-path — visibility is recomputed only after the animation completes. This keeps fog reveals tied to the move "completing", which matches the current model.
4. **Capture / kill / scout side-effects must run only after the unit reaches the destination**, otherwise we'd see, e.g., a unit explode mid-path. The existing post-move logic stays exactly where it is, just behind an `await animator.run(...)`.
5. **Game-end during a move.** `checkEndOfGame` runs after the animation; the player can still see the final hop. If we want the loser unit to vanish only after that, no change needed (it already happens at the end).
6. **Undo during animation** — disallow via the `isAnimating` gate.
7. **Multiplayer slice when no part of the path is visible.** The patch should include the field update (so any kill/capture results land) but skip the moving-unit overlay. Client check: empty `pathSlice` → no animation, just apply the field as today.
8. **Path entering / leaving fog mid-move.** v1 honours visibility cell-by-cell: animate while visible, instantly skip while not. This produces "appears at the edge of fog and walks the rest of the way" — acceptable.
9. **Component unmount mid-animation.** Animator promise must check a "cancelled" flag set in `beforeUnmount` to avoid late mutations on a torn-down field.
10. **Scout reveal vs. moves.** Scout is independent of unit movement; no animation here. (Future: animate the scout reveal expanding.)
11. **Reconnection / late-joiner.** A reconnecting client that was disconnected during a move misses the path slice in the WS patch; the field on reconnect already reflects the post-move state, so we just don't animate anything. No special handling needed.
12. **Performance.** A single `await sleep(100)` per cell × ~6 cells × ~5 units per bot turn ≈ 3 s of total bot animation. Acceptable for v1; if it feels slow, lower the constant.
13. **Non-orthogonal paths.** BFS uses 4-neighbours, so adjacent path cells always differ by 1 step in exactly one axis — no diagonal jumps, no special CSS for v1.

## Implementation Steps

### Step 1: Add the animation delay constant

**Files**: `frontend/src/game/const.js`

**Description**: Single source of truth so we can tune from one place.

```js
// Per-step delay for unit move animation, in milliseconds.
// Kept as a constant so it can be tuned in one place when we move to
// smoother interpolation or walk-cycle frames.
export const MOVE_ANIMATION_DELAY = 100;
```

### Step 2: `WaveEngine.getPath`

**Files**: `frontend/src/game/waveEngine.js`

**Description**: BFS that records parents and reconstructs `[[x0,y0], ..., [x1,y1]]`. Returns `null` when unreachable. Uses the same `getNeighbours` filter as `getReachableCoordsArr`, so movement rules stay consistent.

```js
getPath(x0, y0, x1, y1, movePoints) {
  if (x0 === x1 && y0 === y1) return [[x0, y0]];
  const waveField = this.getWaveField();
  waveField[x0][y0] = 0;
  const parents = new Map();   // "x,y" -> "px,py"
  const wave = [[x0, y0]];
  while (wave.length > 0) {
    const [x, y] = wave.shift();
    const s = waveField[x][y] + 1;
    if (s > movePoints) break;
    for (const [nx, ny] of this.getNeighbours(waveField, x, y)) {
      if (waveField[nx][ny] === null) {
        waveField[nx][ny] = s;
        parents.set(`${nx},${ny}`, `${x},${y}`);
        if (nx === x1 && ny === y1) {
          // reconstruct
          const out = [[x1, y1]];
          let key = `${x},${y}`;
          while (key) {
            const [px, py] = key.split(',').map(Number);
            out.push([px, py]);
            key = parents.get(key);
          }
          return out.reverse();
        }
        wave.push([nx, ny]);
      }
    }
  }
  return null;
}
```

### Step 3: `moveAnimator.js`

**Files**: `frontend/src/game/moveAnimator.js` (new)

**Description**: One async function. Pure DOM-free.

```js
import { MOVE_ANIMATION_DELAY } from '@/game/const';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Step a unit cell-by-cell along `path`. Mutates `field` in place.
 *
 * @param {Array} field           - 2D field; cells have a `unit` slot
 * @param {Array<[number,number]>} path - includes source as path[0] and dest as path[last]
 * @param {Object} unit           - the unit being moved (already at field[path[0]])
 * @param {Object} opts
 * @param {number} [opts.delay]   - ms between steps (default MOVE_ANIMATION_DELAY)
 * @param {(coord:[number,number]) => boolean} [opts.isVisible] - skip-sleep predicate
 * @param {() => boolean} [opts.isCancelled] - abort gate (unmount, end-of-game)
 */
export async function animateMovePath(field, path, unit, opts = {}) {
  const delay = opts.delay ?? MOVE_ANIMATION_DELAY;
  const isVisible = opts.isVisible ?? (() => true);
  const isCancelled = opts.isCancelled ?? (() => false);
  for (let i = 1; i < path.length; i++) {
    if (isCancelled()) return;
    const [px, py] = path[i - 1];
    const [nx, ny] = path[i];
    field[nx][ny].unit = unit;
    field[px][py].unit = null;
    if (isVisible(path[i]) || isVisible(path[i - 1])) {
      await sleep(delay);
    }
  }
}
```

Note: leaves capture/kill/visibility recompute to the caller — the animator only handles the visual walk.

### Step 4: Single-player wiring (`DinoGame.vue`)

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**:

1. Add `isAnimating: false` to data.
2. Gate input:
   ```js
   emitMoveUnit(coordsDict) {
     if (this.isAnimating) return;
     this.moveUnit(coordsDict.fromCoords, coordsDict.toCoords);
   }
   ```
   Also gate `processEndTurn`, `handleScoutArea`, `undoLastMove`.
3. Make `moveUnit` async and split apply-move into "walk" + "finalize":
   ```js
   async moveUnit(fromCoords, toCoords) {
     const fieldSnapshot = JSON.parse(JSON.stringify(this.localField));
     const visibleCoordsBefore = this.doesVisibilityMakeSense()
       ? new Set(Array.from(this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer))
                       .map((c) => JSON.stringify(c)))
       : null;
     const [x0, y0] = fromCoords, [x1, y1] = toCoords;
     const unit = this.localField[x0][y0].unit;
     const path = this.waveEngine.getPath(x0, y0, x1, y1, unit.movePoints);
     // Visibility is frozen for the duration of the move (own moves animate fully).
     const visibleSnapshot = visibleCoordsBefore;  // for current player's own animations, all path cells are visible
     this.isAnimating = true;
     try {
       await animateMovePath(this.localField, path, unit, {
         isVisible: ([cx, cy]) => !this.doesVisibilityMakeSense()
            || !visibleSnapshot
            || visibleSnapshot.has(JSON.stringify([cx, cy])),
         isCancelled: () => this._unmounted,
       });
       // existing finalize logic — call fieldEngine internals that rely on the unit
       // already being at (x1,y1). fieldEngine.moveUnit() is a no-op now since the
       // animator has already moved the unit; we only need its `hasMoved=true` side-effect.
       unit.hasMoved = true;
       const buildingCaptured = this.fieldEngine.captureBuildingIfNeeded(x1, y1, unit.player);
       const action = this.fieldEngine.getActionTriggered(x1, y1);
       if (action) emitter.emit('setAction', action);
       this.fieldEngine.killNeighbours(x1, y1, unit.player);
       this.checkEndOfGame();
       if (this.doesVisibilityMakeSense()) {
         this.setVisibilityForArea(x0, y0, unit.visibility);
         const visibility = buildingCaptured ? Math.max(unit.visibility, this.fogOfWarRadius) : unit.visibility;
         this.addVisibilityForCoords(x1, y1, visibility);
       }
       const diff = computeFieldDiff(fieldSnapshot, this.localField, this.width, this.height);
       let canUndo = true;
       if (this.doesVisibilityMakeSense()) {
         const visibleAfter = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
         for (const coord of visibleAfter) {
           if (!visibleCoordsBefore.has(JSON.stringify(coord))) { canUndo = false; break; }
         }
       }
       this.moveUndoState = { diff, canUndo };
       this.scoutUndoState = null;
     } finally {
       this.isAnimating = false;
     }
   }
   ```
4. Bot loop becomes async:
   ```js
   async makeBotMove() {
     this.state = this.STATES.play;
     this.unitCoordsArr = this.getCurrentUnitCoords();
     while (this.unitCoordsArr.length > 0) {
       await this.botEngine.makeBotUnitMove(this.unitCoordsArr, this.currentPlayer, this.moveUnit);
     }
     emitter.emit('processEndTurn');
   }
   ```
   `BotEngine.makeBotUnitMove` is updated to `await moveUnit(...)` for each call site (single-player case). For bot moves, the `isVisible` predicate uses the **current human player's** visibility set: `visibleSnapshot = humanPlayer.getCurrentVisibilitySet()`. This is the rule for "show enemy moves only inside vision".
5. Track unmount: `this._unmounted = true` in `beforeUnmount`.

### Step 5: Multiplayer wiring (`MultiplayerDinoGame.vue`)

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**:

1. Add `isAnimating` flag, gate input the same way.
2. In `applyStatePatch`, before swapping in the new `patch.field`, if `patch.pathSlice && patch.pathSlice.length > 1 && patch.movingUnit` is present:
   - Apply the path slice on a working copy of `localField` via `animateMovePath` using the slice and `movingUnit` payload, with `isVisible` always true (the server already filtered to what we can see).
   - Then merge the final `patch.field` (which is authoritative).
3. If no slice, behave as today (instant field swap).
4. Own moves: still send `{fromCoords, toCoords}` and let the server bounce back the slice — we animate from the response, so own and opponent moves look identical. (This trades a ~RTT delay before the unit starts moving for the simpler model. v1 ships this; we can optimistically pre-animate later.)

### Step 6: Backend path computation

**Files**: `backend/game/services/path.py` (new) — keeps `move_validation.py` focused

```python
from collections import deque

def compute_path(field, width, height, x0, y0, x1, y1, move_points, enable_scout_mode):
    # mirrors WaveEngine.getPath: 4-neighbour BFS with parent map
    # returns list[[x,y]] including source and dest, or None
    ...
```

Run the same passability rules as `validate_move` (terrain empty, no unit, not hidden when scout mode forces visibility). Add a unit test asserting parity with the JS `getPath` for a fixture field.

### Step 7: Backend `apply_move_txn` emits the path

**Files**: `backend/game/services/game_logic.py`

**Description**: Compute the path **against `field_before`** (the pre-move state); the unit isn't on the destination yet. Stash on the patch:

```python
move_path = compute_path(
    field_before, width, height,
    from_coords[0], from_coords[1],
    to_coords[0], to_coords[1],
    unit_move_points, enable_scout_mode,
)
patch["path"] = move_path
patch["movingUnit"] = field_before[from_coords[0]][from_coords[1]].get("unit")
```

The full path is *not* sent to clients — the consumer's `_filter_patch_for_player` strips it.

### Step 8: Per-recipient slicing in the consumer

**Files**: `backend/game/consumers.py`

**Description**: In `_filter_patch_for_player`, after computing the visibility set for the recipient (already done for field filtering):

```python
if "path" in patch:
    pset = visible_coords  # already computed for this recipient
    slice_ = [c for c in patch["path"] if tuple(c) in pset]
    filtered_patch["pathSlice"] = slice_
filtered_patch.pop("path", None)
```

Keep `movingUnit` on the patch (it's a small dict; needed by the client to render the sprite while the unit is in-flight). Edge case: if `len(slice_) < 2`, drop both `pathSlice` and `movingUnit` — there's nothing to animate.

### Step 9: Frontend tests

**Files**:
- `frontend/tests/waveEngine.spec.js` — extend if exists, else create
- `frontend/tests/moveAnimator.spec.js` (new)
- `frontend/tests/DinoGame/dinogame.move.spec.js` (extend)

**Tests**:
- `getPath` returns adjacent-cell path of expected length.
- `getPath` returns `null` when destination unreachable within `movePoints`.
- `getPath([x,y], [x,y], _)` returns single-cell path.
- Animator: with fake timers (`vi.useFakeTimers()`), step N times advances time by N×delay; `isVisible=false` skips the sleep but still mutates the field.
- Animator: respects `isCancelled` (early return without mutating remaining cells).
- DinoGame: `emitMoveUnit` while `isAnimating=true` is a no-op.
- DinoGame: `moveUndoState` is set only after the animator resolves (assert state mid-animation is still `null`).

### Step 10: Backend tests

**Files**:
- `backend/game/tests/test_path.py` (new)
- `backend/game/tests/test_move_animation_patch.py` (new)

**Tests**:
- `compute_path` parity vs. a known fixture (same answers as JS).
- `apply_move_txn` returns a `path` of length ≥ 2 for a normal move.
- `_filter_patch_for_player` slices to only the recipient-visible cells; full-fog recipient gets no `pathSlice`.

### Step 11: Documentation

**Files**: `.claude/docs/game-engines.md`, `.claude/docs/game-components.md`, `CLAUDE.md`

**Updates**:
- `game-engines.md`: document `WaveEngine.getPath`, the animator module, and the path-slicing rule on the wire.
- `game-components.md`: mention `isAnimating` input gate on `DinoGame` / `MultiplayerDinoGame`.
- `CLAUDE.md`: one line under "engine pattern" noting that move animations are presentation-only and live in `moveAnimator.js`.

### Step 12: Final verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
cd backend && pytest
cd backend && black . && ruff check . --fix && ruff check . && mypy game/
```

**Manual tests** (single-player):
1. Move own unit 4 cells: see it step through each cell at ~100 ms.
2. Move into an obelisk: animation completes, then scout-pick mode arms.
3. Move into a building capture: capture happens at the destination only.
4. Move adjacent to enemy: enemy is killed only when the unit arrives.
5. Bot turn: each bot unit animates one after another; you can't click while it runs.
6. Fog of war on: bot move that crosses your vision boundary appears at first visible cell, walks across visible portion, disappears at last visible cell.
7. Fog disabled: full bot path visible.
8. Undo a move: unit just disappears at the source post-undo (no reverse animation).
9. End-turn during animation: blocked.

**Manual tests** (multiplayer):
1. Own move: short delay (RTT) then unit walks.
2. Opponent move fully in your fog: nothing happens visually except the eventual field state (no path slice → no animation).
3. Opponent move that walks into your vision: unit appears at first visible cell and walks through your visible portion.
4. Opponent move passing through your vision and out again: unit walks through and disappears at fog edge.
5. Reconnect during opponent animation: rejoining client sees only the final state.
6. Scout reveal: still independent — no animation regression.

## Questions/Notes

1. **Constant placement**. `MOVE_ANIMATION_DELAY` is frontend-only for v1. If the backend ever needs to throttle, we'd add a parallel constant in a shared settings module.
2. **Smooth interpolation later**. Replace the cell-snap inside `animateMovePath` with a CSS-transform tween between cell coordinates (or per-frame `requestAnimationFrame`). The call-site stays the same.
3. **Walk-cycle frames**. `GameUnit` would gain a sprite-strip prop driven by an `isMoving` flag set by the animator via a small piece of per-cell state.
4. **Optimistic own-move animation in multiplayer**. We could start animating on send and reconcile when the server response arrives, but rollback on validation failure is fiddly — left out of v1.
5. **Cancellation on game end** — the `isCancelled` hook is generic; we already use it for unmount. Wire `winPhase !== progress` into it as a future tweak if mid-animation ends become annoying.
