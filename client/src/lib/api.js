import axios from 'axios';

// Dev: Vite proxies /api to localhost:5000. Prod: set VITE_API_URL to the Render URL (no secrets here).
export const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api`, timeout: 45000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('bz_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
    localStorage.removeItem('bz_token');
    if (!location.pathname.startsWith('/login')) location.assign('/login');
  }
  return Promise.reject(err);
});

export const errMsg = (e) => e?.response?.data?.error || (e?.code === 'ECONNABORTED' ? 'Request timed out. Please retry.' : e?.message === 'Network Error' ? 'No connection to server. Check your internet.' : e?.message) || 'Something went wrong';
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
