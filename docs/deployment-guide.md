# Deployment Guide

## Architecture Overview

- **Backend**: Django + Django Channels (ASGI) on Fly.io
- **Frontend**: Vue.js 3 SPA on Netlify
- **Database**: PostgreSQL (Neon) for production
- **Cache/Channel Layer**: Redis (Upstash) for WebSocket support

## Environment Variables

### Backend (Required for Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key (generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`) | `abc123...` |
| `JWT_SECRET_KEY` | JWT signing key (can be same as DJANGO_SECRET_KEY) | `xyz789...` |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames | `api.example.com,example.com` |
| `CORS_ALLOWED_ORIGINS` | Frontend URLs for CORS | `https://example.com` |
| `CSRF_TRUSTED_ORIGINS` | Same as CORS_ALLOWED_ORIGINS | `https://example.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host/db` |
| `REDIS_URL` | Redis connection string for WebSockets | `redis://user:pass@host:6379` |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE` | Backend API URL | `https://api.example.com` |

## Backend Deployment (Fly.io)

### Prerequisites
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account with `fly auth login`

### Steps

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create Fly.io app (first time only):**
   ```bash
   fly launch
   ```

3. **Set secrets:**
   ```bash
   fly secrets set DJANGO_SECRET_KEY="your-secret-key"
   fly secrets set JWT_SECRET_KEY="your-jwt-secret"
   fly secrets set DATABASE_URL="postgres://..."
   fly secrets set REDIS_URL="redis://..."
   fly secrets set ALLOWED_HOSTS="your-app.fly.dev"
   fly secrets set CORS_ALLOWED_ORIGINS="https://your-frontend.netlify.app"
   fly secrets set CSRF_TRUSTED_ORIGINS="https://your-frontend.netlify.app"
   ```

4. **Deploy:**
   ```bash
   fly deploy
   ```

5. **Run migrations (after deployment):**
   ```bash
   fly ssh console -C "python manage.py migrate"
   ```

### Fly.io Configuration (`fly.toml`)

Key settings:
- Uses Daphne ASGI server for WebSocket support
- Health check on `/auth/whoami/`
- Auto-scaling configuration

## Frontend Deployment (Netlify)

### Prerequisites
- Netlify account connected to your Git repository

### Automatic Deployment

Push to `main` branch triggers automatic deployment via Netlify CI.

### Manual Deployment

1. **Build locally:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy with Netlify CLI:**
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Environment Variables

Set in Netlify UI (Site settings > Build & deploy > Environment):
- `VITE_API_BASE`: Your backend URL

### Netlify Configuration (`netlify.toml`)

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Database Setup (Neon/PostgreSQL)

1. Create a Neon project at https://neon.tech
2. Copy the connection string
3. Set as `DATABASE_URL` in Fly.io secrets

### Running Migrations

```bash
# Local (with DATABASE_URL set)
cd backend
python manage.py migrate

# On Fly.io
fly ssh console -C "python manage.py migrate"
```

## Redis Setup (Upstash)

1. Create a Redis database at https://upstash.com
2. Copy the connection URL (Redis protocol)
3. Set as `REDIS_URL` in Fly.io secrets

## Monitoring & Debugging

### View Logs

```bash
# Fly.io backend logs
fly logs

# Fly.io logs with timestamps
fly logs -t
```

### SSH into Production

```bash
fly ssh console
```

### Health Checks

- Backend: `GET /auth/whoami/` should return `{"auth": false}`
- WebSocket: Connect to `wss://your-app.fly.dev/ws/game/test/`

## Security Checklist

Before deploying to production:

- [ ] Set unique `DJANGO_SECRET_KEY`
- [ ] Set unique `JWT_SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS` (remove `*`)
- [ ] Configure `CORS_ALLOWED_ORIGINS` with exact frontend URLs
- [ ] Ensure HTTPS is enforced
- [ ] Set `DEBUG=False` (default in production)
- [ ] Review database connection SSL settings

## Troubleshooting

### WebSocket Connection Fails
- Check `REDIS_URL` is set correctly
- Verify CORS origins include WebSocket origin
- Check Fly.io machine is running: `fly status`

### Database Connection Errors
- Verify `DATABASE_URL` format
- Check Neon database is active
- Ensure SSL is enabled for production

### Static Files Not Loading
- Run `python manage.py collectstatic`
- Check WhiteNoise is configured in `settings.py`
