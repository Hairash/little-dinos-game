# Security Guidelines

## Authentication

### JWT Token Authentication

The game uses JWT (JSON Web Tokens) for authentication:

- **Token Storage**: Stored in `localStorage` on the client
- **Token Expiration**: 365 days (intentional trade-off for UX - avoids frequent re-logins)
- **Token Transmission**: Via `Authorization: Bearer <token>` header

**Security Implications:**
- Long-lived tokens improve UX but increase risk if token is compromised
- Users should sign out on shared devices
- No server-side session revocation (stateless JWT)

### CSRF Protection

CSRF protection is exempt on most endpoints because:

1. **JWT Authentication**: Tokens are sent via `Authorization` header, not cookies
2. **CSRF attacks exploit cookie-based auth**: JWT headers are not automatically attached by browsers
3. **Auth endpoints**: Sign in/up create tokens, no existing session to protect

**Note**: If you add cookie-based features, re-evaluate CSRF protection.

## Authorization

### Game Access Control

- **get_game**: Only game participants can view game data
- **start_game**: Only the game creator (player with order=0) can start
- **Moves**: Server validates player's turn before accepting moves
- **Field visibility**: Each player only sees their fog-of-war filtered view

### WebSocket Authentication

1. Client connects and receives `auth_required`
2. Client sends JWT token
3. Server validates and associates connection with user
4. Unauthenticated connections cannot receive game state

## Input Validation

### Client-Side

- **localStorage parsing**: Wrapped in try-catch with fallback
- **WebSocket messages**: Type and structure validated before processing
- **No v-html with user data**: All dynamic content uses text interpolation

### Server-Side

- **Move validation**: All game moves validated against game state
- **User input**: Django's built-in validators for passwords
- **JSON parsing**: Handled with error catching

## Production Configuration

### Required Environment Variables

```bash
# Generate secure secrets
DJANGO_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(50))")
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(50))")

# Restrict allowed hosts
ALLOWED_HOSTS="api.yourdomain.com"

# Set exact frontend origins
CORS_ALLOWED_ORIGINS="https://yourdomain.com"
CSRF_TRUSTED_ORIGINS="https://yourdomain.com"
```

### Cookie Security (Production)

Settings in `settings.py` automatically adjust for production:

```python
CSRF_COOKIE_SECURE = not DEBUG      # True in production
CSRF_COOKIE_SAMESITE = "None"       # Required for cross-origin
SESSION_COOKIE_SECURE = not DEBUG   # True in production
SESSION_COOKIE_SAMESITE = "None"    # Required for cross-origin
```

## Common Vulnerabilities & Mitigations

### XSS (Cross-Site Scripting)

**Mitigations implemented:**
- No `v-html` with user-controlled content
- All dynamic content uses Vue's text interpolation (`{{ }}`)
- Context help components use structured data, not HTML strings

### SQL Injection

**Mitigations implemented:**
- Django ORM used exclusively (no raw SQL)
- Parameterized queries via ORM

### Insecure Direct Object References

**Mitigations implemented:**
- Game access requires player membership check
- User can only see their own filtered game field

### Information Disclosure

**Mitigations implemented:**
- Fog of war filtering applied server-side
- Players cannot see hidden areas of the map
- Debug logging disabled by default (`DEBUG_WEBSOCKET = False`)

## Debug Logging

Debug logging is controlled by flags:

**Backend (`consumers.py`, `views.py`):**
```python
DEBUG_WEBSOCKET = False  # Set to True for development
DEBUG_VIEWS = False
```

**Frontend (`MultiplayerDinoGame.vue`):**
```javascript
const DEBUG_MULTIPLAYER = false;  // Set to true for development
```

**Important**: Keep debug logging disabled in production to avoid information leakage.

## Security Checklist

### Before Deployment

- [ ] Generate new `DJANGO_SECRET_KEY`
- [ ] Generate new `JWT_SECRET_KEY`
- [ ] Set `ALLOWED_HOSTS` to specific domains
- [ ] Set `CORS_ALLOWED_ORIGINS` to frontend URL only
- [ ] Verify `DEBUG=False`
- [ ] Verify debug logging flags are `False`
- [ ] Enable HTTPS

### Regular Maintenance

- [ ] Review and update dependencies (`pip-audit`, `npm audit`)
- [ ] Monitor for unusual access patterns
- [ ] Rotate secrets periodically (requires re-authentication)
- [ ] Review Django security advisories

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the project maintainers rather than creating a public issue.
