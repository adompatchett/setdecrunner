// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth.js';

const Login          = () => import('../views/Login.vue');
const Dashboard      = () => import('../views/Dashboard.vue');
const AdminUsers     = () => import('../views/AdminUsers.vue');
const RunSheets      = () => import('../views/RunSheets.vue');
const RunSheetEditor = () => import('../views/RunSheetEditor.vue');
const Driver         = () => import('../views/Driver.vue');
const Items          = () => import('../views/Items.vue');
const Places         = () => import('../views/Places.vue');

const Suppliers      = () => import('../views/Suppliers.vue');
const SupplierEditor = () => import('../views/SupplierEditor.vue');

// NEW: People
const People         = () => import('../views/People.vue');
const PeopleEditor   = () => import('../views/PeopleEditor.vue');

// NEW: Sets
const SetsList        = () => import('../views/SetsList.vue');
const SetEditor      = () => import('../views/SetEditor.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', name: 'dashboard', component: Dashboard },

    // Runsheets
    { path: '/runsheets', name: 'runsheets', component: RunSheets },
    { path: '/runsheets/:id', name: 'runsheet-edit', component: RunSheetEditor, props: true },

    // Suppliers
    { path: '/suppliers', name: 'suppliers', component: Suppliers },
    { path: '/suppliers/new', name: 'supplier-new', component: SupplierEditor },
    { path: '/suppliers/:id', name: 'supplier-edit', component: SupplierEditor, props: true },

    // People (order matters: /people/new BEFORE /people/:id)
    { path: '/people', name: 'people', component: People },
    { path: '/people/new', name: 'person-new', component: PeopleEditor },
    { path: '/people/:id', name: 'person-edit', component: PeopleEditor, props: true },

    // Sets (order matters: /sets/new BEFORE /sets/:id)
    { path: '/sets', name: 'sets', component: SetsList },
    { path: '/sets/new', name: 'set-new', component: SetEditor },
    { path: '/sets/:id', name: 'set-edit', component: SetEditor, props: true },

    // Misc
    { path: '/driver', name: 'driver', component: Driver },
    { path: '/items', name: 'items', component: Items },
    { path: '/places', name: 'places', component: Places },
    { path: '/admin/users', name: 'admin-users', component: AdminUsers },

    // Optional: a catch-all to keep SPA in a known state
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to, from, next) => {
  const auth = useAuth();

  // pick up token from OAuth redirect: http://localhost:5173/#token=...
  if (!auth.token && window.location.hash.startsWith('#token=')) {
    auth.setToken(decodeURIComponent(window.location.hash.slice('#token='.length)));
    window.location.hash = '';
  }

  if (to.path !== '/login' && !auth.token) return next('/login');
  next();
});

export default router;
