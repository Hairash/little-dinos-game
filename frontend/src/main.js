import { createApp } from 'vue'
import App from './App.vue'
import { installLongPress } from '@/game/longPressTouch'

// Globally bridge iOS touch long-presses to synthetic `contextmenu`
// events — iOS Safari/Chrome don't fire `contextmenu` from long-press
// on regular elements, which would otherwise silently break every
// right-click hint and right-click menu on mobile.
installLongPress()

createApp(App).mount('#app')
