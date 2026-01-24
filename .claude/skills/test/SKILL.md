---
name: test
description: Run frontend tests and linting
---

Run the frontend test suite and linting:

1. Navigate to the frontend directory
2. Run Vitest tests
3. Run ESLint

```bash
cd frontend && npm run test && npm run lint
```

If tests pass, you'll see a success summary. If tests fail, review the error output.

## Common Issues

- **Test not found**: Ensure test files are in `tests/` and named `*.spec.js`
- **Lint errors**: Run `npm run lint -- --fix` to auto-fix some issues
- **Module not found**: Run `npm install` to install dependencies
