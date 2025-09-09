import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { useTenant } from '../stores/tenant.js'; // expects tenant.setSlug(slug) to set API header

// -------- Lazy views (same components you already have) --------
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
  scrollBehavior() { return { top: 0 }; },
  routes: [
    // ---- Global (tenant-neutral) auth routes ----
    { path: '/login', name: 'login', component: Login, meta: { guestOnly: true } },
    // Optional convenience: /:slug/login shows same Login but keeps slug in URL
    { path: '/:slug([a-z0-9-]+)/login', name: 'login-slug', component: Login, meta: { guestOnly: true } },

    // ---- Tenant shell: everything below requires a slug ----
    {
      path: '/:slug([a-z0-9-]+)',
      // You can use a ProductionShell layout here if you have one:
      component: () => import('../views/ProductionShell.vue'),
      // For now we mount views directly:
      children: [
        // Home
        { path: '', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },

        // Runsheets
        { path: 'runsheets', name: 'runsheets', component: RunSheets, meta: { requiresAuth: true } },
        { path: 'runsheets/:id', name: 'runsheet-edit', component: RunSheetEditor, props: true, meta: { requiresAuth: true } },
        { path: 'runsheetsview/:id', name: 'runsheet-view', component: RunSheetSingle, props: true, meta: { requiresAuth: true } },
        { path: 'runsheets/:id/beta', name: 'runsheet-beta', component: RunSheetsBeta, props: true, meta: { requiresAuth: true } },

        // Suppliers
        { path: 'suppliers', name: 'suppliers', component: Suppliers, meta: { requiresAuth: true } },
        { path: 'suppliers/new', name: 'supplier-new', component: SupplierEditor, meta: { requiresAuth: true } },
        { path: 'suppliers/:id', name: 'supplier-edit', component: SupplierEditor, props: true, meta: { requiresAuth: true } },

        // People
        { path: 'people', name: 'people', component: People, meta: { requiresAuth: true } },
        { path: 'people/new', name: 'person-new', component: PeopleEditor, meta: { requiresAuth: true } },
        { path: 'people/:id', name: 'person-edit', component: PeopleEditor, props: true, meta: { requiresAuth: true } },

        // Sets
        { path: 'sets', name: 'sets', component: SetsList, meta: { requiresAuth: true } },
        { path: 'sets/new', name: 'set-new', component: SetEditor, meta: { requiresAuth: true } },
        { path: 'sets/:id', name: 'set-edit', component: SetEditor, props: true, meta: { requiresAuth: true } },

        // Misc
        { path: 'driver', name: 'driver', component: Driver, meta: { requiresAuth: true } },
        { path: 'items',  name: 'items',  component: Items,  meta: { requiresAuth: true } },
        { path: 'places', name: 'places', component: Places, meta: { requiresAuth: true } },

        // Admin
        { path: 'admin/users', name: 'admin-users', component: AdminUsers, meta: { requiresAuth: true, roles: ['admin'] } },
      ],
    },

    // Root → send to login (tenant-neutral). You can change this to a marketing/landing page.
    { path: '/', redirect: '/login' },

    // Catch-all
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
});

/**
 * Global guard
 * - Picks up #token= (OAuth) or ?token=
 * - Loads user profile if needed
 * - Syncs the slug to tenant store (sets x-production-slug header)
 * - Enforces requiresAuth and optional roles
 */
router.beforeEach(async (to, from, next) => {
  const auth   = useAuth();
  const tenant = useTenant();
  console.debug('[guard]', to.fullPath, 'slug=', to.params?.slug);

  // 1) Pick up token from OAuth hash fragment or query string
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

  // 2) Sync active slug (if present) to tenant store (which should set API header)
  const slug = (to.params?.slug && String(to.params.slug)) || '';
  if (slug && tenant.slug !== slug.toLowerCase()) {
    try { await tenant.setSlug(slug); } catch { /* optional: handle 404/not found branding */ }
  }

  // 3) If we have a token but no user loaded yet, load profile
  if (auth.token && !auth.user) {
    try { await auth.fetchMe(); } catch { /* ignore; axios interceptor can handle 401 */ }
  }

  // 4) Guest-only (login) — if already authed, send to tenant home if we have a slug, else keep them on '/'
  if (to.meta?.guestOnly && auth.token) {
    // Prefer returning to original requested route (r=) or to slug home
    const r = (to.query?.r && String(to.query.r)) || (slug ? `/${slug}` : '/');
    return next(r);
  }

  // 5) If route requires auth, ensure token present
  if (to.meta?.requiresAuth && !auth.token) {
    // Preserve intended path (including slug) to return after login
    return next({ path: slug ? `/${slug}/login` : '/login', query: { r: to.fullPath } });
  }

  // 6) Optional role check (global role; if you need per-tenant roles, fetch them in a per-tenant guard)
  const roles = to.meta?.roles;
  if (roles && roles.length) {
    const role = auth.user?.role;
    if (!role || !roles.includes(role)) {
      // Not authorized -> back to tenant home or '/'
      return next(slug ? { path: `/${slug}` } : { path: '/' });
    }
  }

  next();
});

export default router;

