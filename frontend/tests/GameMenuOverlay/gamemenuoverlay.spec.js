import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GameMenuOverlay from '@/components/game/GameMenuOverlay.vue'

function makeWrapper(props = {}) {
  return mount(GameMenuOverlay, {
    props: {
      field: [[{ unit: null, building: null, isHidden: false }]],
      fieldEngine: { getPlayerBuildingsByType: () => ({}) },
      currentPlayer: 0,
      players: [{ participating: true }],
      minSpeed: 1,
      maxSpeed: 5,
      handleExit: vi.fn(),
      handleZoomIn: vi.fn(),
      handleZoomOut: vi.fn(),
      handleResume: vi.fn(),
      ...props,
    },
  })
}

describe('GameMenuOverlay bot movement control', () => {
  it('does not show the single-player control without a toggle handler', () => {
    const wrapper = makeWrapper()

    expect(wrapper.find('img[alt="Normal bot movement"]').exists()).toBe(false)
  })

  it('shows the normal icon and calls the toggle handler', async () => {
    const toggle = vi.fn()
    const wrapper = makeWrapper({ handleBotMovementModeToggle: toggle })

    const icon = wrapper.find('img[alt="Normal bot movement"]')
    expect(icon.attributes('src')).toContain('bot_normal_movement_icon.png')
    await wrapper.find('button[title="Normal bot movement (F)"]').trigger('click')
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('shows the fast-forward icon for fast-forward mode', () => {
    const wrapper = makeWrapper({
      botMovementMode: 'fast_forward',
      handleBotMovementModeToggle: vi.fn(),
    })

    const icon = wrapper.find('img[alt="Fast-forward bot moves"]')
    expect(icon.attributes('src')).toContain('bot_fast_forward_icon.png')
  })
})
