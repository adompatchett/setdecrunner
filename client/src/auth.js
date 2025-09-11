// src/auth.js
import { reactive, readonly, toRefs } from 'vue'
import api from './api.js'

const state = reactive({
  token: localStorage.getItem('token') || '',
  user: null,
  meLoaded: false,
})

// keep a simple “initialized once” flag
let inited = false

function persistToken(t) {
  state.token = t || ''
  if (state.token) localStorage.setItem('token', state.token)
  else localStorage.removeItem('token')
  api.setToken(state.token)           // wire token to API
}

async function fetchMe() {
  try {
    const me = await api.get('/auth/me')
    state.user = me || null
  } catch (e) {
    if (e.status === 401) logout()
    throw e
  } finally {
    state.meLoaded = true
  }
}

function logout({ clearTenant = false } = {}) {
  persistToken('')
  state.user = null
  state.meLoaded = false

  // optional: clear tenant context
  if (clearTenant) {
    localStorage.removeItem('currentProductionId')
  }

  // let other tabs/widgets know
  try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
}

async function loginLocal({ identifier, password }) {
  const { token } = await api.post('/auth/login', { identifier, password })
  persistToken(token)
  await fetchMe()
  return state.user
}

async function registerLocal(payload) {
  const { token } = await api.post('/auth/register', payload)
  persistToken(token)
  await fetchMe()
  return state.user
}

function init() {
  if (inited) return
  inited = true

  // send current token to API
  api.setToken(state.token)

  // central 401 hook → logout
  api.setUnauthorizedHandler(() => logout())
}

/**
 * Composable accessor – returns stable refs to the singleton state.
 * Call `auth.init()` once near app start (e.g., App.vue onMounted).
 */
export function useAuth() {
  return {
    ...toRefs(readonly(state)),
    // actions
    init,
    setToken: persistToken,
    fetchMe,
    logout,
    loginLocal,
    registerLocal,
  }
}

// Optional named export matching your old helper
export { logout }
