#!/bin/bash
# Frontend linting script - run all linters in correct order

set -e  # Exit on error

echo "🔍 Running frontend linters..."

# 1. Format code first (prettier)
echo "📝 Formatting code with prettier..."
npm run format

# 2. Lint and auto-fix (eslint)
echo "🔧 Linting and auto-fixing with eslint..."
npm run lint:fix

# 3. Check for remaining linting issues (eslint check-only)
echo "✅ Checking for remaining linting issues..."
npm run lint

echo "✨ All frontend linting complete!"

