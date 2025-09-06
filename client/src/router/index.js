// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth.js';

// Lazy views
const Login           = () => import('../views/Login.vue');
const Dashboard       = () => import('../views/Dashboard.vue');
const AdminUsers      = () => import('../views/AdminUsers.vue');

const RunSheets       = () => import('../views/RunSheets.vue');
const RunSheetSingle  = () => import('../views/RunSheetSingle.vue');
const RunSheetEditor  = () => import('../views/RunSheetEditor.vue');

const Driver          = () => import('../views/Driver.vue');
const Items           = () => import('../views/Items.vue');
const Places          = () => import('../views/Places.vue');

const Suppliers       = () => import('../views/Suppliers.vue');
const SupplierEditor  = () => import('../views/SupplierEditor.vue');

const People          = () => import('../views/People.vue');
const PeopleEditor    = () => import('../views/PeopleEditor.vue');

const SetsList        = () => import('../views/SetsList.vue');
const SetEditor       = () => import('../views/SetEditor.vue');

const RunSheetsBeta   = () => import('../views/RunSheetsBeta.vue');

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    // Auth
    { path: '/login', name: 'login', component: Login, meta: { guestOnly: true } },

    // Home
    { path: '/', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },

    // Runsheets
    { path: '/runsheets', name: 'runsheets', component: RunSheets, meta: { requiresAuth: true } },
    { path: '/runsheets/:id', name: 'runsheet-edit', component: RunSheetEditor, props: true, meta: { requiresAuth: true } },
    { path: '/runsheetsview/:id', name: 'runsheet-view', component: RunSheetSingle, props: true, meta: { requiresAuth: true } },
    { path: '/runsheets/:id/beta', name: 'runsheet-beta', component: RunSheetsBeta, props: true, meta: { requiresAuth: true } },

    // Suppliers
    { path: '/suppliers', name: 'suppliers', component: Suppliers, meta: { requiresAuth: true } },
    { path: '/suppliers/new', name: 'supplier-new', component: SupplierEditor, meta: { requiresAuth: true } },
    { path: '/suppliers/:id', name: 'supplier-edit', component: SupplierEditor, props: true, meta: { requiresAuth: true } },

    // People (order matters)
    { path: '/people', name: 'people', component: People, meta: { requiresAuth: true } },
    { path: '/people/new', name: 'person-new', component: PeopleEditor, meta: { requiresAuth: true } },
    { path: '/people/:id', name: 'person-edit', component: PeopleEditor, props: true, meta: { requiresAuth: true } },

    // Sets (order matters)
    { path: '/sets', name: 'sets', component: SetsList, meta: { requiresAuth: true } },
    { path: '/sets/new', name: 'set-new', component: SetEditor, meta: { requiresAuth: true } },
    { path: '/sets/:id', name: 'set-edit', component: SetEditor, props: true, meta: { requiresAuth: true } },

    // Misc
    { path: '/driver', name: 'driver', component: Driver, meta: { requiresAuth: true } },
    { path: '/items',  name: 'items',  component: Items,  meta: { requiresAuth: true } },
    { path: '/places', name: 'places', component: Places, meta: { requiresAuth: true } },

    // Admin
    { path: '/admin/users', name: 'admin-users', component: AdminUsers, meta: { requiresAuth: true, roles: ['admin'] } },

    // Catch-all
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/**
 * Global auth/role guard
 * - Picks up #token= (OAuth) or ?token=
 * - Loads profile if needed
 * - Redirects guests to /login
 * - Enforces route role meta (e.g., admin)
 */
router.beforeEach(async (to, from, next) => {
  const auth = useAuth();

  // 1) Pick up token from OAuth hash fragment or query string
  //    e.g., http://localhost:5173/#token=... OR /login?token=...
  const hash = window.location.hash || '';
  if (!auth.token && hash.startsWith('#token=')) {
    const t = decodeURIComponent(hash.slice('#token='.length));
    auth.setToken(t);
    window.location.hash = '';
  } else if (!auth.token && to.query?.token) {
    auth.setToken(String(to.query.token));
    const { token, ...rest } = to.query;
    return next({ path: to.path, query: rest, replace: true });
  }

  // 2) If we have a token but no user loaded yet, try fetching profile
  if (auth.token && !auth.user) {
    try { await auth.fetchMe(); } catch { /* ignore; interceptor will handle 401 */ }
  }

  // 3) Guest-only routes (e.g., /login): redirect if already authenticated
  if (to.meta?.guestOnly && auth.token) {
    const r = (to.query?.r && String(to.query.r)) || '/';
    return next(r);
  }

  // 4) Require auth
  if (to.meta?.requiresAuth && !auth.token) {
    return next({ path: '/login', query: { r: to.fullPath } });
  }

  // 5) Role gate (admin, etc.)
  const roles = to.meta?.roles;
  if (roles && roles.length) {
    const role = auth.user?.role;
    if (!role || !roles.includes(role)) {
      // Not authorized -> send to home
      return next({ path: '/' });
    }
  }

  next();
});

export default router;
