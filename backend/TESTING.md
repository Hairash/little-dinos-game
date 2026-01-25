# Testing and Linting Guide

This project uses **pytest** with **pytest-django** for testing, and **ruff**, **black**, and **mypy** for linting and type checking.

## Quick Start

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest game/tests/test_services_field.py

# Run specific test
pytest game/tests/test_services_field.py::TestGetSector::test_get_sector_center

# Run with coverage
pytest --cov=game --cov-report=html

# Run with verbose output
pytest -v
```

### Linting and Formatting

```bash
# Check code with ruff (linter)
ruff check .

# Auto-fix issues with ruff
ruff check --fix .

# Format code with black
black .

# Type check with mypy
mypy game/
```

## Test Structure

```
backend/
├── game/
│   ├── conftest.py          # Shared fixtures
│   ├── tests/
│   │   ├── test_services_*.py    # Pure function tests (no DB)
│   │   ├── test_models.py         # Model tests (needs DB)
│   │   ├── test_views.py          # API endpoint tests (needs DB)
│   │   └── test_visibility.py    # Visibility service tests
├── pyproject.toml            # Configuration for pytest, ruff, black, mypy
└── requirements.txt          # Includes pytest, ruff, black, mypy
```

## Test Patterns

### 1. Pure Function Tests (Services)

For functions that don't need database access, use simple function-based tests:

```python
# game/tests/test_services_field.py
def test_get_sector_center():
    """Test getting sector for center cell."""
    x, y = 10, 10
    width, height = 20, 20
    sectors_num = 4
    sector_x, sector_y = get_sector(x, y, width, height, sectors_num)
    assert sector_x == 2
    assert sector_y == 2
```

**No `@pytest.mark.django_db` needed** - these tests are fast and don't touch the database.

### 2. Model Tests

For Django models, use `@pytest.mark.django_db` and TestCase classes for organization:

```python
# game/tests/test_models.py
@pytest.mark.django_db
class TestGame:
    """Test Game model."""
    
    def test_create_game(self):
        """Can create a game."""
        game = Game.objects.create(
            game_code='test123',
            status='ready'
        )
        assert game.game_code == 'test123'
```

### 3. View/API Tests

For API endpoints, use `client` fixture and TestCase classes:

```python
# game/tests/test_views.py
@pytest.mark.django_db
class TestCreateGame:
    def test_create_game_success(self, api_client, auth_headers):
        """Authenticated user can create game."""
        response = api_client.post('/games/', **auth_headers)
        assert response.status_code == 200
```

## Fixtures

Shared fixtures are in `game/conftest.py`:

- `user` - Creates a test user
- `user2` - Creates a second test user
- `game` - Creates a test game with a player
- `small_field` - Creates a 5x5 test field
- `auth_token` - JWT token for test user
- `auth_headers` - Authorization headers
- `api_client` - Django test client

You can use these in any test:

```python
def test_something(user, game, small_field):
    # user, game, and small_field are automatically provided
    pass
```

## Linting Configuration

### Ruff

Ruff is configured in `pyproject.toml` to:
- Check for common Python errors (pycodestyle, pyflakes)
- Sort imports (isort)
- Suggest improvements (bugbear, comprehensions)
- Auto-fix many issues

### Black

Black is configured to:
- Format code with 100 character line length
- Target Python 3.11
- Exclude migrations and static files

### Mypy

Mypy is configured to:
- Type check Python code
- Work with Django (via django-stubs)
- Be lenient initially (can be tightened later)

## Pre-commit Hooks (Optional)

You can set up pre-commit hooks to run linters automatically:

```bash
# Install pre-commit
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << EOF
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.0
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/psf/black
    rev: 23.0.0
    hooks:
      - id: black
EOF

# Install hooks
pre-commit install
```

## Coverage Goals

Aim for:
- **80%+ coverage** on critical paths (game logic, validation)
- **100% coverage** on pure functions (easy to achieve)
- **70%+ coverage** on views/API endpoints

Run coverage report:
```bash
pytest --cov=game --cov-report=term-missing
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Tests and Linting

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: ruff check .
      - run: black --check .
      - run: mypy game/
      - run: pytest --cov=game
```

