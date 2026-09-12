import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MapEditorListPage from '@/components/editor/MapEditorListPage.vue'
import SavedMapsPage from '@/components/game/SavedMapsPage.vue'
import ScenariosPage from '@/components/game/ScenariosPage.vue'
import emitter from '@/game/eventBus'
import { createNewScenario, buildScenarioFile, listEditorScenarios } from '@/game/mapEditorStorage'
import { saveMap } from '@/game/mapStorage'
import { SCENARIOS } from '@/game/scenarios'

function seedScenario(name) {
  const entry = createNewScenario({ width: 6, height: 6 })
  entry.map.name = name
  localStorage.setItem('mapEditor.scenarios.v1', JSON.stringify([entry]))
  return entry
}

function seedSavedMap(name) {
  // createNewScenario persists a scenario entry as a side effect —
  // snapshot and restore the scenarios bucket so this helper only
  // touches the savedMaps bucket.
  const scenariosBefore = localStorage.getItem('mapEditor.scenarios.v1')
  const entry = createNewScenario({ width: 7, height: 7 })
  if (scenariosBefore === null) localStorage.removeItem('mapEditor.scenarios.v1')
  else localStorage.setItem('mapEditor.scenarios.v1', scenariosBefore)
  const map = entry.map
  map.name = name
  map.metadata.savedAt = '2026-09-10T10:00:00.000Z'
  saveMap(map)
  return map
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('MapEditorListPage tabs', () => {
  function mountPage() {
    return mount(MapEditorListPage, { shallow: true })
  }

  it('scenarios tab lists user scenarios only (no built-ins)', () => {
    seedScenario('My Scenario')
    const vm = mountPage().vm
    expect(vm.entries).toHaveLength(1)
    expect(vm.entries[0].map.name).toBe('My Scenario')
    expect(vm.entries[0].source).toBe('scenario')
  })

  it('saved-maps tab lists the savedMaps bucket', async () => {
    seedScenario('My Scenario')
    seedSavedMap('My Saved Map')
    const vm = mountPage().vm
    vm.switchTab('savedMap')
    expect(vm.entries).toHaveLength(1)
    expect(vm.entries[0].id).toBe('My Saved Map')
    expect(vm.entries[0].source).toBe('savedMap')
  })

  it('Edit emits the entry id + source', async () => {
    seedSavedMap('My Saved Map')
    const vm = mountPage().vm
    const spy = vi.fn()
    emitter.on('openMapEditorCanvas', spy)
    vm.switchTab('savedMap')
    vm.selectedId = 'My Saved Map'
    vm.editMap()
    emitter.off('openMapEditorCanvas', spy)
    expect(spy).toHaveBeenCalledWith({ id: 'My Saved Map', source: 'savedMap' })
  })

  it('Test launches an SP game on the selected entry with scout mode forced', () => {
    const entry = seedScenario('My Scenario')
    const vm = mountPage().vm
    const spy = vi.fn()
    emitter.on('startGame', spy)
    vm.selectedId = entry.id
    vm.testMap()
    emitter.off('startGame', spy)
    expect(spy).toHaveBeenCalledTimes(1)
    const settings = spy.mock.calls[0][0]
    expect(settings.initialMap.name).toBe('My Scenario')
    expect(settings.enableScoutMode).toBe(true)
    expect(settings.loadGame).toBe(false)
  })

  it('masks the fog preview to the first human seat on both tabs', () => {
    const entry = seedScenario('My Scenario')
    seedSavedMap('My Saved Map')
    const vm = mountPage().vm
    // No selection → no masking seat.
    expect(vm.previewViewingPlayer).toBeNull()
    vm.selectedId = entry.id
    expect(vm.previewViewingPlayer).toBe(0)
    vm.switchTab('savedMap')
    vm.selectedId = 'My Saved Map'
    expect(vm.previewViewingPlayer).toBe(0)
  })

  it('migrates legacy built-in overrides into user scenarios on mount', () => {
    const { map } = createNewScenario({ width: 6, height: 6 })
    localStorage.clear()
    localStorage.setItem(
      'mapEditor.builtinOverrides.v1',
      JSON.stringify({
        ambush: { id: 'ambush', description: 'x', map: { ...map, name: 'Ambush' } },
      })
    )
    const vm = mountPage().vm
    expect(vm.entries).toHaveLength(1)
    expect(vm.entries[0].map.name).toBe('Ambush (edited)')
    // Legacy bucket untouched.
    expect(localStorage.getItem('mapEditor.builtinOverrides.v1')).toContain('ambush')
  })
})

describe('SavedMapsPage pick-mode tabs (lobby picker)', () => {
  function mountPicker() {
    return mount(SavedMapsPage, {
      props: { mode: 'pick' },
      shallow: true,
    })
  }

  it('lists local saved maps by default and custom scenarios on the second tab', async () => {
    seedScenario('Custom One')
    seedSavedMap('Saved One')
    const wrapper = mountPicker()
    await flushPromises()
    expect(wrapper.vm.maps.map(m => m.name)).toEqual(['Saved One'])
    await wrapper.vm.switchPickTab('scenarios')
    expect(wrapper.vm.maps.map(m => m.name)).toEqual(['Custom One'])
  })

  it('emits the picked scenario map to the lobby', async () => {
    seedScenario('Custom One')
    seedSavedMap('Saved One')
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.vm.switchPickTab('scenarios')
    wrapper.vm.selectedName = 'Custom One'
    wrapper.vm.handleStart()
    const emitted = wrapper.emitted('mapPicked')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0].name).toBe('Custom One')
  })

  it('empty saved-maps bucket auto-switches to scenarios instead of bouncing', async () => {
    seedScenario('Custom One')
    const goToPage = vi.fn()
    emitter.on('goToPage', goToPage)
    const wrapper = mountPicker()
    await flushPromises()
    emitter.off('goToPage', goToPage)
    expect(goToPage).not.toHaveBeenCalled()
    expect(wrapper.vm.pickTab).toBe('scenarios')
    expect(wrapper.vm.maps.map(m => m.name)).toEqual(['Custom One'])
  })

  it('masks the fog preview to the first human seat', async () => {
    seedSavedMap('Saved One')
    const wrapper = mountPicker()
    await flushPromises()
    expect(wrapper.vm.previewViewingPlayer).toBe(0)
  })

  describe('import from file', () => {
    function fakeFileEvent(content) {
      return { target: { files: [{ text: async () => content }] } }
    }

    it('offers Import only on the custom-scenarios tab', async () => {
      seedSavedMap('Saved One')
      const wrapper = mountPicker()
      await flushPromises()
      expect(wrapper.vm.showImport).toBe(false)
      await wrapper.vm.switchPickTab('scenarios')
      expect(wrapper.vm.showImport).toBe(true)
    })

    it('never offers Import in single-player launch mode', async () => {
      seedSavedMap('Saved One')
      const wrapper = mount(SavedMapsPage, { props: { mode: 'launch' }, shallow: true })
      await flushPromises()
      expect(wrapper.vm.showImport).toBe(false)
    })

    it('imports into the shared scenarios bucket and selects the new map', async () => {
      const entry = createNewScenario({ width: 6, height: 6 })
      entry.map.name = 'Shared Map'
      const file = JSON.stringify(buildScenarioFile(entry))
      localStorage.clear()

      const wrapper = mountPicker()
      await flushPromises()
      await wrapper.vm.switchPickTab('scenarios')
      await wrapper.vm.onImportFile(fakeFileEvent(file))

      expect(wrapper.vm.importError).toBe('')
      expect(wrapper.vm.maps.map(m => m.name)).toContain('Shared Map')
      expect(wrapper.vm.selectedName).toBe('Shared Map')
      // Same bucket the editor and the single-player page read, so it's
      // available everywhere afterwards.
      expect(listEditorScenarios().map(e => e.map.name)).toContain('Shared Map')
    })

    it('surfaces a readable error for a bad file', async () => {
      const wrapper = mountPicker()
      await flushPromises()
      await wrapper.vm.switchPickTab('scenarios')
      await wrapper.vm.onImportFile(fakeFileEvent('not json at all'))
      expect(wrapper.vm.importError).toMatch(/Import failed/)
    })
  })

  it('forces enableScoutMode in launch settings', () => {
    const map = seedSavedMap('Saved One')
    const vm = mountPicker().vm
    const settings = vm.mapToStartSettings(map)
    expect(settings.enableScoutMode).toBe(true)
    expect(settings.initialMap).toBe(map)
  })
})

describe('ScenariosPage default badge', () => {
  it('flags shipped scenarios as built-in and user ones as not', () => {
    seedScenario('My Scenario')
    const vm = mount(ScenariosPage, { shallow: true }).vm
    const builtins = vm.scenarios.filter(s => s.isBuiltin)
    const users = vm.scenarios.filter(s => !s.isBuiltin)
    // Count comes from the folder — adding a scenario file is a content
    // change and must not break the suite.
    expect(builtins.length).toBe(SCENARIOS.length)
    expect(users.map(s => s.map.name)).toEqual(['My Scenario'])
  })

  it('renders a DEFAULT badge only on shipped entries', () => {
    seedScenario('My Scenario')
    const wrapper = mount(ScenariosPage)
    const badges = wrapper.findAll('.scenarios-list-badge')
    expect(badges).toHaveLength(SCENARIOS.length)
    expect(badges[0].text().toLowerCase()).toBe('default')
  })
})

describe('ScenariosPage import from file', () => {
  function fakeFileEvent(content) {
    return { target: { files: [{ text: async () => content }] } }
  }

  it('imports a scenario file, refreshes the list, and selects it', async () => {
    const entry = createNewScenario({ width: 6, height: 6 })
    entry.map.name = 'Shared Map'
    const file = JSON.stringify(buildScenarioFile(entry))
    localStorage.clear()

    const vm = mount(ScenariosPage, { shallow: true }).vm
    const before = vm.scenarios.length
    await vm.onImportFile(fakeFileEvent(file))
    expect(vm.importError).toBe('')
    expect(vm.scenarios.length).toBe(before + 1)
    const imported = vm.scenarios.find(s => s.map.name === 'Shared Map')
    expect(imported).toBeTruthy()
    expect(vm.selectedId).toBe(imported.id)
  })

  it('surfaces a readable error for a bad file', async () => {
    const vm = mount(ScenariosPage, { shallow: true }).vm
    const before = vm.scenarios.length
    await vm.onImportFile(fakeFileEvent('not json at all'))
    expect(vm.importError).toMatch(/Import failed/)
    expect(vm.scenarios.length).toBe(before)
  })
})
