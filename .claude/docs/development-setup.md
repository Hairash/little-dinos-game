# Development Setup Guide

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd little-dinos-game
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start the server
DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application
```

Backend runs at: http://localhost:8008

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: http://localhost:5173

## Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8008 |
| WebSocket (Game) | ws://localhost:8008/ws/game/{code}/ |
| WebSocket (Lobby) | ws://localhost:8008/ws/lobby/{code}/ |

## Database

Local development uses SQLite by default (`backend/db.sqlite3`).

To reset the database:
```bash
cd backend
rm db.sqlite3
python manage.py migrate
```

## Running Tests

### Frontend Tests

```bash
cd frontend
npm run test      # Run Vitest tests
npm run lint      # ESLint check
```

### Backend Tests

```bash
cd backend
source venv/bin/activate
python manage.py test
```

## Debug Logging

To enable debug logging for development:

### Backend

Edit `backend/game/consumers.py`:
```python
DEBUG_WEBSOCKET = True  # Line 11
```

Edit `backend/game/views.py`:
```python
DEBUG_VIEWS = True  # Line 19
```

### Frontend

Edit `frontend/src/components/MultiplayerDinoGame.vue`:
```javascript
const DEBUG_MULTIPLAYER = true;  # Line 72
```

## Common Development Tasks

### Create a New User

Use the API or the signup form:

```bash
curl -X POST http://localhost:8008/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'
```

### Create Admin User

```bash
cd backend
source venv/bin/activate
python manage.py createsuperuser
```

Access admin at: http://localhost:8008/admin/

### Run Backend with Auto-Reload

For development with auto-reload, you can use:

```bash
# Note: Daphne doesn't have built-in auto-reload
# Use watchdog or similar tool for auto-restart

pip install watchdog

watchmedo auto-restart --directory=. --pattern="*.py" --recursive -- \
  daphne -b 0.0.0.0 -p 8008 server.asgi:application
```

Or simply restart manually after changes.

## Project Structure

```
little-dinos-game/
├── frontend/                 # Vue.js frontend
│   ├── src/
│   │   ├── components/      # Vue components
│   │   ├── game/            # Game logic (engines, WebSocket)
│   │   └── auth.js          # Auth utilities
│   ├── tests/               # Vitest tests
│   └── package.json
├── backend/                  # Django backend
│   ├── game/
│   │   ├── services/        # Business logic
│   │   ├── consumers.py     # WebSocket handlers
│   │   ├── views.py         # REST API
│   │   └── models.py        # Database models
│   ├── server/
│   │   └── settings.py      # Django settings
│   └── requirements.txt
├── .claude/docs/             # Documentation
└── CLAUDE.md                 # AI assistant instructions
```

## IDE Setup

### VS Code Extensions (Recommended)

- **Vue - Official** (Vue.volar)
- **Python** (ms-python.python)
- **Pylance** (ms-python.vscode-pylance)
- **ESLint** (dbaeumer.vscode-eslint)

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "python.defaultInterpreterPath": "./backend/venv/bin/python",
  "eslint.workingDirectories": ["frontend"]
}
```

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.
