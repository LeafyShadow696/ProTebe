import axios from 'axios';

// When REACT_APP_BACKEND_URL is set we use it as-is. On Vercel we set it to
// '/_/backend' so calls become same-origin (no CORS, automatic auth cookies).
// In local dev it's the FastAPI URL (http://localhost:8001).
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
export const API = `${BACKEND}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

// Local storage keys
const KEY_TOKEN = 'remix.token';
const KEY_PAIR = 'remix.pair';
const KEY_THEME = 'remix.theme';
const KEY_ROLE = 'remix.role'; // 'owner' | 'partner'

export const storage = {
  getToken: () => localStorage.getItem(KEY_TOKEN),
  setToken: (t) => localStorage.setItem(KEY_TOKEN, t),
  getPair: () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_PAIR) || 'null');
    } catch {
      return null;
    }
  },
  setPair: (p) => localStorage.setItem(KEY_PAIR, JSON.stringify(p)),
  getRole: () => localStorage.getItem(KEY_ROLE) || 'owner',
  setRole: (r) => localStorage.setItem(KEY_ROLE, r),
  getTheme: () => localStorage.getItem(KEY_THEME) || 'dark',
  setTheme: (t) => localStorage.setItem(KEY_THEME, t),
  clear: () => {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_PAIR);
    localStorage.removeItem(KEY_ROLE);
  },
};
