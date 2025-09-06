// client/src/api/index.js
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const instance = axios.create({ baseURL });

// Boot: set token from localStorage
try {
  const t = localStorage.getItem('token');
  if (t) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  }
} catch {
  // ignore localStorage errors (e.g. Safari private mode)
}

// Auto-logout on 401
instance.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      try { localStorage.removeItem('token'); } catch {}
      delete instance.defaults.headers.common['Authorization'];
      // redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default {
  setToken(t) {
    if (t) {
      try { localStorage.setItem('token', t); } catch {}
      instance.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      try { localStorage.removeItem('token'); } catch {}
      delete instance.defaults.headers.common['Authorization'];
    }
  },
  clearToken() {
    try { localStorage.removeItem('token'); } catch {}
    delete instance.defaults.headers.common['Authorization'];
  },
  async get(u, params) {
    const { data } = await instance.get(u, { params });
    return data;
  },
  async post(u, body, config) {
    const { data } = await instance.post(u, body, config);
    return data;
  },
  async patch(u, body) {
    const { data } = await instance.patch(u, body);
    return data;
  },
  async del(u, body) {
    const { data } = await instance.delete(u, { data: body });
    return data;
  }
};