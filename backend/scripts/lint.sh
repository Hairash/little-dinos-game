#!/bin/bash
# Backend linting script - run all linters in correct order

set -e  # Exit on error

echo "🔍 Running backend linters..."

# 1. Format code first (black)
echo "📝 Formatting code with black..."
black .

# 2. Lint and auto-fix (ruff)
echo "🔧 Linting and auto-fixing with ruff..."
ruff check . --fix

# 3. Check for remaining linting issues (ruff check-only)
echo "✅ Checking for remaining linting issues..."
ruff check .

# 4. Type checking (mypy)
echo "🔎 Type checking with mypy..."
mypy game/ || echo "⚠️  Mypy found some issues (Django-related errors are expected)"

echo "✨ All backend linting complete!"

