# Frontend Testing and Linting Guide

This project uses **Vitest** for testing, **ESLint** for linting, and **Prettier** for code formatting.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm test -- --watch
```

### Linting and Formatting

```bash
# Check code with ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changing files
npm run format:check
```

## Test Structure

```
frontend/
├── tests/
│   ├── setupTests.js          # Global test setup and mocks
│   ├── DinoGame/              # Component tests
│   └── game/                  # Game logic tests
├── vitest.config.js           # Vitest configuration
└── package.json               # Scripts and dependencies
```

## Test Patterns

### Component Tests

```javascript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'

describe('DinoGame', () => {
  it('renders correctly', () => {
    const wrapper = mount(DinoGame, {
      props: {
        width: 20,
        height: 20,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
```

### Game Logic Tests

```javascript
import { describe, it, expect } from 'vitest'
import { calculateVisibility } from '@/game/helpers'

describe('calculateVisibility', () => {
  it('calculates visible cells correctly', () => {
    const field = createTestField(10, 10)
    const visible = calculateVisibility(field, 0, 3)
    expect(visible.size).toBeGreaterThan(0)
  })
})
```

## Test Utilities

The `tests/setupTests.js` file provides:

- **Mocks**: localStorage, WebSocket, fetch
- **Test Factories**: 
  - `createTestUnit()` - Create test unit objects
  - `createTestBuilding()` - Create test building objects
  - `createTestCell()` - Create test cell objects
  - `createTestField()` - Create test field arrays

Example:

```javascript
import { createTestField, createTestUnit } from '@/tests/setupTests'

const field = createTestField(10, 10)
field[5][5].unit = createTestUnit({ player: 0, movePoints: 3 })
```

## Coverage

Coverage is configured with thresholds:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

Run coverage report:
```bash
npm run test:coverage
```

This generates:
- Terminal output with coverage summary
- `coverage/` directory with HTML report

## ESLint Configuration

ESLint is configured with:
- **Vue 3 Strongly Recommended** rules (stricter than essential)
- **Modern JavaScript** (ES2022)
- **Custom rules** for better code quality

Key rules:
- Warns about `console.log` (allows `console.warn` and `console.error`)
- Warns about `v-html` usage (security concern)
- Requires explicit emits in Vue components
- Allows unused variables prefixed with `_`

## Prettier Configuration

Prettier is configured with:
- **Single quotes** for strings
- **No semicolons**
- **2 spaces** for indentation
- **100 character** line length
- **ES5 trailing commas**

## Editor Integration

### VS Code

Install extensions:
- ESLint
- Prettier
- Vitest

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[vue]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Pre-commit Hooks (Optional)

You can set up pre-commit hooks to run linters automatically:

```bash
# Install husky
npm install --save-dev husky lint-staged

# Initialize husky
npx husky init

# Add pre-commit hook
cat > .husky/pre-commit << EOF
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
EOF

# Add lint-staged config to package.json
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,vue}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Frontend Tests and Linting

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test:coverage
```

## What Changed

### Upgrades
- ✅ ESLint: v7 → v8 (latest stable)
- ✅ eslint-plugin-vue: v8 → v9 (latest)
- ✅ Added Prettier for code formatting
- ✅ Added test coverage reporting

### New Features
- ✅ Test coverage with thresholds
- ✅ Prettier formatting
- ✅ Better ESLint rules (vue3-strongly-recommended)
- ✅ Test-specific ESLint rules
- ✅ Format scripts in package.json

### Removed
- ✅ Removed deprecated `.jshintrc` file

## Next Steps

1. Run `npm install` to install new dependencies
2. Run `npm run format` to format existing code
3. Run `npm run lint:fix` to fix linting issues
4. Run `npm run test:coverage` to see current test coverage
5. Gradually increase coverage thresholds as you add more tests

