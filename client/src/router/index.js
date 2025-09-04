import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth.js';


const Login = () => import('../views/Login.vue');
const Dashboard = () => import('../views/Dashboard.vue');
const AdminUsers = () => import('../views/AdminUsers.vue');
const RunSheets = () => import('../views/RunSheets.vue');
const RunSheetEditor = () => import('../views/RunSheetEditor.vue');
const Driver = () => import('../views/Driver.vue');
const Items = () => import('../views/Items.vue');
const Places = () => import('../views/Places.vue');


const router = createRouter({
history: createWebHistory(),
routes: [
{ path: '/login', component: Login },
{ path: '/', component: Dashboard },
{ path: '/runsheets', component: RunSheets },
{ path: '/runsheets/:id', component: RunSheetEditor, props: true },
{ path: '/driver', component: Driver },
{ path: '/items', component: Items },
{ path: '/places', component: Places },
{ path: '/admin/users', component: AdminUsers }
]
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