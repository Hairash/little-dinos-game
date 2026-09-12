import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReadyLabel from '@/components/game/ReadyLabel.vue'

function mountLabel(propsOverrides = {}) {
  return mount(ReadyLabel, {
    props: {
      onClickAction: () => {},
      currentPlayer: 0,
      isActivePlayer: true,
      isPlayerInformedLose: false,
      areAllHumanPlayersEliminated: false,
      winner: null,
      lastPlayer: null,
      isSingleHuman: false,
      canWatchBots: true,
      ...propsOverrides,
    },
  })
}

describe('ReadyLabel endgame messages', () => {
  it('shows the plain get-ready screen mid-game', () => {
    const text = mountLabel({ currentPlayer: 1 }).text()
    expect(text).toContain('Player 2, get ready!')
    expect(text).not.toContain('you lose')
    expect(text).not.toContain('you win')
  })

  // Single-human games use the compact multiplayer-style plate (icon exit
  // hint, OK button); hotseat keeps the full-screen black label.
  describe('single human', () => {
    it('win: "You win" + exit note, no get-ready', () => {
      const text = mountLabel({ isSingleHuman: true, winner: 0, currentPlayer: 0 }).text()
      expect(text).toContain('You win')
      expect(text).not.toContain('get ready')
      expect(text).not.toContain('Player')
      expect(text).toContain('To exit the game click')
      expect(text).not.toContain('continue playing')
    })

    it('lose with several bots left: one combined label with exit + watch notes', () => {
      const text = mountLabel({
        isSingleHuman: true,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
      }).text()
      expect(text).toContain('You lose')
      expect(text).not.toContain('sorry')
      expect(text).not.toContain('All human players were defeated')
      expect(text).toContain('To exit the game click')
      expect(text).toContain('Or you may watch bot fighting')
    })

    it('lose screen says only "You lose" + the way out, even when a bot won', () => {
      const text = mountLabel({
        isSingleHuman: true,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
        winner: 1,
        lastPlayer: 1,
      }).text()
      expect(text).toContain('You lose')
      expect(text).toContain('To exit the game click')
      // Which bot came top is noise on your own defeat screen.
      expect(text).not.toContain('wins!')
      expect(text).not.toContain('is the only left')
    })

    it('a bot win still shows once the watcher has moved past the lose screen', () => {
      const text = mountLabel({
        isSingleHuman: true,
        isActivePlayer: false,
        isPlayerInformedLose: true,
        winner: 1,
        lastPlayer: 1,
      }).text()
      expect(text).toContain('Player 2 wins!')
    })

    it('scenario: no watch-bots offer — the run ends there', () => {
      const text = mountLabel({
        isSingleHuman: true,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
        canWatchBots: false,
      }).text()
      expect(text).toContain('You lose')
      expect(text).toContain('To exit the game click')
      // End turn is disabled for a lost scenario, so offering the bot
      // fight would be a dead end.
      expect(text).not.toContain('watch bot fighting')
    })

    it('lose with one bot left: no watch note, no "only left" line', () => {
      const text = mountLabel({
        isSingleHuman: true,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
        lastPlayer: 1,
      }).text()
      expect(text).toContain('You lose')
      expect(text).toContain('To exit the game click')
      expect(text).not.toContain('watch bot fighting')
      expect(text).not.toContain('is the only left')
    })
  })

  describe('hotseat', () => {
    it('mid-game loser: addressed by seat, no guidance notes', () => {
      const text = mountLabel({ currentPlayer: 1, isActivePlayer: false }).text()
      expect(text).toContain('Player 2, sorry, you lose')
      expect(text).not.toContain('Press exit icon')
      expect(text).not.toContain('watch bot fighting')
      expect(text).not.toContain('All human players were defeated')
    })

    it('hotseat still names the winner on the lose screen', () => {
      const text = mountLabel({
        currentPlayer: 2,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
        winner: 1,
      }).text()
      // A table of players wants to know who took it.
      expect(text).toContain('Player 2 wins!')
    })

    it('last human eliminated: combined lose + all-defeated + exit + watch notes', () => {
      const text = mountLabel({
        currentPlayer: 2,
        isActivePlayer: false,
        areAllHumanPlayersEliminated: true,
      }).text()
      expect(text).toContain('Player 3, sorry, you lose')
      expect(text).toContain('All human players were defeated')
      expect(text).toContain('Press exit icon on the panel to start new game')
      expect(text).toContain('Or you may watch bot fighting')
    })

    it('winner: "Player Q, you win" + exit note, no get-ready', () => {
      const text = mountLabel({ currentPlayer: 2, winner: 2 }).text()
      expect(text).toContain('Player 3, you win')
      expect(text).not.toContain('get ready')
      expect(text).toContain('Press exit icon on the panel to start new game')
      expect(text).not.toContain('continue playing')
    })
  })

  describe('skins', () => {
    it('hotseat gets the full-screen black label with a Ready button', () => {
      const wrapper = mountLabel({ currentPlayer: 1 })
      expect(wrapper.find('.fixed-label').exists()).toBe(true)
      expect(wrapper.find('.plate-content').exists()).toBe(false)
      expect(wrapper.find('button').text()).toBe('Ready')
    })

    it('single human gets the multiplayer-style plate with an OK button', () => {
      const wrapper = mountLabel({ isSingleHuman: true, winner: 0, currentPlayer: 0 })
      expect(wrapper.find('.plate-content').exists()).toBe(true)
      expect(wrapper.find('.fixed-label').exists()).toBe(false)
      expect(wrapper.find('button').text()).toBe('OK')
    })

    it('the plate shows the settings/exit icons rather than the text note', () => {
      const wrapper = mountLabel({ isSingleHuman: true, winner: 0, currentPlayer: 0 })
      expect(wrapper.findAll('.inline-icon')).toHaveLength(2)
      expect(wrapper.text()).not.toContain('Press exit icon on the panel')
    })
  })

  it('bot-fight endpoint: third-person winner + only-left notice for the informed watcher', () => {
    // Eliminated human (already informed) at their watch slot; bot 2 won.
    const text = mountLabel({
      currentPlayer: 0,
      isActivePlayer: false,
      isPlayerInformedLose: true,
      winner: 1,
      lastPlayer: 1,
    }).text()
    expect(text).toContain('Player 2 wins!')
    expect(text).toContain('Player 2 is the only left')
    expect(text).toContain('Press exit icon on the panel to start new game')
    expect(text).not.toContain('you lose')
  })
})
