# Linting Guide

This document explains how to run all linters in the correct order.

## Why Order Matters

1. **Formatters first** - They change code structure, which can affect linting
2. **Linters with auto-fix** - Fix issues automatically
3. **Linters check-only** - Verify no remaining issues
4. **Type checkers last** - Final verification (slowest)

## Backend (Python)

### Quick Commands (in order):

```bash
cd backend

# 1. Format code (black)
black .

# 2. Lint and auto-fix (ruff)
ruff check . --fix

# 3. Check for remaining issues (ruff)
ruff check .

# 4. Type check (mypy)
mypy game/
```

### Using the Script:

```bash
cd backend
chmod +x scripts/lint.sh
./scripts/lint.sh
```

### Individual Commands:

```bash
# Format only
black .

# Lint only (no fixes)
ruff check .

# Lint and fix
ruff check . --fix

# Type check only
mypy game/
```

## Frontend (JavaScript/Vue)

### Quick Commands (in order):

```bash
cd frontend

# 1. Format code (prettier)
npm run format

# 2. Lint and auto-fix (eslint)
npm run lint:fix

# 3. Check for remaining issues (eslint)
npm run lint
```

### Using the Script:

```bash
cd frontend
chmod +x scripts/lint.sh
./scripts/lint.sh
```

### Individual Commands:

```bash
# Format only
npm run format

# Check formatting (no changes)
npm run format:check

# Lint only (no fixes)
npm run lint

# Lint and fix
npm run lint:fix
```

## Full Project Linting

To lint both backend and frontend:

```bash
# Backend
cd backend && black . && ruff check . --fix && ruff check . && mypy game/

# Frontend
cd frontend && npm run format && npm run lint:fix && npm run lint
```

Or use the scripts:

```bash
./backend/scripts/lint.sh
./frontend/scripts/lint.sh
```

## Pre-commit Workflow

Before committing, run:

```bash
# Backend
cd backend
black .
ruff check . --fix
mypy game/  # Optional - can be slow

# Frontend
cd frontend
npm run format
npm run lint:fix
```

## CI/CD Integration

In CI, use check-only commands (don't modify code):

```bash
# Backend
black --check .
ruff check .
mypy game/

# Frontend
npm run format:check
npm run lint
```

## Common Issues

### Black and Ruff Conflicts

Black formats code, ruff lints it. They're configured to work together:
- Ruff ignores line length (E501) - handled by black
- Ruff's isort is compatible with black

### Prettier and ESLint Conflicts

Prettier formats, ESLint lints. They're configured to work together:
- `eslint-config-prettier` disables conflicting ESLint rules
- Prettier runs first, then ESLint

### Mypy Django Errors

Django-related mypy errors are expected and ignored in:
- `game.models`
- `game.views`
- `game.consumers`
- `server.auth`

These use Django's dynamic attributes that are runtime-safe but hard to type-check.

## Recommended Workflow

1. **During development**: Run formatters and auto-fix linters frequently
   ```bash
   black . && ruff check . --fix  # Backend
   npm run format && npm run lint:fix  # Frontend
   ```

2. **Before committing**: Run full linting suite
   ```bash
   ./backend/scripts/lint.sh
   ./frontend/scripts/lint.sh
   ```

3. **In CI**: Use check-only commands to fail builds on issues
   ```bash
   black --check . && ruff check . && mypy game/  # Backend
   npm run format:check && npm run lint  # Frontend
   ```

