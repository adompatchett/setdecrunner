import axios from 'axios';


const instance = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api' });


// set token from localStorage on boot
try {
const t = localStorage.getItem('token');
if (t) instance.defaults.headers.common['Authorization'] = `Bearer ${t}`;
} catch {}


instance.interceptors.response.use(r => r, err => {
if (err.response?.status === 401) {
localStorage.removeItem('token');
window.location.href = '/login';
}
return Promise.reject(err);
});


export default {
setToken(t) { if (t) instance.defaults.headers.common['Authorization'] = `Bearer ${t}`; else delete instance.defaults.headers.common['Authorization']; },
async get(u, params) { const { data } = await instance.get(u, { params }); return data; },
async post(u, body, config) { const { data } = await instance.post(u, body, config); return data; },
async patch(u, body) { const { data } = await instance.patch(u, body); return data; },
async del(u, body) { const { data } = await instance.delete(u, { data: body }); return data; }
};