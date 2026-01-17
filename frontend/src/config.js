// Default to localhost:8008 if VITE_API_BASE is not set
export const API_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8008';
export const WS_URL = API_URL ? API_URL.replace('https', 'wss').replace('http', 'ws') : 'ws://localhost:8008';
