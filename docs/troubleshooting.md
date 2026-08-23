# Troubleshooting Guide

## Common Issues

### Backend Issues

#### "Port 8008 already in use"

```bash
# Find process using port
lsof -i :8008

# Kill the process
kill -9 <PID>

# Or use a different port
daphne -b 0.0.0.0 -p 8009 server.asgi:application
```

#### "ModuleNotFoundError: No module named '...'"

Virtual environment not activated:
```bash
cd backend
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

Or dependencies not installed:
```bash
pip install -r requirements.txt
```

#### "OperationalError: no such table"

Migrations not run:
```bash
python manage.py migrate
```

#### WebSocket Connection Refused

1. Ensure backend is running with Daphne (not Django's runserver):
   ```bash
   daphne -b 0.0.0.0 -p 8008 server.asgi:application
   ```

2. Check CORS settings if connecting from different origin

3. Verify no firewall blocking WebSocket connections

### Frontend Issues

#### "CORS error" or "Network error"

1. Ensure backend is running on expected port (8008)

2. Check `VITE_API_BASE` in frontend config

3. Verify CORS_ALLOWED_ORIGINS in backend settings:
   ```python
   # In settings.py, for local dev
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:5173",
       "http://127.0.0.1:5173",
   ]
   ```

#### "401 Unauthorized" on API calls

1. Check if auth token exists:
   ```javascript
   console.log(localStorage.getItem('auth_token'));
   ```

2. Token might be expired - sign out and sign in again

3. Verify token is being sent:
   - Open browser DevTools > Network tab
   - Check request headers for `Authorization: Bearer ...`

#### "Cannot read property of undefined" on game load

1. Check if localStorage has corrupted data:
   ```javascript
   localStorage.removeItem('field');
   localStorage.removeItem('players');
   ```

2. Refresh the page

#### White Screen / App Won't Load

1. Check browser console for errors (F12)

2. Clear browser cache and localStorage:
   ```javascript
   localStorage.clear();
   ```

3. Rebuild frontend:
   ```bash
   cd frontend
   npm run build
   ```

### Game Issues

#### "Not my turn" but it should be

1. Refresh the page to resync game state

2. Check WebSocket connection in browser console

3. Other player might still be connected - check for disconnection messages

#### Units not moving / Actions not working

1. Check if it's your turn (turn indicator in UI)

2. Verify unit has move points remaining

3. Check WebSocket connection:
   ```javascript
   // In browser console
   console.log('WS connected:', gameWebSocket.isConnected);
   ```

#### Game field looks wrong / Missing cells

1. The field might be fog-of-war filtered

2. Your units reveal areas around them

3. Use Obelisks to scout hidden areas

### Authentication Issues

#### Can't sign in / "Invalid credentials"

1. Verify username and password are correct

2. Check if user exists:
   ```bash
   cd backend
   python manage.py shell
   >>> from django.contrib.auth.models import User
   >>> User.objects.filter(username='youruser').exists()
   ```

3. Reset password if needed:
   ```bash
   python manage.py changepassword <username>
   ```

#### Token not persisting (iOS Safari)

This is a known issue with Safari's ITP (Intelligent Tracking Prevention):

1. Ensure cookies are not blocked in Safari settings

2. The app uses JWT tokens in localStorage (not cookies) to avoid this

3. If still failing, check if localStorage is disabled

### Database Issues

#### "Database is locked" (SQLite)

This happens with concurrent access:

1. Stop all Django processes

2. Wait a moment

3. Restart the server

For development with multiple processes, consider using PostgreSQL.

#### Migration conflicts

1. Check for conflicting migrations:
   ```bash
   python manage.py showmigrations
   ```

2. If needed, reset migrations (CAUTION: data loss):
   ```bash
   rm db.sqlite3
   rm game/migrations/0*.py
   python manage.py makemigrations
   python manage.py migrate
   ```

## Debugging Tips

### Enable Debug Logging

See [Development Setup](./development-setup.md#debug-logging) for enabling debug logs.

### Check WebSocket Messages

In browser DevTools:
1. Go to Network tab
2. Filter by "WS"
3. Click on the WebSocket connection
4. View Messages tab for sent/received data

### Check Backend Logs

```bash
# If using Daphne directly
# Logs appear in terminal

# If deployed to Fly.io
fly logs -a your-app-name
```

### Inspect Game State

In browser console:
```javascript
// Get Vue component instance
const vm = document.querySelector('#app').__vue_app__._container._vnode.component.proxy;

// Check game state
console.log(vm.field);
console.log(vm.players);
console.log(vm.currentPlayer);
```

## Getting Help

If you're still stuck:

1. Check existing GitHub issues
2. Search for error messages
3. Create a new issue with:
   - Steps to reproduce
   - Error messages / screenshots
   - Browser and OS versions
   - Backend logs (if applicable)
