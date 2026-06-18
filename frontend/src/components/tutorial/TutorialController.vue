<template>
  <TutorialHint
    v-if="currentStep && !hintSuppressed && !currentStep.invisible"
    :key="`hint-${stepIndex}`"
    :text="resolvedText"
    :hint-note="currentStep.note || ''"
    :anchor="currentStep.anchor || 'center'"
    :anchor-cell="currentStep.anchorCell || null"
    :image="currentStep.image || ''"
    :show-ok="currentStep.waitFor === 'ok'"
    @ok="handleOk"
  />
  <div v-if="scenarioFinished" class="tutorial-end-overlay">
    <div class="tutorial-end-box">
      <div class="tutorial-end-title">Scenario complete!</div>
      <div class="tutorial-end-actions">
        <button v-if="hasNext" type="button" class="tutorial-end-btn" @click="goNext">
          Next scenario
        </button>
        <button type="button" class="tutorial-end-btn" @click="goExit">
          Back to tutorial menu
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import TutorialHint from '@/components/tutorial/TutorialHint.vue'
import emitter from '@/game/eventBus'
import { SCENARIOS, markScenarioCompleted } from '@/game/tutorialScenarios'
import { GAME_STATES } from '@/game/const'

export default {
  name: 'TutorialController',
  components: { TutorialHint },
  props: {
    scenario: { type: Object, required: true },
    // Function returning the live game context (field, currentPlayer, etc.)
    // The controller calls this on every check so it always sees current state.
    getContext: { type: Function, required: true },
  },
  data() {
    return {
      stepIndex: 0,
      scenarioFinished: false,
      // Tracks isAnimating from DinoGame; while true we hide the hint so
      // the player actually sees the move/birth/death/scroll animations.
      gameAnimating: false,
      // True while a tutorial-initiated smooth scroll is in flight, so
      // the hint waits for the camera to settle before appearing.
      gameScrolling: false,
      // Track scroll listener cleanup
      scrollHandler: null,
      scrollContainer: null,
    }
  },
  computed: {
    currentStep() {
      if (this.scenarioFinished) return null
      if (this.stepIndex >= this.scenario.steps.length) return null
      return this.scenario.steps[this.stepIndex]
    },
    hasNext() {
      const idx = SCENARIOS.findIndex(s => s.id === this.scenario.id)
      return idx >= 0 && idx < SCENARIOS.length - 1
    },
    // Combined gate for hint visibility. Any in-flight game animation
    // (move / birth / death) or tutorial-initiated scroll hides the
    // hint until things settle.
    hintSuppressed() {
      return this.gameAnimating || this.gameScrolling
    },
    // Resolves the current step's `text` to a string. Steps can use a
    // plain string OR a function `(ctx) => string` for messages that
    // need live game state (e.g. "you have N dinos and M empty
    // towers"). The function form is re-evaluated on every render, so
    // the numbers stay current if the underlying state changes.
    resolvedText() {
      const step = this.currentStep
      if (!step) return ''
      if (typeof step.text === 'function') {
        try {
          return step.text(this.getContext())
        } catch (_e) {
          return ''
        }
      }
      return step.text || ''
    },
    // While an informational (OK-button) hint is on screen, the player
    // shouldn't be able to take game actions that might silently skip
    // past the message. Action-waiting steps DON'T set this — they
    // already only advance on the right input, and the user must remain
    // free to take "off-script" actions (e.g. ending the turn) so they
    // can recover. Right-click and the gear menu stay enabled.
    //
    // `forceEndTurn` / `forceUndo` are exceptions: those steps lock
    // everything EXCEPT the respective button (so the scenario can
    // shepherd the player toward one specific action without giving
    // them other options).
    //
    // `inputBlocked` covers cells + Next-unit. End turn and Undo are
    // gated separately so a forceX step can keep its one allowed
    // button alive while still blocking the rest.
    inputBlocked() {
      const step = this.currentStep
      if (!step) return false
      if (step.lockAll) return true
      if (step.waitFor === 'ok') return true
      if (step.forceEndTurn) return true
      if (step.forceUndo) return true
      return false
    },
    // Separate gate for the End turn button. `forceEndTurn` keeps the
    // input-block but explicitly allows End turn to fire; `forceUndo`
    // keeps End turn blocked. `lockAll` overrides everything.
    endTurnBlocked() {
      const step = this.currentStep
      if (!step) return false
      if (step.lockAll) return true
      if (step.forceEndTurn) return false
      if (step.forceUndo) return true
      if (step.waitFor === 'ok') return true
      return false
    },
    // Separate gate for the Undo button. `forceUndo` keeps the input-
    // block but explicitly allows Undo to fire; `forceEndTurn` keeps
    // Undo blocked. `lockAll` overrides everything.
    undoBlocked() {
      const step = this.currentStep
      if (!step) return false
      if (step.lockAll) return true
      if (step.forceUndo) return false
      if (step.forceEndTurn) return true
      if (step.waitFor === 'ok') return true
      return false
    },
  },
  watch: {
    currentStep: {
      immediate: true,
      handler(newStep, oldStep) {
        if (oldStep && oldStep.highlightCells) {
          emitter.emit('tutorialHighlight', null)
        }
        if (!newStep) return
        // Highlight cells if requested
        if (newStep.highlightCells) {
          emitter.emit('tutorialHighlight', newStep.highlightCells)
          // Scroll the first highlighted cell into view so the player
          // sees what to do without having to hunt for it.
          emitter.emit('tutorialCenterOn', newStep.highlightCells[0])
        } else if (newStep.anchorCell) {
          // Cell-anchored hints (e.g. "Select the dino") should scroll
          // the target cell into view at the moment the message appears.
          emitter.emit('tutorialCenterOn', newStep.anchorCell)
        }
        // Re-check goal/win conditions in case they're already satisfied
        // (e.g., the player completed the goal before clicking past the
        // intermediate OK step).
        this.$nextTick(() => this.checkPassiveConditions())
      },
    },
    inputBlocked: {
      immediate: true,
      handler(blocked) {
        emitter.emit('tutorial:inputBlockChanged', !!blocked)
      },
    },
    endTurnBlocked: {
      immediate: true,
      handler(blocked) {
        emitter.emit('tutorial:endTurnBlockChanged', !!blocked)
      },
    },
    undoBlocked: {
      immediate: true,
      handler(blocked) {
        emitter.emit('tutorial:undoBlockChanged', !!blocked)
      },
    },
  },
  mounted() {
    emitter.on('tutorial:unitSelected', this.onUnitSelected)
    emitter.on('tutorial:moveFinished', this.onMoveFinished)
    emitter.on('selectNextUnit', this.onNextUnit)
    emitter.on('tutorial:turnEnded', this.onTurnEnded)
    emitter.on('tutorial:turnStarted', this.onTurnStarted)
    emitter.on('tutorial:gameWon', this.onGameWon)
    emitter.on('tutorial:towerCaptured', this.onTowerCaptured)
    emitter.on('tutorial:undone', this.onUndone)
    emitter.on('tutorial:unitKilled', this.onUnitKilled)
    emitter.on('scoutArea', this.onScouted)
    emitter.on('tutorial:animatingChanged', this.onAnimatingChanged)
    emitter.on('tutorial:scrollingChanged', this.onScrollingChanged)
    this.attachScrollListener()
  },
  beforeUnmount() {
    emitter.off('tutorial:unitSelected', this.onUnitSelected)
    emitter.off('tutorial:moveFinished', this.onMoveFinished)
    emitter.off('selectNextUnit', this.onNextUnit)
    emitter.off('tutorial:turnEnded', this.onTurnEnded)
    emitter.off('tutorial:turnStarted', this.onTurnStarted)
    emitter.off('tutorial:gameWon', this.onGameWon)
    emitter.off('tutorial:towerCaptured', this.onTowerCaptured)
    emitter.off('tutorial:undone', this.onUndone)
    emitter.off('tutorial:unitKilled', this.onUnitKilled)
    emitter.off('scoutArea', this.onScouted)
    emitter.off('tutorial:animatingChanged', this.onAnimatingChanged)
    emitter.off('tutorial:scrollingChanged', this.onScrollingChanged)
    this.detachScrollListener()
    // Clear any leftover highlights and release the input lock so a
    // re-entry into a normal game can't inherit a stale disabled state.
    emitter.emit('tutorialHighlight', null)
    emitter.emit('tutorial:inputBlockChanged', false)
    emitter.emit('tutorial:endTurnBlockChanged', false)
    emitter.emit('tutorial:undoBlockChanged', false)
  },
  methods: {
    advance() {
      const step = this.currentStep
      if (step && step.isEnd) {
        this.scenarioFinished = true
        markScenarioCompleted(this.scenario.id)
        return
      }
      this.stepIndex += 1
      // After the linear move, see if the new step (or chain of new
      // steps) should be skipped because their `skipIf` is already
      // satisfied (e.g. the player completed a future objective ahead
      // of schedule).
      this.resolveSkipIf()
    },
    // Walk forward through `skipIf` → `skipTo` redirects until we
    // land on a step that still wants to run. Synchronous so the
    // jump happens before the next render — avoids a brief flash
    // of the skipped hint.
    resolveSkipIf() {
      let safety = 0
      while (safety++ < 50) {
        const step = this.currentStep
        if (!step) return
        if (typeof step.skipIf !== 'function' || !step.skipTo) return
        let satisfied = false
        try {
          satisfied = !!step.skipIf(this.getContext())
        } catch (_e) {
          return
        }
        if (!satisfied) return
        const idx = this.scenario.steps.findIndex(s => s.id === step.skipTo)
        if (idx === -1) {
          // eslint-disable-next-line no-console
          console.warn(`Tutorial: unknown skipTo target "${step.skipTo}"`)
          return
        }
        if (idx <= this.stepIndex) return // never jump backwards
        this.stepIndex = idx
      }
    },
    handleOk() {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'ok') return
      this.advance()
    },
    onUnitSelected(_payload) {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'unitSelected') return
      this.advance()
    },
    onMoveFinished(_payload) {
      if (!this.currentStep) return
      const step = this.currentStep
      if (step.waitFor === 'unitMoved') {
        this.advance()
        return
      }
      // Re-check unitReached after each completed move so the player can
      // move multiple turns to reach the target.
      if (step.waitFor === 'unitReached') {
        const target = step.params?.coords
        if (!target) return
        const ctx = this.getContext()
        const [tx, ty] = target
        const cell = ctx.getField()?.[tx]?.[ty]
        if (cell?.unit && cell.unit.player === 0) {
          this.advance()
          return
        }
      }
      // A move can also satisfy a step.check predicate.
      this.checkPassiveConditions()
    },
    onNextUnit(_payload) {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'nextUnit') return
      this.advance()
    },
    onTurnEnded() {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'turnEnded') return
      this.advance()
    },
    onTurnStarted(playerIdx) {
      if (!this.currentStep) return
      // Re-check goal at every turn start in case the goal was completed
      // by enemy actions or scoring.
      if (this.currentStep.waitFor === 'turnStarted' && playerIdx === 0) {
        this.advance()
      }
      this.checkPassiveConditions()
    },
    onMenuOpened() {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'menuOpened') return
      this.advance()
    },
    onGameWon(playerIdx) {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'win') return
      if (playerIdx === 0) this.advance()
    },
    onTowerCaptured(payload) {
      if (!this.currentStep) return
      if (this.currentStep.waitFor === 'towerCaptured') {
        // Only the human player's own captures count.
        if (payload && payload.player !== undefined && payload.player !== 0) return
        this.advance()
        return
      }
      this.checkPassiveConditions()
    },
    onUndone() {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'undone') return
      this.advance()
    },
    onScouted(_payload) {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'scouted') return
      this.advance()
    },
    onUnitKilled(payload) {
      if (!this.currentStep) return
      const step = this.currentStep
      if (step.waitFor === 'unitKilled') {
        // Optionally pin to a specific killer (e.g. params.killerPlayer:
        // 1 means "wait for an enemy kill"). Defaults to the human.
        const expectedKiller = step.params?.killerPlayer ?? 0
        if (payload?.killerPlayer !== expectedKiller) return
        this.advance()
        return
      }
      // A kill can also satisfy a step.check predicate (e.g., "all
      // stationary enemies are dead"). Re-evaluate after the kill is
      // applied to the field.
      this.checkPassiveConditions()
    },
    onAnimatingChanged(animating) {
      this.gameAnimating = !!animating
    },
    onScrollingChanged(scrolling) {
      this.gameScrolling = !!scrolling
    },
    checkPassiveConditions() {
      const step = this.currentStep
      if (!step) return
      // Per-step custom predicate, evaluated after every event that
      // could change game state (kill, move, capture, turn start).
      // `check` runs FIRST so that when `check` and `skipIf` share a
      // predicate (e.g. "move a dino onto a habitation" with
      // `skipIf: playerOnHabitation, skipTo: grow-army`), completing
      // the check advances linearly to the follow-up message
      // instead of being shortcut past it.
      if (typeof step.check === 'function') {
        try {
          if (step.check(this.getContext())) {
            this.advance()
            return
          }
        } catch (_e) {
          // swallow — getContext may not be ready yet
        }
      }
      // After `check` had its chance, re-evaluate `skipIf` in case a
      // separate shortcut condition became true mid-step (e.g.
      // scenario 3: player kills the tower defender before finishing
      // the multikill task — skipIf jumps straight to the End-turn
      // lesson). The check/skipIf-overlap case is already handled by
      // the early-return above.
      this.resolveSkipIf()
      if (this.currentStep !== step) return
      // "Soft cap reached": the human player's empty bases plus their
      // current units exceed their max, so the next turn's production
      // won't be able to spawn everything (the bottom-panel number
      // turns red). Same formula as InfoPanel.unitsOverLimit. Used to
      // gate a "you've hit the dino cap" hint.
      if (step.waitFor === 'unitLimitReached') {
        try {
          const stats = this.getContext().getCurrentStats(0)
          const max = stats?.units?.max || 0
          const emptyBases = stats?.towers?.empty || 0
          if (max && stats.units.total + emptyBases > max) {
            this.advance()
            return
          }
        } catch (_e) {
          // swallow — getContext may not be ready yet
        }
      }
      if (step.waitFor === 'goal' && this.scenario.goal) {
        const ctx = this.getContext()
        try {
          if (this.scenario.goal.check(ctx)) this.advance()
        } catch (_e) {
          // swallow — getContext may not be ready yet
        }
        return
      }
      if (step.waitFor === 'unitReached') {
        const target = step.params?.coords
        if (!target) return
        try {
          const ctx = this.getContext()
          const [tx, ty] = target
          const cell = ctx.getField()?.[tx]?.[ty]
          if (cell?.unit && cell.unit.player === 0) this.advance()
        } catch (_e) {
          // swallow
        }
      }
    },
    attachScrollListener() {
      // The game grid container is the only scrollable element we care
      // about. Find it lazily — it mounts after this component.
      const tryAttach = () => {
        const container = document.querySelector('.game-grid-container')
        if (!container) {
          setTimeout(tryAttach, 200)
          return
        }
        this.scrollContainer = container
        this.scrollHandler = this.onScroll
        container.addEventListener('scroll', this.scrollHandler, { passive: true })
      }
      tryAttach()
    },
    detachScrollListener() {
      if (this.scrollContainer && this.scrollHandler) {
        this.scrollContainer.removeEventListener('scroll', this.scrollHandler)
      }
      this.scrollContainer = null
      this.scrollHandler = null
    },
    onScroll() {
      if (!this.currentStep) return
      if (this.currentStep.waitFor !== 'scrolled') return
      const container = this.scrollContainer
      if (!container) return
      const edge = this.currentStep.params?.edge || 'right'
      const tolerance = 30
      let reached = false
      const atRight =
        container.scrollLeft >= container.scrollWidth - container.clientWidth - tolerance
      const atLeft = container.scrollLeft <= tolerance
      const atBottom =
        container.scrollTop >= container.scrollHeight - container.clientHeight - tolerance
      const atTop = container.scrollTop <= tolerance
      if (edge === 'right') reached = atRight
      else if (edge === 'left') reached = atLeft
      else if (edge === 'bottom') reached = atBottom
      else if (edge === 'top') reached = atTop
      else if (edge === 'bottom-right') reached = atRight && atBottom
      else if (edge === 'bottom-left') reached = atLeft && atBottom
      else if (edge === 'top-right') reached = atRight && atTop
      else if (edge === 'top-left') reached = atLeft && atTop
      else if (edge === 'any') reached = true
      if (reached) this.advance()
    },
    goNext() {
      const idx = SCENARIOS.findIndex(s => s.id === this.scenario.id)
      if (idx >= 0 && idx < SCENARIOS.length - 1) {
        const next = SCENARIOS[idx + 1]
        emitter.emit('startTutorialScenario', next.id)
      } else {
        emitter.emit('goToPage', GAME_STATES.tutorial)
      }
    },
    goExit() {
      emitter.emit('goToPage', GAME_STATES.tutorial)
    },
  },
}
</script>

<style scoped>
.tutorial-end-overlay {
  position: fixed;
  inset: 0;
  z-index: 10060;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tutorial-end-box {
  background-color: rgba(0, 0, 0, 0.92);
  border: 2px solid #d8a67e;
  border-radius: 12px;
  padding: 24px 32px;
  color: #ffffff;
  text-align: center;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
  max-width: 90vw;
}

.tutorial-end-title {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 20px;
}

.tutorial-end-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.tutorial-end-btn {
  /* Solid light-brown face. The border is the only gradient: a
     top-to-bottom dark-brown ramp painted as a second background
     layer (border-box clip) while the face layer is clipped to
     padding-box. A transparent border lets the gradient show.
     Outer drop-shadow lifts the button off the overlay. */
  background:
    linear-gradient(#c89868, #c89868) padding-box,
    linear-gradient(180deg, #8c5e35 0%, #5a3a1a 50%, #2a1809 100%) border-box;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 10px 26px;
  font-family: inherit;
  font-size: 18px;
  font-weight: bold;
  color: #ffffff;
  cursor: pointer;
  text-shadow: 1px 1px 2px #000;
  min-width: 240px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.45);
  transition:
    filter 0.1s,
    transform 0.05s,
    box-shadow 0.05s;
}

.tutorial-end-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
</style>
