---
name: troubleshoot
description: Diagnostic commands for common issues
---

Diagnostic commands for troubleshooting common issues.

## Check Service Status

### Backend Running?
```bash
curl http://localhost:8008/auth/whoami/
# Should return: {"auth": false}
```

### Frontend Running?
```bash
curl http://localhost:5173/
# Should return HTML
```

### Port Usage
```bash
lsof -i :8008  # Backend port
lsof -i :5173  # Frontend port
```

## Database Diagnostics

```bash
cd backend
source venv/bin/activate

# Check migrations status
python manage.py showmigrations

# Check if tables exist
python manage.py shell -c "from game.models import Game; print(f'Games: {Game.objects.count()}')"
```

## WebSocket Diagnostics

Open browser DevTools > Network > Filter "WS" to inspect WebSocket connections.

Test WebSocket from command line:
```bash
# Requires websocat: brew install websocat
websocat ws://localhost:8008/ws/lobby/test/
```

## Clear Local State

### Browser (localStorage)
```javascript
// In browser console
localStorage.clear();
```

### Database (SQLite)
```bash
cd backend
rm db.sqlite3
python manage.py migrate
```

## Logs

### Backend Logs
Enable debug logging by setting `DEBUG_WEBSOCKET = True` in `consumers.py`

### Frontend Logs
Enable debug logging by setting `const DEBUG_MULTIPLAYER = true` in `MultiplayerDinoGame.vue`

## Common Fixes

1. **CORS errors**: Check `CORS_ALLOWED_ORIGINS` in backend settings
2. **401 errors**: Token expired - sign out and back in
3. **WebSocket fails**: Ensure using Daphne, not Django runserver
4. **Blank screen**: Clear localStorage and refresh
