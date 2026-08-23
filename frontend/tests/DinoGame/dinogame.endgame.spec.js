import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import Models from '@/game/models.js'

function makePlayer(type, active = true) {
  const player = new Models.Player(type)
  player.active = active
  return player
}

function makeWrapper({ humanPlayersNum = 1, botPlayersNum = 2 } = {}) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const wrapper = mount(DinoGame, {
    props: {
      humanPlayersNum,
      botPlayersNum,
      width: 5,
      height: 5,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar: false,
      fogOfWarRadius: 1,
      enableScoutMode: false,
      visibilitySpeedRelation: false,
      minSpeed: 1,
      maxSpeed: 1,
      maxUnitsNum: 99,
      maxBasesNum: 99,
      buildingRates: { base: 3, habitation: 0, temple: 3, well: 0, storage: 0, obelisk: 1 },
      hideEnemySpeed: false,
      killAtBirth: false,
      enableUndo: true,
      loadGame: false,
    },
    shallow: true,
  })
  return wrapper.vm
}

describe('DinoGame endgame phase detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateEndgamePhases', () => {
    it('flags all-humans-eliminated as soon as the last human is inactive', () => {
      const vm = makeWrapper()
      vm.players = [
        makePlayer(Models.PlayerTypes.HUMAN, false),
        makePlayer(Models.PlayerTypes.BOT),
        makePlayer(Models.PlayerTypes.BOT),
      ]
      vm.updateEndgamePhases()
      expect(vm.humanPhase).toBe(vm.HUMAN_PHASES.all_eliminated)
      // Two bots still active — no last player yet.
      expect(vm.lastPlayerPhase).toBe(vm.LAST_PLAYER_PHASES.progress)
    })

    it('sets last-player phase when a lone bot remains', () => {
      const vm = makeWrapper()
      vm.players = [
        makePlayer(Models.PlayerTypes.HUMAN, false),
        makePlayer(Models.PlayerTypes.BOT, false),
        makePlayer(Models.PlayerTypes.BOT),
      ]
      vm.updateEndgamePhases()
      expect(vm.lastPlayerPhase).toBe(vm.LAST_PLAYER_PHASES.last_player)
      expect(vm.lastPlayer).toBe(2)
      expect(vm.winPhase).toBe(vm.WIN_PHASES.progress)
    })

    it('converts a lone surviving human into a win, not a last-player notice', () => {
      const vm = makeWrapper({ humanPlayersNum: 2, botPlayersNum: 1 })
      vm.players = [
        makePlayer(Models.PlayerTypes.HUMAN, false),
        makePlayer(Models.PlayerTypes.HUMAN),
        makePlayer(Models.PlayerTypes.BOT, false),
      ]
      vm.updateEndgamePhases()
      expect(vm.winPhase).toBe(vm.WIN_PHASES.has_winner)
      expect(vm.winner).toBe(1)
      expect(vm.lastPlayerPhase).toBe(vm.LAST_PLAYER_PHASES.progress)
      // The winner is still alive, so humans are not "all eliminated".
      expect(vm.humanPhase).toBe(vm.HUMAN_PHASES.progress)
    })

    it('does not clobber an already-detected winner', () => {
      const vm = makeWrapper()
      vm.players = [makePlayer(Models.PlayerTypes.HUMAN), makePlayer(Models.PlayerTypes.BOT, false)]
      vm.winPhase = vm.WIN_PHASES.informed
      vm.winner = 0
      vm.updateEndgamePhases()
      expect(vm.winPhase).toBe(vm.WIN_PHASES.informed)
      expect(vm.lastPlayerPhase).toBe(vm.LAST_PLAYER_PHASES.progress)
    })
  })

  describe('same-move elimination in startTurn', () => {
    it('combines the lose detection with the phase update in one turn start', async () => {
      const vm = makeWrapper()
      vm.players = [
        makePlayer(Models.PlayerTypes.HUMAN),
        makePlayer(Models.PlayerTypes.BOT),
        makePlayer(Models.PlayerTypes.BOT),
      ]
      vm.currentPlayer = 0
      vm.state = vm.STATES.ready
      vm.showTurnNotification = vi.fn()
      vm.setVisibilityStartTurn = vi.fn()
      vm.applyTutorialFirstProductionOverride = vi.fn()
      // The human produces nothing — they are eliminated this turn.
      vm.fieldEngine.restoreAndProduceUnits = vi.fn(() => ({
        buildingsNum: 0,
        unitsNum: 0,
        births: [],
      }))

      await vm.startTurn()

      expect(vm.players[0].active).toBe(false)
      // Phase flipped in the SAME move, so the very first lose label can
      // already carry the "watch bots or exit" guidance.
      expect(vm.humanPhase).toBe(vm.HUMAN_PHASES.all_eliminated)
      // Two bots remain, so no last-player notice yet.
      expect(vm.lastPlayerPhase).toBe(vm.LAST_PLAYER_PHASES.progress)
      // The ready-label must stay up for this player (not skipped).
      expect(vm.checkSkipReadyLabel()).toBe(false)
    })
  })
})
