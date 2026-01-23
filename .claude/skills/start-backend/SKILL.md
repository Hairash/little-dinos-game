---
name: start-backend
description: Start the Django backend server on port 8008
---

Start the Django backend development server:

1. Navigate to the backend directory
2. Activate the Python virtual environment
3. Run Daphne ASGI server with DJANGO_DEBUG=True

```bash
cd backend && source venv/bin/activate && DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application
```

The backend will be available at http://localhost:8008
