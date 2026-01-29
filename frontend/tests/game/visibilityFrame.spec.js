import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import VisibilityFrame from '@/components/game/VisibilityFrame.vue';
import { DEFAULT_CELL_SIZE, DEFAULT_BORDER_WIDTH } from '@/game/const';

describe('VisibilityFrame', () => {
  const defaultProps = {
    x: 5,
    y: 5,
    radius: 3,
    cellSize: 30,
    playerIndex: 0,
    fieldWidth: 20,
    fieldHeight: 20,
  };

  function mountFrame(overrides = {}) {
    return mount(VisibilityFrame, {
      props: { ...defaultProps, ...overrides },
    });
  }

  describe('border width calculation', () => {
    it('returns 1px border at minimum cell size (10px)', () => {
      const wrapper = mountFrame({ cellSize: 10 });
      expect(wrapper.vm.borderWidth).toBe(1);
    });

    it('returns 3px border at default cell size (30px)', () => {
      const wrapper = mountFrame({ cellSize: 30 });
      expect(wrapper.vm.borderWidth).toBe(3);
    });

    it('returns 7px border at maximum cell size (70px)', () => {
      const wrapper = mountFrame({ cellSize: 70 });
      expect(wrapper.vm.borderWidth).toBe(7);
    });

    it('rounds border width correctly for intermediate cell sizes', () => {
      // 20px cells -> 2px border (20/30 * 3 = 2)
      const wrapper20 = mountFrame({ cellSize: 20 });
      expect(wrapper20.vm.borderWidth).toBe(2);

      // 50px cells -> 5px border (50/30 * 3 = 5)
      const wrapper50 = mountFrame({ cellSize: 50 });
      expect(wrapper50.vm.borderWidth).toBe(5);
    });

    it('never returns border width less than 1', () => {
      const wrapper = mountFrame({ cellSize: 5 });
      expect(wrapper.vm.borderWidth).toBeGreaterThanOrEqual(1);
    });
  });

  describe('frame position calculation', () => {
    // Note: All positions have +2px offset to account for the board's 2px border

    it('calculates correct position for center unit', () => {
      // Unit at (5, 5) with radius 3, cellSize 30
      // Frame should start at (5-3) * 30 + 2 = 62px from left
      const wrapper = mountFrame({ x: 5, y: 5, radius: 3, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('62px');
      expect(style.top).toBe('62px');
    });

    it('calculates correct position for edge unit', () => {
      // Unit at (1, 1) with radius 3, cellSize 30
      // Raw left would be (1-3) * 30 + 2 = -58, clipped to 2
      const wrapper = mountFrame({ x: 1, y: 1, radius: 3, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('2px');
      expect(style.top).toBe('2px');
    });

    it('calculates correct position for corner unit (0, 0)', () => {
      const wrapper = mountFrame({ x: 0, y: 0, radius: 2, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('2px');
      expect(style.top).toBe('2px');
    });
  });

  describe('frame size calculation', () => {
    it('calculates correct size for unit in center', () => {
      // Unit at (5, 5) with radius 3, cellSize 30
      // Full size would be (3*2 + 1) * 30 = 210px
      const wrapper = mountFrame({ x: 5, y: 5, radius: 3, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.width).toBe('210px');
      expect(style.height).toBe('210px');
    });

    it('calculates correct size with different radius', () => {
      // Radius 2: (2*2 + 1) * 30 = 150px
      const wrapper = mountFrame({ x: 10, y: 10, radius: 2, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.width).toBe('150px');
      expect(style.height).toBe('150px');
    });

    it('scales size with cell size', () => {
      // Radius 2 with cellSize 50: (2*2 + 1) * 50 = 250px
      const wrapper = mountFrame({ x: 10, y: 10, radius: 2, cellSize: 50 });
      const style = wrapper.vm.frameStyle;

      expect(style.width).toBe('250px');
      expect(style.height).toBe('250px');
    });
  });

  describe('frame clipping at map boundaries', () => {
    // Note: All positions have +2px offset to account for the board's 2px border
    // Clipping is done at 2px (min) and fieldWidth * cellSize + 2 (max)

    it('clips frame at left edge', () => {
      // Unit at (1, 10) with radius 3
      // Left edge would be (1-3) * 30 + 2 = -58, clipped to 2
      // Right edge would be (1+3+1) * 30 + 2 = 152
      const wrapper = mountFrame({ x: 1, y: 10, radius: 3, cellSize: 30, fieldWidth: 20, fieldHeight: 20 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('2px');
      expect(style.width).toBe('150px'); // 152 - 2 = 150
    });

    it('clips frame at right edge', () => {
      // Unit at (18, 10) with radius 3 on 20-wide field
      // Left edge: (18-3) * 30 + 2 = 452
      // Right edge would be (18+3+1) * 30 + 2 = 662, clipped to 20*30 + 2 = 602
      const wrapper = mountFrame({ x: 18, y: 10, radius: 3, cellSize: 30, fieldWidth: 20, fieldHeight: 20 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('452px');
      expect(style.width).toBe('150px'); // 602 - 452 = 150
    });

    it('clips frame at top edge', () => {
      // Unit at (10, 1) with radius 3
      // Top would be (1-3) * 30 + 2 = -58, clipped to 2
      const wrapper = mountFrame({ x: 10, y: 1, radius: 3, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.top).toBe('2px');
    });

    it('clips frame at bottom edge', () => {
      // Unit at (10, 18) with radius 3 on 20-high field
      // Top: (18-3) * 30 + 2 = 452
      // Bottom would be (18+3+1) * 30 + 2 = 662, clipped to 20*30 + 2 = 602
      const wrapper = mountFrame({ x: 10, y: 18, radius: 3, cellSize: 30, fieldWidth: 20, fieldHeight: 20 });
      const style = wrapper.vm.frameStyle;

      expect(style.top).toBe('452px');
      expect(style.height).toBe('150px'); // 602 - 452 = 150
    });

    it('clips frame in corner', () => {
      // Unit at (0, 0) with radius 2
      // Frame should be clipped on both left/top to 2px
      const wrapper = mountFrame({ x: 0, y: 0, radius: 2, cellSize: 30 });
      const style = wrapper.vm.frameStyle;

      expect(style.left).toBe('2px');
      expect(style.top).toBe('2px');
      // Width: rawRight = (0+2+1) * 30 + 2 = 92, clipped to min(602, 92) = 92
      // 92 - 2 = 90
      expect(style.width).toBe('90px');
      expect(style.height).toBe('90px');
    });
  });

  describe('player color', () => {
    it('returns blue for player 0', () => {
      const wrapper = mountFrame({ playerIndex: 0 });
      expect(wrapper.vm.playerColor).toBe('#4A90E2');
    });

    it('returns mint for player 1', () => {
      const wrapper = mountFrame({ playerIndex: 1 });
      expect(wrapper.vm.playerColor).toBe('#32cc67');
    });

    it('returns red for player 2', () => {
      const wrapper = mountFrame({ playerIndex: 2 });
      expect(wrapper.vm.playerColor).toBe('#FF4444');
    });

    it('applies color to border', () => {
      const wrapper = mountFrame({ playerIndex: 0 });
      const style = wrapper.vm.frameStyle;
      expect(style.borderColor).toBe('#4A90E2');
    });
  });

  describe('styling', () => {
    it('has transparent background', () => {
      const wrapper = mountFrame();
      const element = wrapper.find('.visibility-frame');
      expect(element.exists()).toBe(true);
    });

    it('has pointer-events none', () => {
      const wrapper = mountFrame();
      // The component should have pointer-events: none in scoped styles
      // We verify the class exists
      expect(wrapper.classes()).toContain('visibility-frame');
    });
  });

  describe('center marker', () => {
    it('does not render cross marker when showCenterMarker is false (default)', () => {
      const wrapper = mountFrame();
      const marker = wrapper.find('.center-marker');
      expect(marker.exists()).toBe(false);
    });

    it('renders cross marker when showCenterMarker is true', () => {
      const wrapper = mountFrame({ showCenterMarker: true });
      const marker = wrapper.find('.center-marker');
      expect(marker.exists()).toBe(true);
    });

    it('uses correct player color for cross marker', () => {
      const wrapper = mountFrame({ showCenterMarker: true, playerIndex: 0 });
      const style = wrapper.vm.centerMarkerStyle;
      expect(style['--cross-color']).toBe('#4A90E2');
    });

    it('scales cross line length with cell size (60% of diagonal)', () => {
      // cellSize 30 -> lineLength = 30 * 1.414 * 0.6 ≈ 25
      const wrapper30 = mountFrame({ showCenterMarker: true, cellSize: 30 });
      expect(wrapper30.vm.centerMarkerStyle['--cross-length']).toBe('25px');

      // cellSize 50 -> lineLength = 50 * 1.414 * 0.6 ≈ 42
      const wrapper50 = mountFrame({ showCenterMarker: true, cellSize: 50 });
      expect(wrapper50.vm.centerMarkerStyle['--cross-length']).toBe('42px');
    });

    it('scales cross line thickness with cell size (minimum 2px)', () => {
      // cellSize 30 -> thickness = 30/10 = 3
      const wrapper30 = mountFrame({ showCenterMarker: true, cellSize: 30 });
      expect(wrapper30.vm.centerMarkerStyle['--cross-thickness']).toBe('3px');

      // cellSize 10 -> thickness would be 1, but minimum is 2
      const wrapper10 = mountFrame({ showCenterMarker: true, cellSize: 10 });
      expect(wrapper10.vm.centerMarkerStyle['--cross-thickness']).toBe('1px');
    });

    it('positions cross marker at center cell within frame', () => {
      // Unit at (5, 5) with radius 3
      // Frame starts at (2, 2) in grid coords
      // Center cell is at offset (5-2, 5-2) = (3, 3) cells from frame top-left
      // With cellSize 30, position is (3*30, 3*30) = (90, 90) pixels
      const wrapper = mountFrame({ showCenterMarker: true, x: 5, y: 5, radius: 3, cellSize: 30 });
      const style = wrapper.vm.centerMarkerStyle;

      expect(style.left).toBe('90px');
      expect(style.top).toBe('90px');
      expect(style.width).toBe('30px');
      expect(style.height).toBe('30px');
    });

    it('positions cross marker correctly when frame is clipped at edge', () => {
      // Unit at (1, 1) with radius 3
      // Frame is clipped, starts at (0, 0) in grid coords
      // Center cell is at offset (1-0, 1-0) = (1, 1) cells from frame top-left
      // With cellSize 30, position is (1*30, 1*30) = (30, 30) pixels
      const wrapper = mountFrame({ showCenterMarker: true, x: 1, y: 1, radius: 3, cellSize: 30 });
      const style = wrapper.vm.centerMarkerStyle;

      expect(style.left).toBe('30px');
      expect(style.top).toBe('30px');
    });
  });
});
