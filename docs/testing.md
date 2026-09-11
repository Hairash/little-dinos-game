# Frontend Testing

How the Vue/Vite frontend is tested, how to run the suite correctly, the
conventions to follow, and the non-obvious gotchas that will otherwise cost you
an afternoon.

## Stack

- **[Vitest](https://vitest.dev/)** as the runner, **happy-dom** as the DOM
  environment, **@vue/test-utils** for mounting components.
- Config: `frontend/vitest.config.js` — `environment: 'happy-dom'`,
  `globals: true`, `setupFiles: ['./tests/setupTests.js']`,
  `include: ['tests/**/*.spec.js']`, and the `@` → `frontend/src` path alias.
- Coverage: v8 provider, **70%** thresholds on lines/functions/branches/statements
  (`npm run test:coverage`).

## Running

```bash
cd frontend            # ← required, see the gotcha below
npm run test           # watch mode (vitest)
npx vitest run         # one-shot (what CI / a quick check wants)
npx vitest run tests/editor/            # a subset (dir or file)
npm run test:coverage  # with coverage report + threshold gate
```

### ⚠️ Run from `frontend/`, never the repo root

The `@` alias is defined in `frontend/vitest.config.js`. If you invoke vitest
from the **repo root**, that config isn't picked up and **every `@/…` import
fails** with `Cannot find package '@/game/...'` — the whole suite goes red for a
reason unrelated to your change (symptom: ~16/17 files failing at import time).
The fix is simply `cd frontend` first. (This bit us during development; it looks
like a catastrophic regression but it's just the wrong working directory.)

## Global test environment (`tests/setupTests.js`)

- **`localStorage` is mocked** (in-memory) and **cleared in a global
  `beforeEach`** — every test starts with empty storage.
- `WebSocket` and `fetch` are mocked too.
- `vi.clearAllMocks()` runs before each test.
- Reusable factories are exported: `createTestUnit`, `createTestBuilding`,
  `createTestCell`, `createTestPlayer`, `createTestField`.

## Conventions

- Tests live under `frontend/tests/`, loosely mirroring `src/`. Editor / scenario
  suites are grouped under `tests/editor/`.
- **Pure logic** (helpers, storage, engines) — import the function and assert.
- **Vue components** — mount with `@vue/test-utils`, usually
  `mount(Component, { props, shallow: true })`, then drive methods and read
  reactive state directly via `wrapper.vm`. Call `wrapper.unmount()` in an
  `afterEach` for components that register `window`/`document` listeners (the map
  editor does: mouseup, click, keydown).

## Gotchas learned the hard way

1. **Factories that persist have side effects — don't call them per-test.**
   `createNewScenario()` (in `mapEditorStorage.js`) _writes the new scenario to
   `localStorage`_. If you wrap it in a per-test `freshMap()` helper, every call
   adds a scenario and quietly breaks count assertions (e.g. "expected 1 user
   scenario, got 3"). Instead capture a template **once at module load** and
   clone it; the `setupTests` `beforeEach` clear keeps each test's buckets clean:

   ```js
   const clone = (o) => JSON.parse(JSON.stringify(o));
   const TEMPLATE_MAP = clone(createNewScenario({ width: 6, height: 6 }).map);
   const freshMap = () => clone(TEMPLATE_MAP);
   ```

2. **Editor component logic is unit-testable without DOM events.** Seed a
   scenario with `createNewScenario`, mount `MapEditorCanvasPage` with its id as
   the `scenarioId` prop, then call methods on `wrapper.vm` directly —
   `applyTool`, `performMove`, `undo`, `handleKeydown(fakeEvent)`, etc. A
   keydown "event" only needs the fields the handler reads, e.g.
   `{ key: 'b', target: { tagName: 'DIV' }, preventDefault() {} }`.

3. **`Date.now()` / `new Date()` work** under happy-dom (real timers), so id /
   default-name generation in `createNewScenario` behaves normally in tests.

## Where the map-editor / scenario tests are

See the **Tests** section of [`scenarios.md`](./scenarios.md) for the current
editor/scenario coverage map (`tests/editor/mapEditorStorage.spec.js`,
`tests/editor/mapEditorCanvas.spec.js`, `tests/editor/mapPreview.fog.spec.js`,
and the speed-0 visibility checks in `tests/game/helpers.spec.js`).
