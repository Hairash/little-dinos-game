import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GameCell from '@/components/game/GameCell.vue'
import GameUnit from '@/components/game/GameUnit.vue'
import Models from '@/game/models.js'

function createUnit(player, movePoints = 3) {
  return new Models.Unit(player, player === 0 ? 'dino1' : 'dino2', movePoints, 2)
}

function mountGameCell(propsOverrides = {}) {
  return mount(GameCell, {
    props: {
      width: 50,
      height: 50,
      terrain: { kind: 'empty', idx: 0 },
      unit: null,
      building: null,
      selected: false,
      highlighted: false,
      hidden: false,
      currentPlayer: 0,
      cellX: 0,
      cellY: 0,
      hasSelectedUnit: false,
      ...propsOverrides,
    },
    shallow: true,
  })
}

describe('GameCell move points visibility (hideEnemySpeed)', () => {
  it('shows speed for every unit when hideEnemySpeed is off', () => {
    const wrapper = mountGameCell({
      hideEnemySpeed: false,
      currentPlayer: 0,
      unit: createUnit(1),
    })
    expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(true)
  })

  describe('single-player (myPlayerOrder is null)', () => {
    it('hides enemy speed on the human turn', () => {
      // Human (player 0) is playing; bot unit (player 1) on the cell.
      const wrapper = mountGameCell({
        hideEnemySpeed: true,
        currentPlayer: 0,
        viewingPlayer: 0,
        unit: createUnit(1),
      })
      expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(false)
    })

    it('hides enemy speed during the enemy turn (regression)', () => {
      // Bot (player 1) is taking its turn, but the screen still renders
      // from the human's perspective (viewingPlayer stays 0). The bot's
      // speed must stay hidden — following currentPlayer here was the bug.
      const wrapper = mountGameCell({
        hideEnemySpeed: true,
        currentPlayer: 1,
        viewingPlayer: 0,
        unit: createUnit(1),
      })
      expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(false)
    })

    it('keeps own speed visible during the enemy turn', () => {
      const wrapper = mountGameCell({
        hideEnemySpeed: true,
        currentPlayer: 1,
        viewingPlayer: 0,
        unit: createUnit(0),
      })
      expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(true)
    })
  })

  describe('multiplayer (myPlayerOrder set)', () => {
    it('hides opponent speed during the opponent turn', () => {
      const wrapper = mountGameCell({
        hideEnemySpeed: true,
        currentPlayer: 1,
        viewingPlayer: 0,
        myPlayerOrder: 0,
        unit: createUnit(1),
      })
      expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(false)
    })

    it('keeps own speed visible during the opponent turn', () => {
      const wrapper = mountGameCell({
        hideEnemySpeed: true,
        currentPlayer: 1,
        viewingPlayer: 0,
        myPlayerOrder: 0,
        unit: createUnit(0),
      })
      expect(wrapper.findComponent(GameUnit).props('showMovePoints')).toBe(true)
    })
  })
})
