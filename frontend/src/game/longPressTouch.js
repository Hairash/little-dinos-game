// Global long-press → synthetic `contextmenu` event dispatcher.
//
// iOS Safari / iOS Chrome do not fire `contextmenu` from a long press
// on regular DOM elements (only on links and images with default
// handling). Without this shim every right-click hint and right-click
// menu in the app — game cells, gear-menu buttons, editor tool
// buttons, colour squares, etc. — silently does nothing on iOS.
//
// Rather than patch every `@contextmenu` consumer with a local touch
// handler, register ONE pair of document-level listeners that:
//
//   1. Start a 500 ms timer on every single-finger `touchstart`.
//   2. Cancel it if the finger moves more than ~10 px (the user is
//      scrolling or starting a drag) or if `touchend` fires first
//      (it was a tap — let the natural mouse simulation through).
//   3. On timer fire, dispatch a synthesised `contextmenu` event on
//      the touched element. The event bubbles, so any ancestor's
//      `@contextmenu` handler picks it up just like a real one.
//   4. Suppress the synthetic `mousedown` / `mouseup` / `click` iOS
//      dispatches after the touch ends. Without that, the menu or
//      hint we just opened gets immediately dismissed (or worse,
//      a paint click fires under the open menu).
//
// All listeners are passive (touch) or capture-phase (mouse) so
// nothing in the app needs to know this exists.

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD_PX = 10
// After firing, suppress synthetic mouse events for a generous window
// in case the platform delays them. Cleared early on the first `click`
// (last event in the synthetic sequence).
const MOUSE_SUPPRESS_MS = 1500

let pressTimer = null
let pressStart = null
let suppressNextMouse = false
let suppressClearTimer = null
let installed = false

function clearTimer() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  pressStart = null
}

function onTouchStart(e) {
  // Multi-touch is a pinch/zoom etc. — never a long-press.
  if (e.touches.length !== 1) {
    clearTimer()
    return
  }
  const t = e.touches[0]
  pressStart = {
    target: e.target,
    clientX: t.clientX,
    clientY: t.clientY,
  }
  pressTimer = setTimeout(fireLongPress, LONG_PRESS_MS)
}

function onTouchMove(e) {
  if (!pressTimer || !pressStart) return
  if (e.touches.length !== 1) {
    clearTimer()
    return
  }
  const t = e.touches[0]
  const dx = t.clientX - pressStart.clientX
  const dy = t.clientY - pressStart.clientY
  if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) clearTimer()
}

function onTouchEnd() {
  // A short tap (timer didn't fire yet) should still produce its
  // natural synthetic click — just cancel the timer.
  clearTimer()
}

function fireLongPress() {
  pressTimer = null
  if (!pressStart) return
  const { target, clientX, clientY } = pressStart
  pressStart = null

  // Synthesise a contextmenu event that mirrors what a real
  // right-click would produce. `bubbles: true` lets ancestor
  // listeners catch it; `button: 2` matches the right-mouse-button
  // convention. Any `@contextmenu.prevent` in the handler still
  // works because the event is `cancelable`.
  const ctxEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 2,
  })
  target.dispatchEvent(ctxEvent)

  // Block the synthetic mouse sequence that follows. Without this:
  //   • a menu we just opened would be dismissed by the click hitting
  //     outside-click handlers,
  //   • a `mousedown`-bound action (e.g. the editor's paint brush)
  //     would fire under the open menu.
  suppressNextMouse = true
  if (suppressClearTimer) clearTimeout(suppressClearTimer)
  suppressClearTimer = setTimeout(() => {
    suppressNextMouse = false
    suppressClearTimer = null
  }, MOUSE_SUPPRESS_MS)
}

function onMouseEvent(e) {
  if (!suppressNextMouse) return
  // Capture-phase listener at `document` fires before any Vue handler
  // on the target — stopping propagation here prevents the inner
  // handlers from ever seeing the event.
  e.preventDefault()
  e.stopPropagation()
  // `click` is the last event in the synthetic mousedown→mouseup→
  // click sequence. Clear the flag on it so the very next legitimate
  // tap isn't accidentally blocked.
  if (e.type === 'click') {
    suppressNextMouse = false
    if (suppressClearTimer) {
      clearTimeout(suppressClearTimer)
      suppressClearTimer = null
    }
  }
}

export function installLongPress() {
  if (installed) return
  installed = true
  // Touch listeners are passive — we never call preventDefault here.
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  document.addEventListener('touchcancel', onTouchEnd, { passive: true })
  // Mouse listeners run in capture phase so we can `stopPropagation`
  // before Vue's per-element listeners see the synthetic events.
  document.addEventListener('mousedown', onMouseEvent, { capture: true })
  document.addEventListener('mouseup', onMouseEvent, { capture: true })
  document.addEventListener('click', onMouseEvent, { capture: true })
}
