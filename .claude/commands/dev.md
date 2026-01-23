# Start Development Servers

Start both backend and frontend development servers in separate background processes.

## Instructions

1. Start the backend server:
   - Navigate to `backend/` directory
   - Activate the virtual environment
   - Run Daphne with debug mode enabled on port 8008

2. Start the frontend server:
   - Navigate to `frontend/` directory
   - Run `npm run dev`

3. Report the URLs to the user:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8008

Use background execution for both servers so the user can continue working. Inform the user how to check the server logs and how to stop them.
