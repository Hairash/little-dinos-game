/**
 * Tutorial Mixin
 *
 * Owns every piece of tutorial-only state and plumbing that would
 * otherwise live in DinoGame.vue. Lets DinoGame keep just the narrow
 * `if (this.tutorialScenario) …` guards at the call sites where they
 * actually change game behaviour.
 *
 * Provided by this mixin:
 * - Data: tutorialInputBlocked / tutorialEndTurnBlocked /
 *   tutorialUndoBlocked / tutorialFirstProductionDone
 * - Handlers for the three `tutorial:*BlockChanged` events
 * - `applyTutorialFirstProductionOverride(births)` — honours the
 *   scenario's `firstProducedSpeed` / `firstProducedSpeedForbidden`
 * - `getTutorialContext()` — the ctx object passed to step predicates
 * - Lifecycle: subscribes to the three lock events in `created` (NOT
 *   `mounted`, because the child TutorialController's `immediate: true`
 *   watchers fire before the parent's mounted hook), unsubscribes in
 *   `beforeUnmount`. Forwards `isAnimating` changes as
 *   `tutorial:animatingChanged`.
 *
 * NOT provided by this mixin (intentionally — these guards live at
 * the call site so the behaviour is visible while reading DinoGame):
 * - `loadFieldOrGenerateNewField` / `loadOrCreatePlayers` (scenario
 *   field + player overrides)
 * - The `if (this.tutorialScenario) …` early-returns in `saveState`,
 *   `processEndTurn`, `undoLastMove`, `canUndo`, `exitGame`,
 *   `checkEndOfGame`, `checkSkipReadyLabel`,
 *   `selectNextPlayerAndCheckPhases`, and the `'e'` shortcut
 * - The `tutorial:*` event emits inside `moveUnit`, `startTurn`,
 *   `processEndTurn`, `runBirthSequence`, `checkEndOfGame`,
 *   `undoLastMove` — each is a one-liner that belongs at the
 *   read site (look for the `// [tutorial]` marker)
 * - The `<TutorialController v-if="tutorialScenario" …>` mount in
 *   the DinoGame template
 *
 * Full subsystem reference: .claude/docs/tutorial.md
 */

import emitter from '@/game/eventBus'
import { calculateUnitVisibility } from '@/game/helpers'

export const tutorialMixin = {
  data() {
    return {
      // Cells + Next-unit lock. Toggled by the controller's
      // `inputBlocked` computed (covers OK steps, forceEndTurn,
      // forceUndo, and lockAll).
      tutorialInputBlocked: false,
      // End-turn button + 'e' shortcut lock.
      tutorialEndTurnBlocked: false,
      // Undo button + middle-mouse undo lock.
      tutorialUndoBlocked: false,
      // Latched after the first turn that actually produces a unit,
      // so first-production overrides only fire once per scenario.
      tutorialFirstProductionDone: false,
    }
  },
  watch: {
    // Surface animation transitions so the controller can hold off
    // rendering the next hint until the move / birth / death
    // animation has actually finished playing.
    isAnimating(newVal) {
      emitter.emit('tutorial:animatingChanged', !!newVal)
    },
  },
  created() {
    // Subscribe here, not in `mounted`. TutorialController is a child
    // and its `immediate: true` watchers fire during the parent's
    // render cycle, before the parent's `mounted` hook runs.
    // Subscribing in `mounted` would lose the initial emission for
    // step 0.
    emitter.on('tutorial:inputBlockChanged', this.handleTutorialInputBlock)
    emitter.on('tutorial:endTurnBlockChanged', this.handleTutorialEndTurnBlock)
    emitter.on('tutorial:undoBlockChanged', this.handleTutorialUndoBlock)
  },
  beforeUnmount() {
    emitter.off('tutorial:inputBlockChanged', this.handleTutorialInputBlock)
    emitter.off('tutorial:endTurnBlockChanged', this.handleTutorialEndTurnBlock)
    emitter.off('tutorial:undoBlockChanged', this.handleTutorialUndoBlock)
  },
  methods: {
    handleTutorialInputBlock(blocked) {
      this.tutorialInputBlocked = !!blocked
    },
    handleTutorialEndTurnBlock(blocked) {
      this.tutorialEndTurnBlocked = !!blocked
    },
    handleTutorialUndoBlock(blocked) {
      this.tutorialUndoBlocked = !!blocked
    },

    /**
     * Re-roll the speeds of the very first batch of produced units to
     * match the active scenario's first-production override.
     *
     * - `firstProducedSpeed` (number): force every newly produced unit
     *   to this speed; recompute visibility when
     *   `visibilitySpeedRelation` is on.
     * - `firstProducedSpeedForbidden` (number): if a freshly produced
     *   unit rolled this exact speed, re-roll uniformly across
     *   `[minSpeed..maxSpeed] \ {forbidden}`.
     *
     * Latches `tutorialFirstProductionDone` so the override only ever
     * fires for the FIRST production batch in the scenario.
     */
    applyTutorialFirstProductionOverride(births) {
      const forced = this.tutorialScenario?.firstProducedSpeed
      const forbidden = this.tutorialScenario?.firstProducedSpeedForbidden
      if (forced == null && forbidden == null) return
      if (this.tutorialFirstProductionDone) return
      if (!births || births.length === 0) return
      this.tutorialFirstProductionDone = true
      if (forced != null) {
        for (const birth of births) {
          const [x, y] = birth.coords
          const unit = this.localField[x]?.[y]?.unit
          if (!unit) continue
          unit.movePoints = forced
          if (this.visibilitySpeedRelation) {
            unit.visibility = calculateUnitVisibility(
              forced,
              this.minSpeed,
              this.speedMinVisibility,
              this.fogOfWarRadius
            )
          }
        }
        return
      }
      const choices = []
      for (let s = this.minSpeed; s <= this.maxSpeed; s++) {
        if (s !== forbidden) choices.push(s)
      }
      if (choices.length === 0) return
      for (const birth of births) {
        const [x, y] = birth.coords
        const unit = this.localField[x]?.[y]?.unit
        if (unit && unit.movePoints === forbidden) {
          unit.movePoints = choices[Math.floor(Math.random() * choices.length)]
        }
      }
    },

    /**
     * The ctx object passed to scenario step predicates
     * (`check`, `skipIf`, `text(ctx)`, `goal.check`).
     */
    getTutorialContext() {
      return {
        getField: () => this.localField,
        getCurrentPlayer: () => this.currentPlayer,
        getCurrentStats: playerNum => this.getCurrentStats(playerNum),
        fieldEngine: this.fieldEngine,
        players: this.players,
      }
    },
  },
}
