// Tutorial scenarios — pre-built fields and scripted hint sequences.
//
// Each scenario provides:
//   - id, title, description
//   - settings: a full settings object compatible with INITIAL_SETTINGS keys
//   - playerOverrides (optional): { [playerIdx]: { minSpeed?, maxSpeed?,
//       maxUnitsNum?, maxBasesNum? } } — per-player settings the
//       FieldEngine consults during production, used to give the human
//       and the bot different production rules in the same scenario
//   - buildField(): returns the field as Models.Cell[][]
//   - buildPlayers(): returns the players array (humans first, then bots)
//   - steps: array of hint objects (see step structure below)
//   - goal (optional): { check(ctx) → bool, text } — custom victory condition
//     beyond the regular elimination check
//
// Step structure:
//   {
//     id?: string,                          // optional jump target — referenced
//                                           //   by another step's `skipTo`
//     text: string | (ctx) => string,       // message body. Use a
//                                           //   function when the text
//                                           //   needs live game state
//                                           //   (e.g. counts of dinos /
//                                           //   towers); it's
//                                           //   re-evaluated each render
//     note?: string,                        // small italic note appended
//                                           //   below the text; also turns
//                                           //   the hint into a "click to
//                                           //   shift" surface for field
//                                           //   interaction tasks
//     anchor: 'top'|'bottom'|'center'|...,  // screen position
//     image?: string,                       // optional illustration shown
//                                           //   above the text (resolved by
//                                           //   getImagePath — e.g. a
//                                           //   building name like
//                                           //   'habitation' or 'temple')
//     waitFor: 'ok'|'unitSelected'|'unitMoved'|'unitReached'|'turnEnded'|
//              'turnStarted'|'scrolled'|'nextUnit'|'menuOpened'|'goal'|'win'|
//              'towerCaptured'|'undone'|'unitKilled'|'unitLimitReached'|
//              'scouted',
//     params: {...},                        // optional, depends on waitFor
//                                           //   - unitKilled.killerPlayer:
//                                           //     index of the killer to
//                                           //     wait for (default 0)
//                                           // unitLimitReached has no
//                                           // params — advances when the
//                                           // human's total units + empty
//                                           // bases > max (same red-number
//                                           // condition as InfoPanel)
//     highlightCells: [[x, y], ...],        // optional, highlight cells
//     check?: (ctx) => boolean,             // optional per-step predicate;
//                                           //   re-evaluated after every
//                                           //   move / kill / capture /
//                                           //   turn start; advance on true
//     forceEndTurn?: bool,                  // lock everything except End
//                                           //   turn (cells / undo / next-
//                                           //   unit blocked; End turn
//                                           //   stays enabled)
//     forceUndo?: bool,                     // lock everything except
//                                           //   Undo (cells / next-unit /
//                                           //   End turn blocked; Undo
//                                           //   stays enabled)
//     lockAll?: bool,                       // lock cells, Next-unit,
//                                           //   End turn AND Undo. Used
//                                           //   for steps where the only
//                                           //   meaningful action is a
//                                           //   viewport change (e.g.
//                                           //   the "scroll to corner"
//                                           //   prompt in scenario 1)
//     invisible?: bool,                     // hide the hint while the
//                                           //   step waits — used as a
//                                           //   "bridge" step that
//                                           //   advances on an event
//                                           //   without surfacing a
//                                           //   message
//     skipIf?: (ctx) => boolean,            // jump forward (without
//                                           //   showing this step) when
//                                           //   the predicate is true.
//                                           //   Evaluated on step entry
//                                           //   AND after every event
//                                           //   that triggers passive
//                                           //   checks — but always
//                                           //   AFTER `check`, so a
//                                           //   step whose `check` and
//                                           //   `skipIf` share a
//                                           //   predicate completes
//                                           //   linearly via `check`
//                                           //   into its follow-up
//                                           //   instead of being
//                                           //   shortcut past it.
//                                           //   Requires `skipTo`
//     skipTo?: string,                      // target step `id` to jump to
//                                           //   when skipIf is satisfied
//     onEnter?: (ctx) => void,              // optional setup callback
//   }
//
// `ctx` exposes helpers from the TutorialController (highlightCells,
// clearHighlights, getField, getCurrentPlayer, etc).

import Models from '@/game/models'
import { TUTORIAL_COMPLETED_KEY } from '@/game/const'

// ---------- localStorage helpers --------------------------------------------

export function loadCompletedScenarios() {
  try {
    const raw = localStorage.getItem(TUTORIAL_COMPLETED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_e) {
    return {}
  }
}

export function markScenarioCompleted(id) {
  const completed = loadCompletedScenarios()
  completed[id] = true
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(completed))
}

// ---------- field construction helpers --------------------------------------

function makeCell(opts = {}) {
  const cell = new Models.Cell(opts.terrain || { kind: Models.TerrainTypes.EMPTY, idx: 1 })
  cell.isHidden = opts.isHidden ?? true
  if (opts.building) {
    cell.building = new Models.Building(opts.building.player ?? null, opts.building._type)
  }
  if (opts.unit) {
    cell.unit = new Models.Unit(
      opts.unit.player,
      opts.unit._type ?? `dino${opts.unit.player + 1}`,
      opts.unit.movePoints,
      opts.unit.visibility ?? 3
    )
  }
  return cell
}

function makeField(width, height, { reveal = false, mountainRatio = 0 } = {}) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      const isMountain = mountainRatio > 0 && Math.random() < mountainRatio
      const terrain = isMountain
        ? { kind: Models.TerrainTypes.MOUNTAIN, idx: Math.ceil(Math.random() * 9) }
        : { kind: Models.TerrainTypes.EMPTY, idx: Math.ceil(Math.random() * 9) }
      col.push(makeCell({ terrain, isHidden: !reveal }))
    }
    field.push(col)
  }
  return field
}

function clearArea(field, x, y, r) {
  const w = field.length
  const h = field[0].length
  for (let cx = Math.max(0, x - r); cx <= Math.min(w - 1, x + r); cx++) {
    for (let cy = Math.max(0, y - r); cy <= Math.min(h - 1, y + r); cy++) {
      if (field[cx][cy].terrain.kind === Models.TerrainTypes.MOUNTAIN) {
        field[cx][cy].terrain = { kind: Models.TerrainTypes.EMPTY, idx: 1 }
      }
    }
  }
}

function placeBuilding(field, x, y, _type, player = null) {
  field[x][y].terrain = { kind: Models.TerrainTypes.EMPTY, idx: 1 }
  field[x][y].building = new Models.Building(player, _type)
}

function placeUnit(field, x, y, player, movePoints, visibility = 3) {
  field[x][y].terrain = { kind: Models.TerrainTypes.EMPTY, idx: 1 }
  field[x][y].unit = new Models.Unit(player, `dino${player + 1}`, movePoints, visibility)
}

function makePlayers(humanCount, botCount) {
  const players = []
  for (let i = 0; i < humanCount; i++) {
    players.push(new Models.Player(Models.PlayerTypes.HUMAN))
  }
  for (let i = 0; i < botCount; i++) {
    players.push(new Models.Player(Models.PlayerTypes.BOT))
  }
  return players
}

// Shared default settings keys — each scenario overrides what matters.
const SETTINGS_DEFAULTS = {
  sectorsNum: 4,
  scoresToWin: 0,
  enableFogOfWar: false,
  fogOfWarRadius: 3,
  enableScoutMode: true,
  visibilitySpeedRelation: false,
  minSpeed: 3,
  maxSpeed: 5,
  speedMinVisibility: 7,
  maxUnitsNum: 0,
  maxBasesNum: 0,
  unitModifier: 3,
  baseModifier: 3,
  buildingRates: { base: 0, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
  hideEnemySpeed: false,
  killAtBirth: true,
  enableUndo: true,
}

// True iff the game-grid container is already parked in (or close to)
// the bottom-right corner — or the entire map fits inside the viewport
// so there's nothing left to scroll to. Used by scenario 1's "scroll
// to the bottom-right" step to skip itself when it would be a no-op.
function scrolledToBottomRight() {
  const container = typeof document !== 'undefined'
    ? document.querySelector('.game-grid-container')
    : null
  if (!container) return false
  const tolerance = 30
  const maxLeft = container.scrollWidth - container.clientWidth
  const maxTop = container.scrollHeight - container.clientHeight
  // Map already fits on screen — no scroll is possible / needed.
  if (maxLeft <= 0 && maxTop <= 0) return true
  const atRight = container.scrollLeft >= maxLeft - tolerance
  const atBottom = container.scrollTop >= maxTop - tolerance
  return atRight && atBottom
}

// ---------- scenarios -------------------------------------------------------

const scenarioMoving = {
  id: 'moving',
  title: '1. Moving',
  description: 'Learn how to move your dinos',
  settings: {
    ...SETTINGS_DEFAULTS,
    humanPlayersNum: 1,
    botPlayersNum: 0,
    width: 50,
    height: 50,
    minSpeed: 5,
    maxSpeed: 5,
    enableFogOfWar: false,
    killAtBirth: false,
    enableUndo: true,
  },
  buildField() {
    const field = makeField(50, 50, { reveal: true, mountainRatio: 0.2 })
    // Make sure the dino's starting cell and the highlighted target cell
    // are walkable, and that there's some breathing room around them.
    clearArea(field, 3, 3, 2)
    clearArea(field, 13, 10, 1)
    placeUnit(field, 3, 3, 0, 5, 3)
    return field
  },
  buildPlayers() {
    return makePlayers(1, 0)
  },
  initialScroll: [3, 3],
  steps: [
    {
      text: 'Welcome to the tutorial! This scenario teaches the basics of moving your dinos.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: "This game is all about moving dinos — and you can only move your own. In this scenario you've got just one dino (it's blue).",
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Select your dino by clicking on it.',
      anchorCell: [3, 3],
      waitFor: 'unitSelected',
    },
    {
      text: "It's selected. The highlighted cells show how far it can move.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now select any highlighted cell to move your dino there.',
      note: 'If this message hides some cells you want to interact with, just click on the message to move it.',
      anchor: 'bottom',
      waitFor: 'unitMoved',
    },
    {
      text: "Good job — move's done! See that red badge? Your dino's out of moves. You've only got one, so that's it for this turn.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now press the End turn button (the arrow at the bottom right).',
      anchor: 'near-end-turn',
      waitFor: 'turnEnded',
      forceEndTurn: true,
    },
    {
      text: 'New turn! Your dino got its move points back and can move again.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Sometimes the whole map doesn't fit on the screen — you can scroll it by dragging or with the wheel.",
      anchor: 'top',
      waitFor: 'ok',
    },
    {
      text: 'Try scrolling to the bottom right corner of the map.',
      anchor: 'top-left',
      waitFor: 'scrolled',
      params: { edge: 'bottom-right' },
      // Lock everything else (cells, End turn, Undo) so the player
      // can only fulfil the scroll prompt or use the gear menu.
      lockAll: true,
      // Skip this step entirely if the player is already parked in
      // the bottom-right corner — or if the whole map already fits
      // on screen and there's nothing to scroll to.
      skipIf: scrolledToBottomRight,
      skipTo: 'after-scroll',
    },
    {
      id: 'after-scroll',
      text: "Your dino might scroll off-screen. Sure, you can drag back to it — but there's a faster way.",
      anchor: 'top',
      waitFor: 'ok',
    },
    {
      text: 'Press the "Next unit" button (the dino icon at the bottom).',
      anchor: 'near-next-unit',
      waitFor: 'nextUnit',
    },
    {
      text: 'If you have many units, this button lets you cycle through them quickly.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now make a move with your dino — anywhere will do.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitMoved',
    },
    {
      text: 'Wrong move? Hit Undo (curved arrow at bottom-left) to take it back.',
      anchor: 'near-undo',
      waitFor: 'undone',
      forceUndo: true,
    },
    {
      text: 'Nice — your dino is back. Undo works only for the current turn.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Now let's reach another point — you'll pick your own path.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Reach the highlighted cell — it will take a few turns.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitReached',
      params: { coords: [13, 10] },
      highlightCells: [[13, 10]],
    },
    {
      text: "Hurray! Pretty solid for a first try. Onward!",
      anchor: 'center',
      waitFor: 'ok',
      isEnd: true,
    },
  ],
}

const scenarioTowers = {
  id: 'towers',
  title: '2. Towers',
  description: 'Capture towers to grow your army',
  // The starting dino is given speed 5 (see buildField); if the first
  // dino the player's tower spawns happens to roll 5 too, the "different
  // speeds" lesson lands awkwardly. Force the very first batch of
  // produced units away from this speed.
  firstProducedSpeedForbidden: 5,
  settings: {
    ...SETTINGS_DEFAULTS,
    humanPlayersNum: 1,
    botPlayersNum: 0,
    width: 20,
    height: 20,
    minSpeed: 3,
    maxSpeed: 7,
    maxUnitsNum: 99,
    maxBasesNum: 99,
    enableFogOfWar: false,
    killAtBirth: false,
    enableUndo: true,
  },
  buildField() {
    const field = makeField(20, 20, { reveal: true, mountainRatio: 0.15 })
    // Player base + dino top-left
    placeBuilding(field, 2, 2, Models.BuildingTypes.BASE, 0)
    placeUnit(field, 2, 2, 0, 5, 3)
    clearArea(field, 2, 2, 1)
    // 8 empty towers scattered across the map
    const emptyBases = [
      [9, 4],
      [15, 3],
      [4, 10],
      [10, 10],
      [16, 9],
      [6, 15],
      [12, 16],
      [17, 17],
    ]
    for (const [x, y] of emptyBases) {
      placeBuilding(field, x, y, Models.BuildingTypes.BASE, null)
      clearArea(field, x, y, 1)
    }
    return field
  },
  buildPlayers() {
    return makePlayers(1, 0)
  },
  initialScroll: [10, 10],
  goal: {
    description: 'Reach 10 dinos',
    check(ctx) {
      const stats = ctx.getCurrentStats(0)
      return stats.units.total >= 10
    },
  },
  steps: [
    {
      text: 'Welcome to scenario 2: Towers! Your goal is to reach 10 dinos by capturing empty towers.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: "Every turn, each of your towers spawns a new dino — if it's empty. Your color is blue.",
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Move your dino off your starting tower so the tower becomes empty.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitMoved',
    },
    {
      text: 'Good. Now end the turn — your empty tower will produce a new dino.',
      anchor: 'near-end-turn',
      waitFor: 'turnEnded',
      forceEndTurn: true,
    },
    {
      text: 'See? A fresh dino just spawned on your tower. That happens every turn on every empty tower you own.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Each dino can move every turn, up to its speed (the number in its bottom-right corner).',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Newly spawned dinos can have different speeds — some faster, some slower.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now move a dino onto an empty (gray) tower to capture it.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'towerCaptured',
    },
    {
      text: 'Great! The tower is yours — next turn it will start producing dinos for you too.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'The bottom panel shows active/total/max dinos and total/max towers.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Don't forget the \"Next unit\" button at the bottom (the dino icon) — it cycles through dinos that haven't moved yet.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now keep capturing empty towers and grow your army to 10 dinos!',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'goal',
    },
    {
      text: 'Excellent! You reached 10 dinos and learned about towers.',
      anchor: 'center',
      waitFor: 'ok',
      isEnd: true,
    },
  ],
}

// Reused by the multikill steps' skipIf and the "kill the tower
// defender" step's check: true iff the tower at (12, 12) is still
// enemy-owned but has no unit on it. Defined outside the scenario so
// the predicate identity is shared.
function towerDefenderDead(ctx) {
  const cell = ctx.getField()?.[12]?.[12]
  if (!cell) return false
  if (!cell.building) return false
  if (cell.building._type !== Models.BuildingTypes.BASE) return false
  if (cell.building.player !== 1) return false
  return !cell.unit
}

// True iff the enemy tower at (12, 12) already belongs to the human
// player (they captured it ahead of schedule, e.g. by walking onto it
// in the same turn they killed the defender via multikill). Used by
// the "kill the tower defender" step to bypass the spawn-kill lesson
// entirely and jump straight to the final "mop up and win" task.
function towerCapturedByPlayer(ctx) {
  const cell = ctx.getField()?.[12]?.[12]
  if (!cell || !cell.building) return false
  if (cell.building._type !== Models.BuildingTypes.BASE) return false
  return cell.building.player === 0
}

const scenarioCombat = {
  id: 'combat',
  title: '3. Combat',
  description: 'Fight and eliminate your enemy',
  useEliminationWin: true,
  // Per-player setting overrides — only the FieldEngine production
  // path and the bottom-panel stats consult these. Initial unit speeds
  // (placed via `placeUnit`) are unaffected; we still set them to 0 in
  // `buildField` so the stationary enemies stay put.
  playerOverrides: {
    1: { minSpeed: 1, maxSpeed: 1, maxUnitsNum: 5 },
  },
  settings: {
    ...SETTINGS_DEFAULTS,
    humanPlayersNum: 1,
    botPlayersNum: 1,
    width: 15,
    height: 15,
    // Default speed range and unit cap apply to the human player. The
    // enemy gets a tighter set via `playerOverrides` above so its
    // (re)spawns stay slow and limited.
    minSpeed: 3,
    maxSpeed: 7,
    maxUnitsNum: 99,
    maxBasesNum: 99,
    enableFogOfWar: false,
    killAtBirth: true,
    enableUndo: true,
  },
  buildField() {
    const field = makeField(15, 15, { reveal: true, mountainRatio: 0.12 })
    // Player base + dino top-left
    placeBuilding(field, 2, 2, Models.BuildingTypes.BASE, 0)
    placeUnit(field, 2, 2, 0, 5, 3)
    clearArea(field, 2, 2, 1)
    // Enemy base + dino bottom-right — speed 0 like the rest, so the
    // tower defender just sits there until the player kills it.
    placeBuilding(field, 12, 12, Models.BuildingTypes.BASE, 1)
    placeUnit(field, 12, 12, 1, 0, 3)
    clearArea(field, 12, 12, 1)
    // Three stationary enemies:
    //   - one closer to the player (the "kill the closest one" target)
    //   - a pair one cell apart so the player can land between them
    //     (cell (8, 9)) and multikill in one move.
    placeUnit(field, 8, 6, 1, 0, 3)
    placeUnit(field, 7, 10, 1, 0, 3)
    placeUnit(field, 9, 10, 1, 0, 3)
    clearArea(field, 8, 6, 1)
    clearArea(field, 8, 10, 1)
    return field
  },
  buildPlayers() {
    return makePlayers(1, 1)
  },
  initialScroll: [7, 7],
  steps: [
    {
      text: "Welcome to scenario 3: Combat! You've got an enemy now — the mint dinos.",
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: "Your dinos and the enemy's can fight each other.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Combat rule: when your dino ends its move, every enemy on the four adjacent cells dies.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Kill the closest enemy dino — move next to it to take it out.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitKilled',
    },
    {
      text: 'Good job! The enemy dino is dead.',
      anchor: 'bottom',
      waitFor: 'ok',
      // If the player has already killed the tower defender (e.g. they
      // ignored the closest enemy and headed straight for the tower),
      // skip the multikill flow and go straight to the End-turn lesson.
      skipIf: towerDefenderDead,
      skipTo: 'force-end-turn',
    },
    {
      text: 'You can multikill! If you land between several enemies, all adjacent ones die at once.',
      anchor: 'bottom',
      waitFor: 'ok',
      skipIf: towerDefenderDead,
      skipTo: 'force-end-turn',
    },
    {
      text: 'Eliminate the other dinos. Slip your dino between two enemies standing close together and take them both out in one move.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      // Advances once no stationary enemies (speed 0, not on a tower)
      // remain on the field. Robust to the player killing them one by
      // one if multikill positioning doesn't pan out.
      check(ctx) {
        const field = ctx.getField()
        if (!field) return false
        for (let x = 0; x < field.length; x++) {
          const col = field[x]
          if (!col) continue
          for (let y = 0; y < col.length; y++) {
            const cell = col[y]
            if (!cell || !cell.unit) continue
            if (cell.unit.player === 0) continue
            // Ignore the tower defender — that one belongs to task 3.
            if (
              cell.building &&
              cell.building._type === Models.BuildingTypes.BASE &&
              cell.building.player === 1
            ) {
              continue
            }
            if (cell.unit.movePoints === 0) return false
          }
        }
        return true
      },
      skipIf: towerDefenderDead,
      skipTo: 'force-end-turn',
    },
    {
      text: "Now let's go for the enemy tower. First, kill the dino guarding it — move next to the tower.",
      note: 'Click message to move it.',
      anchor: 'bottom',
      // Advance once the tower defender is dead but the tower is still
      // enemy-owned (no unit, building.player === 1). This way we catch
      // the kill regardless of which side of the tower the player
      // approached from.
      check: towerDefenderDead,
      // If the player already captured the tower (e.g. walked onto it
      // in the same turn the multikill cleared its defender), the
      // spawn-kill lesson is moot. Skip straight to the final "mop up
      // and win" task.
      skipIf: towerCapturedByPlayer,
      skipTo: 'mop-up',
    },
    {
      // Force the player to end the turn while their unit is parked
      // right next to the empty enemy tower — the next-turn spawn will
      // teach them why that's a bad idea.
      id: 'force-end-turn',
      text: 'Now press End turn — see what happens next.',
      anchor: 'near-end-turn',
      waitFor: 'turnEnded',
      forceEndTurn: true,
    },
    {
      // Invisible bridge: hold the script silent through the bot's full
      // turn (spawn → kill-at-birth on the player's adjacent dino →
      // any follow-up bot moves) and only advance once it's the human's
      // turn again. Otherwise the next "Now capture the tower" step
      // would activate mid-bot-turn and the player's clicks would
      // silently no-op (units only select on their own turn).
      invisible: true,
      waitFor: 'turnStarted',
    },
    {
      text: "Oops! A fresh enemy dino spawned on the tower and wiped out your unit. Don't park next to an enemy tower — capture it the same turn, or stay back.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Now capture the tower properly — move one of your dinos onto it.",
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'towerCaptured',
    },
    {
      id: 'mop-up',
      text: 'Great! Mop up the rest and win!',
      anchor: 'bottom',
      waitFor: 'win',
    },
    {
      text: 'Victory! You\'ve got the basics of combat down.',
      anchor: 'center',
      waitFor: 'ok',
      isEnd: true,
    },
  ],
}

// True iff the human player's current tower count has reached or
// exceeded their max — i.e. uncaptured towers will display the red
// "limit reached" exclamation marker. Used by scenario 4's
// "you can't capture new towers anymore" hint.
function towerLimitReached(ctx) {
  const stats = ctx.getCurrentStats?.(0)
  const total = stats?.towers?.total ?? 0
  const max = stats?.towers?.max ?? 0
  if (!max) return false
  return total >= max
}

// True iff at least one player-0 unit is currently standing on a
// habitation. Used by scenario 4's "occupy a habitation" practice step
// and by the same step's skipIf shortcut.
function playerOnHabitation(ctx) {
  const field = ctx.getField()
  if (!field) return false
  for (let x = 0; x < field.length; x++) {
    const col = field[x]
    if (!col) continue
    for (let y = 0; y < col.length; y++) {
      const cell = col[y]
      if (!cell) continue
      if (
        cell.unit &&
        cell.unit.player === 0 &&
        cell.building &&
        cell.building._type === Models.BuildingTypes.HABITATION
      ) {
        return true
      }
    }
  }
  return false
}

const scenarioBuildings = {
  id: 'buildings',
  title: '4. Buildings',
  description: 'Use special buildings to dominate',
  settings: {
    ...SETTINGS_DEFAULTS,
    humanPlayersNum: 1,
    botPlayersNum: 1,
    width: 20,
    height: 20,
    minSpeed: 1,
    maxSpeed: 5,
    // Starting caps — buildings on the map raise them when occupied.
    maxUnitsNum: 5,
    maxBasesNum: 3,
    // Habitation/storage each grant +3 to the corresponding cap.
    unitModifier: 3,
    baseModifier: 3,
    enableFogOfWar: false,
    killAtBirth: true,
    enableUndo: true,
  },
  buildField() {
    const field = makeField(20, 20, { reveal: true, mountainRatio: 0.1 })
    // Player base + starter dino top-left.
    placeBuilding(field, 2, 2, Models.BuildingTypes.BASE, 0)
    placeUnit(field, 2, 2, 0, 5, 3)
    clearArea(field, 2, 2, 1)

    // Capturable gray towers — five cluster around the player so the
    // starter dino can fill out the army quickly, and four are scattered
    // around the rest of the map. Combined with the starter base that's
    // 10 capturable towers (matches task 2).
    const towers = [
      // Nearby (top-left quadrant, easy first captures).
      [5, 3],
      [3, 6],
      [7, 4],
      [4, 9],
      [6, 7],
      // Farther afield.
      [12, 10],
      [15, 11],
      [10, 17],
      [17, 16],
    ]
    for (const [x, y] of towers) {
      placeBuilding(field, x, y, Models.BuildingTypes.BASE, null)
      clearArea(field, x, y, 1)
    }

    // Special buildings — all placed away from the player's starting
    // corner. Enemy dinos stand on three of them (one storage, one
    // habitation, one temple); none on wells, since a well would tick
    // up the enemy's speed and let it move.

    // Storages (3) — one guarded.
    placeBuilding(field, 10, 8, Models.BuildingTypes.STORAGE, null)
    placeUnit(field, 10, 8, 1, 0, 3)
    clearArea(field, 10, 8, 1)
    placeBuilding(field, 15, 6, Models.BuildingTypes.STORAGE, null)
    clearArea(field, 15, 6, 1)
    placeBuilding(field, 8, 16, Models.BuildingTypes.STORAGE, null)
    clearArea(field, 8, 16, 1)

    // Habitations (12) — one guarded. Three sit at moderate distances
    // from the player; the rest are tucked into far parts of the map
    // (including a tight cluster in the bottom-right corner) so the
    // +3 dino cap keeps stacking as the player expands.
    placeBuilding(field, 13, 13, Models.BuildingTypes.HABITATION, null)
    placeUnit(field, 13, 13, 1, 0, 3)
    clearArea(field, 13, 13, 1)
    placeBuilding(field, 12, 5, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 12, 5, 1)
    placeBuilding(field, 4, 14, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 4, 14, 1)
    // Far-flung habitations — all well outside the player's starting
    // corner so they require real movement to capture.
    placeBuilding(field, 18, 6, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 18, 6, 1)
    placeBuilding(field, 16, 14, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 16, 14, 1)
    placeBuilding(field, 2, 18, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 2, 18, 1)
    placeBuilding(field, 18, 11, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 18, 11, 1)
    placeBuilding(field, 8, 13, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 8, 13, 1)
    // Tightly clustered habitations in the bottom-right corner — the
    // late-game stacking pool. Three of the four are guarded so the
    // corner needs cleared before the player can camp it.
    placeBuilding(field, 18, 16, Models.BuildingTypes.HABITATION, null)
    placeUnit(field, 18, 16, 1, 0, 3)
    clearArea(field, 18, 16, 1)
    placeBuilding(field, 19, 16, Models.BuildingTypes.HABITATION, null)
    placeUnit(field, 19, 16, 1, 0, 3)
    clearArea(field, 19, 16, 1)
    placeBuilding(field, 18, 17, Models.BuildingTypes.HABITATION, null)
    placeUnit(field, 18, 17, 1, 0, 3)
    clearArea(field, 18, 17, 1)
    placeBuilding(field, 19, 17, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 19, 17, 1)

    // Temples (11) — one guarded. With many temples the player can
    // stack +1 speed per occupied temple toward the speed-10 task; a
    // tight cluster lives in the bottom-right corner.
    placeBuilding(field, 10, 11, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 10, 11, 1)
    placeBuilding(field, 14, 9, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 14, 9, 1)
    placeBuilding(field, 14, 17, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 14, 17, 1)
    placeBuilding(field, 9, 18, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 9, 18, 1)
    placeBuilding(field, 12, 16, Models.BuildingTypes.TEMPLE, null)
    placeUnit(field, 12, 16, 1, 0, 3)
    clearArea(field, 12, 16, 1)
    // Two more temples placed far from the starting corner.
    placeBuilding(field, 16, 4, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 16, 4, 1)
    placeBuilding(field, 5, 12, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 5, 12, 1)
    // Tightly clustered temples in the bottom-right corner — pair with
    // the nearby habitation cluster for late-game stacking. Three of
    // the four are guarded to match the cluster's overall defence.
    placeBuilding(field, 16, 18, Models.BuildingTypes.TEMPLE, null)
    placeUnit(field, 16, 18, 1, 0, 3)
    clearArea(field, 16, 18, 1)
    placeBuilding(field, 17, 18, Models.BuildingTypes.TEMPLE, null)
    placeUnit(field, 17, 18, 1, 0, 3)
    clearArea(field, 17, 18, 1)
    placeBuilding(field, 16, 19, Models.BuildingTypes.TEMPLE, null)
    placeUnit(field, 16, 19, 1, 0, 3)
    clearArea(field, 16, 19, 1)
    placeBuilding(field, 17, 19, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 17, 19, 1)

    // Wells (2) — never guarded.
    placeBuilding(field, 17, 12, Models.BuildingTypes.WELL, null)
    clearArea(field, 17, 12, 1)
    placeBuilding(field, 4, 17, Models.BuildingTypes.WELL, null)
    clearArea(field, 4, 17, 1)

    return field
  },
  buildPlayers() {
    return makePlayers(1, 1)
  },
  initialScroll: [2, 2],
  steps: [
    {
      text: 'Welcome to scenario 4: Buildings! Special buildings give you bonuses when occupied.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'In the previous scenarios you had no cap on dinos or towers.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Check the bottom panel — limits are in play now. 5 dinos (last number by the dino icon) and 3 towers (last number by the tower icon).',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Let's see how limits work. Spawn as many dinos as you can.",
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitLimitReached',
    },
    {
      text: "You've hit the limit. Press End turn to continue.",
      anchor: 'near-end-turn',
      waitFor: 'turnEnded',
      forceEndTurn: true,
    },
    {
      // Invisible bridge: silent through the bot turn so the next hint
      // shows up only once the human's turn has actually started. By
      // then forceEndTurn is long released and the player has control
      // (it really is their turn, currentPlayer === 0).
      invisible: true,
      waitFor: 'turnStarted',
    },
    {
      text(ctx) {
        const stats = ctx.getCurrentStats(0)
        const dinos = stats?.units?.total ?? 0
        const empty = stats?.towers?.empty ?? 0
        const max = stats?.units?.max ?? 0
        const intro =
          'See? No new dinos spawned. The unit numbers are red — that means production is blocked by the cap.'
        if (!max) return intro
        return (
          `${intro} You have ${dinos} dinos and ${empty} empty tower` +
          `${empty === 1 ? '' : 's'}, so the next batch would push you to ` +
          `${dinos + empty} dinos — that exceeds the limit of ${max}.`
        )
      },
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'There are buildings on the map that raise your limits while you occupy them.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: "Occupy means: keep one of your dinos on the building at the start of a turn. Step off, and the bonus is gone.",
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Habitation: each one you occupy adds +3 to your max dinos.',
      image: 'habitation',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Move one of your dinos onto a habitation.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      check: playerOnHabitation,
      // If the player already happens to be standing on a habitation
      // when this step would activate, skip the practice step and the
      // "limits increased" follow-up — jump straight to the dino-cap
      // task.
      skipIf: playerOnHabitation,
      skipTo: 'grow-army',
    },
    {
      text: "See? Your limits went up — check the bottom panel. Don't step off the habitation if you want to keep the bonus.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      id: 'grow-army',
      text: "Grow your army to 10 dinos — you'll need habitations to raise the cap.",
      note: 'Click message to move it.',
      anchor: 'bottom',
      check(ctx) {
        return ctx.getCurrentStats(0).units.total >= 10
      },
    },
    {
      text: 'Cool! Let\'s check the other buildings.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Storage: each one you occupy adds +3 to your max towers.',
      image: 'storage',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      // Shown only when the player has already hit the tower cap (the
      // exclamation marker is visible on uncaptured towers). Otherwise
      // skip straight to the right-click reminder.
      text: "You've probably noticed you can't capture new towers anymore — the unreachable ones show a red exclamation sign. That's because you've hit the tower cap (the red number in the bottom panel). Occupy a storage to lift it.",
      anchor: 'center',
      waitFor: 'ok',
      skipIf: ctx => !towerLimitReached(ctx),
      skipTo: 'building-right-click-tip',
    },
    {
      id: 'building-right-click-tip',
      text: 'Forgot what a building does? Right-click it (or long-press on a touchscreen) for a quick reminder.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: "Some buildings are guarded. Same kill rule: move next to the guard and it's toast.",
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Own 10 towers. Your starter base counts — capture the rest.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      check(ctx) {
        return ctx.getCurrentStats(0).towers.total >= 10
      },
    },
    {
      text: 'Nice progress! Let\'s move on to the other buildings.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Temple: each occupied temple adds +1 speed to new dinos your towers spawn.',
      image: 'temple',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Well: a dino on a well gains +1 speed at the start of each turn it stays put.',
      image: 'well',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'The gear menu (bottom-left) shows per-player building counts and totals on the map — handy when planning your next move.',
      anchor: 'near-menu',
      waitFor: 'ok',
    },
    {
      text: 'Produce a dino with speed 10. Temples and wells will help — use them.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      check(ctx) {
        const field = ctx.getField()
        if (!field) return false
        for (let x = 0; x < field.length; x++) {
          const col = field[x]
          if (!col) continue
          for (let y = 0; y < col.length; y++) {
            const unit = col[y]?.unit
            if (unit && unit.player === 0 && unit.movePoints >= 10) return true
          }
        }
        return false
      },
    },
    {
      text: 'Mastery! Buildings are the core of long-term strategy.',
      anchor: 'center',
      waitFor: 'ok',
      isEnd: true,
    },
  ],
}

// True iff at least one player-0 unit is currently standing on an
// obelisk. Used by scenario 5's "Find the obelisk" task.
function playerOnObelisk(ctx) {
  const field = ctx.getField()
  if (!field) return false
  for (let x = 0; x < field.length; x++) {
    const col = field[x]
    if (!col) continue
    for (let y = 0; y < col.length; y++) {
      const cell = col[y]
      if (!cell) continue
      if (
        cell.unit &&
        cell.unit.player === 0 &&
        cell.building &&
        cell.building._type === Models.BuildingTypes.OBELISK
      ) {
        return true
      }
    }
  }
  return false
}

const scenarioFog = {
  id: 'fog',
  title: '5. Fog of war',
  description: 'Explore the unknown',
  useEliminationWin: true,
  // Force the first produced dino to speed 1 so the "slow dinos see
  // farther" lesson always has a concrete example to point at.
  firstProducedSpeed: 1,
  settings: {
    ...SETTINGS_DEFAULTS,
    humanPlayersNum: 1,
    botPlayersNum: 1,
    width: 22,
    height: 22,
    minSpeed: 1,
    maxSpeed: 5,
    speedMinVisibility: 7,
    visibilitySpeedRelation: true,
    maxUnitsNum: 5,
    maxBasesNum: 3,
    unitModifier: 3,
    baseModifier: 3,
    fogOfWarRadius: 3,
    enableFogOfWar: true,
    enableScoutMode: true,
    killAtBirth: true,
    enableUndo: true,
  },
  buildField() {
    const field = makeField(22, 22, { reveal: false, mountainRatio: 0.15 })
    // Player base + starter dino top-left. Visibility 2 matches what
    // calculateUnitVisibility would assign to speed 5 under this
    // scenario's settings (minSpeed=1, speedMinVisibility=7, avg=3),
    // since visibilitySpeedRelation is on for this scenario.
    placeBuilding(field, 2, 2, Models.BuildingTypes.BASE, 0)
    placeUnit(field, 2, 2, 0, 5, 2)
    clearArea(field, 2, 2, 1)

    // Stationary enemy dinos spread across the three corners opposite
    // to the player. Speed 0 → they don't move, so the player has to
    // hunt them through the fog. No enemy bases anywhere (the
    // elimination win triggers as soon as all of them are dead).
    // Top-right corner.
    placeUnit(field, 18, 3, 1, 0, 3)
    placeUnit(field, 20, 6, 1, 0, 3)
    // Bottom-left corner.
    placeUnit(field, 3, 18, 1, 0, 3)
    placeUnit(field, 5, 20, 1, 0, 3)
    // Bottom-right corner.
    placeUnit(field, 19, 19, 1, 0, 3)
    placeUnit(field, 16, 17, 1, 0, 3)

    // A few non-obelisk buildings sprinkled around — two of each
    // (habitation, temple, well) plus a single storage and three
    // empty towers. Enough variety for the player to capture and use
    // along the way without crowding the map.
    placeBuilding(field, 12, 8, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 12, 8, 1)
    placeBuilding(field, 7, 8, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 7, 8, 1)
    placeBuilding(field, 3, 11, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 3, 11, 1)
    placeBuilding(field, 16, 9, Models.BuildingTypes.HABITATION, null)
    clearArea(field, 16, 9, 1)
    placeBuilding(field, 15, 14, Models.BuildingTypes.STORAGE, null)
    clearArea(field, 15, 14, 1)
    placeBuilding(field, 8, 11, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 8, 11, 1)
    placeBuilding(field, 17, 11, Models.BuildingTypes.TEMPLE, null)
    clearArea(field, 17, 11, 1)
    placeBuilding(field, 5, 13, Models.BuildingTypes.WELL, null)
    clearArea(field, 5, 13, 1)
    placeBuilding(field, 13, 17, Models.BuildingTypes.WELL, null)
    clearArea(field, 13, 17, 1)
    placeBuilding(field, 10, 5, Models.BuildingTypes.BASE, null)
    clearArea(field, 10, 5, 1)
    placeBuilding(field, 10, 18, Models.BuildingTypes.BASE, null)
    clearArea(field, 10, 18, 1)
    placeBuilding(field, 14, 4, Models.BuildingTypes.BASE, null)
    clearArea(field, 14, 4, 1)

    // Moderate obelisk count — one within reach of the starter dino
    // so the "Find an obelisk" task doesn't drag, and a few more
    // scattered to support exploration.
    const obelisks = [
      [6, 5],
      [15, 8],
      [12, 14],
      [5, 17],
      [9, 9],
    ]
    for (const [x, y] of obelisks) {
      placeBuilding(field, x, y, Models.BuildingTypes.OBELISK, null)
      clearArea(field, x, y, 1)
    }

    return field
  },
  buildPlayers() {
    return makePlayers(1, 1)
  },
  initialScroll: [2, 2],
  steps: [
    {
      text: 'Welcome to scenario 5: Fog of war! The most mysterious part of the game.',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'You only see what your dinos and towers can see — the rest stays dark.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "You can check a dino's visibility radius anytime — right-click it.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Move your dino — watch the visible area follow it.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'unitMoved',
    },
    {
      text: 'See? The visibility area shifted with the dino.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now press End turn — your empty base will spawn a new dino.',
      anchor: 'near-end-turn',
      waitFor: 'turnEnded',
    },
    {
      // Invisible bridge: wait through the bot turn so the next OK
      // hint shows up only once the human has control again and the
      // new (speed-1) dino is visible.
      invisible: true,
      waitFor: 'turnStarted',
    },
    {
      text: 'Visibility is linked to speed — slower dinos see farther. Right-click both your dinos and compare their radii.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'There are also buildings that can help you scout the map.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Obelisk: instantly reveals any part of the map when one of your dinos ends its move on it.',
      image: 'obelisk',
      anchor: 'center',
      waitFor: 'ok',
    },
    {
      text: 'Find an obelisk and move one of your dinos onto it.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      check: playerOnObelisk,
    },
    {
      text: "Nice! This one's special — step on it and you get an action.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Click any cell on the map to scout it — unrevealed ones are best.',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'scouted',
    },
    {
      text: "Wow — you can see halfway across the map now!",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: "Unlike the others, an obelisk is one-and-done per visit. Step off, then come back later to use it again.",
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Picked the wrong scout target? Undo works — but only if no new cells were revealed.',
      anchor: 'near-undo',
      waitFor: 'ok',
    },
    {
      text: 'Same rule for moves: undo only works if the move didn\'t reveal new cells.',
      anchor: 'bottom',
      waitFor: 'ok',
    },
    {
      text: 'Now find and eliminate every enemy dino hidden in the fog!',
      note: 'Click message to move it.',
      anchor: 'bottom',
      waitFor: 'win',
    },
    {
      text: 'Master of the unknown! Tutorial complete.',
      anchor: 'center',
      waitFor: 'ok',
      isEnd: true,
    },
  ],
}

export const SCENARIOS = [
  scenarioMoving,
  scenarioTowers,
  scenarioCombat,
  scenarioBuildings,
  scenarioFog,
]

export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) || null
}
