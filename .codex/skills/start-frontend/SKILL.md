---
name: start-frontend
description: Start the Vue.js frontend dev server on port 5173
---

Start the Vue.js frontend development server:

## Quick Start

```bash
cd frontend && npm run dev
```

The frontend will be available at http://localhost:5173

## Pre-flight Checks

Before starting, verify:

1. **Node modules installed**:
   ```bash
   ls frontend/node_modules/.package-lock.json
   ```
   If not found, run: `cd frontend && npm install`

2. **Port available**:
   ```bash
   lsof -i :5173
   ```
   If in use, Vite will auto-select another port (watch the output)

3. **Backend running** (for full functionality):
   ```bash
   curl http://localhost:8008/auth/whoami/
   ```
   Should return `{"auth": false}`

## Troubleshooting

- **"Module not found"**: Run `npm install` to install dependencies
- **"EACCES permission denied"**: Try `sudo npm install` or fix npm permissions
- **"CORS error" in browser**: Ensure backend is running on port 8008
- **Blank page**: Check browser console for errors, try clearing localStorage

## Development Tips

- Hot reload is enabled - changes auto-refresh
- Press `o` in terminal to open browser
- Press `q` to quit the server
