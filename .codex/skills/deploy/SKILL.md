---
name: deploy
description: Deploy backend (Fly.io) and frontend (Netlify)
---

Deploy the application to production.

## Backend (Fly.io)

```bash
cd backend
fly deploy
```

After deployment, run migrations:
```bash
fly ssh console -C "python manage.py migrate"
```

## Frontend (Netlify)

Frontend auto-deploys on push to main branch.

For manual deployment:
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

## Pre-Deployment Checklist

- [ ] Set production secrets in Fly.io (`fly secrets set KEY=value`)
- [ ] Verify environment variables in Netlify UI
- [ ] Run tests locally before deploying
- [ ] Check CORS/CSRF origins match production URLs

## Verify Deployment

1. Check backend health: `curl https://your-app.fly.dev/auth/whoami/`
2. Check frontend loads at Netlify URL
3. Test WebSocket connection in browser console
