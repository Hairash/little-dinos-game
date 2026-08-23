---
name: setup
description: One-command development environment setup
---

Set up the complete development environment:

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

## Frontend Setup

```bash
cd frontend
npm install
```

## Verify Setup

1. Start backend: `cd backend && source venv/bin/activate && DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application`
2. Start frontend: `cd frontend && npm run dev`
3. Open http://localhost:5173 in browser

## Troubleshooting

- **Python venv issues**: Try `python3 -m venv venv`
- **npm install fails**: Try `npm cache clean --force && npm install`
- **Port in use**: Kill existing processes on ports 8008/5173
