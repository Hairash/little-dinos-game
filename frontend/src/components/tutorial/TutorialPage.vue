<template>
  <div id="tutorialPageWrapper">
    <button type="button" class="goBackBtn" @click="handleBackBtnClick">
      <img :src="`/images/arrow_white.png`" alt="Back" />
    </button>
    <div id="tutorialContent">
      <h1>Tutorial</h1>
      <p class="subtitle">Choose a scenario to start.</p>
      <div class="scenario-list">
        <button
          v-for="scenario in scenarios"
          :key="scenario.id"
          type="button"
          class="scenario-btn"
          @click="handleScenarioClick(scenario.id)"
        >
          <span class="scenario-check" :class="{ done: completed[scenario.id] }">
            {{ completed[scenario.id] ? '✓' : '' }}
          </span>
          <span class="scenario-label">
            <span class="scenario-title">{{ scenario.title }}</span>
            <span class="scenario-desc">{{ scenario.description }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { GAME_STATES } from '@/game/const'
import { SCENARIOS, loadCompletedScenarios } from '@/game/tutorialScenarios'

export default {
  name: 'TutorialPage',
  data() {
    return {
      scenarios: SCENARIOS,
      completed: {},
    }
  },
  mounted() {
    this.completed = loadCompletedScenarios()
  },
  methods: {
    handleBackBtnClick() {
      // Tutorial lives under the New Game submenu now; back returns
      // there rather than jumping all the way to the main menu.
      emitter.emit('goToPage', GAME_STATES.newGame)
    },
    handleScenarioClick(id) {
      emitter.emit('startTutorialScenario', id)
    },
  },
}
</script>

<style scoped>
#tutorialPageWrapper {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: auto;
  background-image: url('/images/background.png');
  background-size: cover;
  text-align: center;
  color: white;
}

.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: rgba(0, 0, 0, 0);
  cursor: pointer;
}

.goBackBtn img {
  width: 40px;
  height: 40px;
  user-select: none;
}

#tutorialContent {
  max-width: 600px;
  margin: 0 auto;
  /* No top padding here — the title's own padding handles vertical
     spacing so the heading lines up with the back button (same
     pattern as Game setup / Game rules pages). */
  padding: 0 15px 30px;
}

h1 {
  margin: 0;
  padding: 30px;
  text-shadow:
    -2px 0 black,
    0 2px black,
    1px 0 black,
    0 -1px black;
}

.subtitle {
  margin: 0 0 30px;
  font-size: 16px;
  opacity: 0.85;
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.scenario-btn {
  width: 100%;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.55);
  border: 2px solid #d8a67e;
  border-radius: 10px;
  color: white;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s,
    transform 0.05s;
}

.scenario-btn:hover {
  background-color: rgba(0, 0, 0, 0.75);
}

.scenario-btn:active {
  transform: scale(0.99);
}

.scenario-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #d8a67e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
  color: transparent;
  flex-shrink: 0;
}

.scenario-check.done {
  background-color: #32cc67;
  border-color: #32cc67;
  color: black;
}

.scenario-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.scenario-title {
  font-size: 18px;
  font-weight: bold;
}

.scenario-desc {
  font-size: 13px;
  opacity: 0.8;
}
</style>
