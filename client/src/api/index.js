import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const instance = axios.create({ baseURL });

// ---------- Helpers: token + tenant slug ----------
function setToken(t) {
  if (t) {
    try { localStorage.setItem('token', t); } catch {}
    instance.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  } else {
    try { localStorage.removeItem('token'); } catch {}
    delete instance.defaults.headers.common['Authorization'];
  }
}

function setTenantSlug(slug) {
  if (slug) {
    instance.defaults.headers.common['x-production-slug'] = String(slug).toLowerCase();
  } else {
    delete instance.defaults.headers.common['x-production-slug'];
  }
}

// Boot: set token from localStorage
try {
  const t = localStorage.getItem('token');
  if (t) setToken(t);
} catch { /* ignore */ }

// ---------- Auto-logout / redirect on 401 (slug-aware) ----------
instance.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      try { localStorage.removeItem('token'); } catch {}
      delete instance.defaults.headers.common['Authorization'];

      const path = window.location.pathname || '/';
      const parts = path.split('/'); // ["", "slug", ...] or ["", "login"]
      const maybeSlug = parts[1] && /^[a-z0-9-]+$/.test(parts[1]) ? parts[1] : '';
      const loginPath = maybeSlug ? `/${maybeSlug}/login` : '/login';
      const target = `${loginPath}?r=${encodeURIComponent(path + window.location.search)}`;

      if (path !== loginPath) window.location.href = target;
    }
    return Promise.reject(err);
  }
);

// ---------- Minimal wrapper ----------
export default {
  setToken,
  clearToken() { setToken(''); },
  setTenantSlug,       // <—— call this from your tenant store!
  setHeader(k, v) {    // optional generic header setter
    if (!v && v !== 0) delete instance.defaults.headers.common[k];
    else instance.defaults.headers.common[k] = v;
  },

  async get(u, params)  { const { data } = await instance.get(u, { params }); return data; },
  async post(u, body, config) { const { data } = await instance.post(u, body, config); return data; },
  async patch(u, body)  { const { data } = await instance.patch(u, body); return data; },
  async del(u, body)    { const { data } = await instance.delete(u, { data: body }); return data; },
};