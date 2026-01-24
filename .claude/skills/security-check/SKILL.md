---
name: security-check
description: Run security audits on dependencies
---

Run security audits to check for known vulnerabilities.

## Frontend (npm)

```bash
cd frontend
npm audit
```

To fix vulnerabilities automatically (when safe):
```bash
npm audit fix
```

## Backend (Python)

Install pip-audit if not already installed:
```bash
pip install pip-audit
```

Run the audit:
```bash
cd backend
source venv/bin/activate
pip-audit
```

## Manual Security Checks

1. **Review debug flags**: Ensure `DEBUG_WEBSOCKET`, `DEBUG_VIEWS`, `DEBUG_MULTIPLAYER` are `False`
2. **Check secrets**: Verify production uses unique secrets (not defaults)
3. **Review CORS**: Ensure `CORS_ALLOWED_ORIGINS` is not `*`
4. **Check HTTPS**: Verify production uses HTTPS only

## Additional Tools

- **OWASP ZAP**: For penetration testing
- **Snyk**: `npm install -g snyk && snyk test`
- **Safety**: `pip install safety && safety check`
