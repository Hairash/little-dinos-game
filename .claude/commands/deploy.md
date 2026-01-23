# Deploy Application

Deploy the Little Dinos Game to production.

## Instructions

Ask the user which component to deploy:
- **Backend only**: Deploy to Fly.io
- **Frontend only**: Push to trigger Netlify deployment
- **Both**: Deploy both components

### Backend Deployment (Fly.io)

1. Navigate to `backend/` directory
2. Run `fly deploy`
3. Wait for deployment to complete
4. Report the deployment status and URL

### Frontend Deployment (Netlify)

The frontend auto-deploys when changes are pushed to the main branch.

1. Check if there are uncommitted changes in `frontend/`
2. If deploying, ensure changes are committed and pushed to main
3. Inform user that Netlify will auto-deploy

### Pre-deployment Checks

Before deploying, optionally run:
- `npm run lint` in frontend/
- `npm run test` in frontend/

Report any failures before proceeding with deployment.
