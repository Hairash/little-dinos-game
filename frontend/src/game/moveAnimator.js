// Async unit-move animator. Walks a unit cell-by-cell along a pre-computed
// path, mutating the field in place. Pure (DOM-free) so it stays unit-testable
// and can be reused in single-player and multiplayer flows.
//
// The structure deliberately separates the "walk" (this module) from the
// gameplay side-effects (capture, kill, visibility recompute, undo diff) so
// that swapping the renderer for smoother interpolation or walk-cycle frames
// later does not touch the call-sites.

import { MOVE_ANIMATION_DELAY } from '@/game/const'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Step a unit cell-by-cell along `path`. Mutates `field` in place.
 *
 * @param {Array}                    field   - 2D field; cells have a `unit` slot
 * @param {Array<[number, number]>}  path    - includes source as path[0] and dest as path[last]
 * @param {Object}                   unit    - the unit being moved (already at field[path[0]])
 * @param {Object}                  [opts]
 * @param {number}                  [opts.delay]       - ms between visible steps (default MOVE_ANIMATION_DELAY)
 * @param {(coord: [number, number]) => boolean} [opts.isVisible] - if false for both endpoints of a step, the sleep is skipped
 * @param {() => boolean}           [opts.isCancelled] - abort gate (unmount, end-of-game)
 * @returns {Promise<void>}
 */
export async function animateMovePath(field, path, unit, opts = {}) {
  if (!path || path.length < 2) return
  const delay = opts.delay ?? MOVE_ANIMATION_DELAY
  const isVisible = opts.isVisible ?? (() => true)
  const isCancelled = opts.isCancelled ?? (() => false)

  for (let i = 1; i < path.length; i++) {
    if (isCancelled()) return
    const [px, py] = path[i - 1]
    const [nx, ny] = path[i]
    if (field[nx] && field[nx][ny]) field[nx][ny].unit = unit
    if (field[px] && field[px][py]) field[px][py].unit = null
    // Only burn real time on steps that the local player can actually see.
    // Invisible steps still update the field so post-walk state is correct.
    if (isVisible(path[i]) || isVisible(path[i - 1])) {
      await sleep(delay)
    }
  }
}
