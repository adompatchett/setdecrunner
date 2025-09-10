// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { useProduction } from '../stores/production.js'; // You'll need to create this store

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

// Production selection/overview component
const ProductionHome  = () => import('../views/ProductionHome.vue');

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    // Auth
    { path: '/login', name: 'login', component: Login, meta: { guestOnly: true } },

    // Global home (no production selected)
    { path: '/', name: 'home', component: Dashboard, meta: { requiresAuth: true } },

    // Production-based routes - all under /:slug/
    { 
      path: '/:slug([a-zA-Z0-9-_]+)', // Restrict slug pattern
      component: { template: '<router-view />' }, // Wrapper component
      meta: { requiresAuth: true, requiresProduction: true },
      children: [
        // Production home/dashboard
        { path: '', name: 'production-home', component: ProductionHome },

        // Runsheets
        { path: 'runsheets', name: 'runsheets', component: RunSheets },
        { path: 'runsheets/:id', name: 'runsheet-edit', component: RunSheetEditor, props: true },
        { path: 'runsheetsview/:id', name: 'runsheet-view', component: RunSheetSingle, props: true },
        { path: 'runsheets/:id/beta', name: 'runsheet-beta', component: RunSheetsBeta, props: true },

        // Suppliers
        { path: 'suppliers', name: 'suppliers', component: Suppliers },
        { path: 'suppliers/new', name: 'supplier-new', component: SupplierEditor },
        { path: 'suppliers/:id', name: 'supplier-edit', component: SupplierEditor, props: true },

        // People
        { path: 'people', name: 'people', component: People },
        { path: 'people/new', name: 'person-new', component: PeopleEditor },
        { path: 'people/:id', name: 'person-edit', component: PeopleEditor, props: true },

        // Sets
        { path: 'sets', name: 'sets', component: SetsList },
        { path: 'sets/new', name: 'set-new', component: SetEditor },
        { path: 'sets/:id', name: 'set-edit', component: SetEditor, props: true },

        // Misc
        { path: 'driver', name: 'driver', component: Driver },
        { path: 'items', name: 'items', component: Items },
        { path: 'places', name: 'places', component: Places },

        // Admin (still available within production context)
        { path: 'admin/users', name: 'admin-users', component: AdminUsers, meta: { roles: ['admin'] } },
      ]
    },

    // Catch-all
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/**
 * Global auth/role/production guard
 */
router.beforeEach(async (to, from, next) => {
  const auth = useAuth();
  const production = useProduction();

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

  // 2) If we have a token but no user loaded yet, try fetching profile
  if (auth.token && !auth.user) {
    try { 
      await auth.fetchMe(); 
    } catch { 
      /* ignore; interceptor will handle 401 */ 
    }
  }

  // 3) Guest-only routes
  if (to.meta?.guestOnly && auth.token) {
    const r = (to.query?.r && String(to.query.r)) || '/';
    return next(r);
  }

  // 4) Require auth
  if (to.meta?.requiresAuth && !auth.token) {
    return next({ path: '/login', query: { r: to.fullPath } });
  }

  // 5) Production slug handling
  if (to.meta?.requiresProduction && to.params?.slug) {
    const currentSlug = to.params.slug;
    
    // If we don't have the production loaded or it's a different slug
    if (!production.current || production.current.slug !== currentSlug) {
      try {
        await production.fetchBySlug(currentSlug);
      } catch (error) {
        console.error('Production not found:', error);
        // Redirect to home if production not found
        return next({ path: '/', replace: true });
      }
    }
  }

  // 6) Role gate
  const roles = to.meta?.roles;
  if (roles && roles.length) {
    const role = auth.user?.role;
    if (!role || !roles.includes(role)) {
      // For production routes, redirect to production home
      if (to.params?.slug) {
        return next({ name: 'production-home', params: { slug: to.params.slug } });
      }
      return next({ path: '/' });
    }
  }

  next();
});

export default router;