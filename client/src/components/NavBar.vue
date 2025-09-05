<template>
  <nav class="nav">
    <!-- Logo -->
    <div class="nav__logo">
      <img src="/logo.png" alt="Set Dec Runner Logo" />
      <span class="nav__logo-text">Set Dec Runner</span>
    </div>

    <!-- Navigation Links -->
    <div class="nav__links">
      <RouterLink class="nav__link" to="/" draggable="false">Dashboard</RouterLink>
      <RouterLink class="nav__link" to="/runsheets" draggable="false">Run Sheets</RouterLink>
      <RouterLink class="nav__link" to="/sets" draggable="false">Sets</RouterLink>
      <RouterLink class="nav__link" to="/people" draggable="false">People</RouterLink>
      <RouterLink class="nav__link" to="/items" draggable="false">Items</RouterLink>
      <RouterLink class="nav__link" to="/places" draggable="false">Places</RouterLink>
      <RouterLink class="nav__link" to="/suppliers" draggable="false">Suppliers</RouterLink>
      <RouterLink
        v-if="userRole === 'admin'"
        class="nav__link"
        to="/admin/users"
        draggable="false"
      >Admin</RouterLink>
    </div>

    <!-- User Info -->
    <div class="nav__right">
      <img
        v-if="photoSrc"
        :src="photoSrc"
        class="nav__avatar"
        :alt="displayName || 'Profile'"
        draggable="false"
      />
      <span class="nav__name" :title="displayName">{{ displayName }}</span>
      <button class="btn btn--ghost" @click="$emit('logout')">Logout</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuth } from '../stores/auth.js';



const props = defineProps({
  me: { type: Object, default: null },
});
defineEmits(['logout']);

const auth = useAuth();

// Prefer the passed-in user; fall back to auth store user
const user = computed(() => props.me || auth.user || null);
const userRole = computed(() => user.value?.role || auth.user?.role || '');

// Display name fallbacks
const displayName = computed(() =>
  user.value?.name ||
  user.value?.fullName ||
  user.value?.displayName ||
  user.value?.email ||
  ''
);

// --- pick up more possible photo fields (Google, Firebase, Passport, etc.) ---
const rawPhoto = computed(() => {
  const u = user.value || {};
  return (
    u.photo ||
    u.avatar ||
    u.photoUrl ||
    u.photoURL ||
    u.picture ||
    u.image?.url ||
    u.image ||
    u.providerData?.[0]?.photoURL ||
    u.photos?.[0]?.value ||
    u.profile?._json?.picture ||
    u.profile?.picture ||
    u.profile?.photos?.[0]?.value ||
    '' // fallback
  );
});

// --- robust origin (same as before, just a bit stricter) ---
const rawApiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api').replace(/\/+$/, '');
const apiOrigin  = rawApiBase.replace(/\/api\/?$/, '') || window.location.origin;

// Normalize to a usable <img src>
function normalizePhoto(p) {
  if (!p) return '';

  // absolute or data URI?
  if (/^(?:https?:)?\/\//i.test(p) || p.startsWith('data:')) {
    // protocol-relative? force https
    if (p.startsWith('//')) return `https:${p}`;
    // avoid mixed content: upgrade http->https if our page is https
    if (location.protocol === 'https:' && p.startsWith('http:')) {
      p = p.replace(/^http:/i, 'https:');
    }
    // Google tweak: add a sensible size if none present
    try {
      const u = new URL(p, location.origin);
      if (/\bgoogleusercontent\.com$/i.test(u.hostname) && !/[?&]sz=|[?&]s=\d+/i.test(u.search)) {
        // prefer sz=128 for newer endpoints; many also accept '=s128-c' suffix
        u.search += (u.search ? '&' : '?') + 'sz=128';
        return u.toString();
      }
    } catch {
      /* ignore URL parse errors */
    }
    return p;
  }

  // anything with '/uploads/' inside (even a filesystem path) → map to public uploads
  let s = String(p).replace(/\\/g, '/');
  const idx = s.indexOf('/uploads/');
  if (idx !== -1) s = s.slice(idx);
  if (!s.startsWith('/')) s = `/${s}`;
  if (!s.startsWith('/uploads/')) s = s.replace(/^\/+/, '/uploads/');

  return `${apiOrigin}${s}`;
}

const photoSrc = computed(() => normalizePhoto(rawPhoto.value));

</script>

<style scoped>
/* ---- Layout ---- */
.nav {
  position: sticky;
  top: 0;
  z-index: 10;

  display: flex;
  align-items: center;
  gap: 16px;

  padding: 10px 18px;

  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: saturate(180%) blur(6px);
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 0 rgba(0,0,0,0.03);
}

.nav__logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav__logo img {
  height: 100px;
  width: auto;
}

.nav__logo-text {
  font-weight: 600;
  font-size: 16px;
  color: #222;
}

/* ---- Links ---- */
.nav__links {
  display: flex;
  gap: 16px;
}

.nav__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.nav__link {
  position: relative;
  display: inline-block;
  padding: 6px 4px;
  color: #444;
  text-decoration: none;
  font-size: 14px;
  line-height: 1;
  transition: color .15s ease-in-out;
}

.nav__link:hover { color: #111; }

/* Active route underline */
.nav__link.router-link-active,
.nav__link.router-link-exact-active {
  font-weight: 600;
  color: #111;
}
.nav__link.router-link-active::after,
.nav__link.router-link-exact-active::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -6px;
  height: 2px;
  background: #111;
  border-radius: 2px;
}

/* ---- User bits ---- */
.nav__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #ddd;
}

.nav__name {
  max-width: 160px;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Buttons ---- */
.btn {
  font: inherit;
  font-size: 13px;
  line-height: 1;
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid #d6d6d6;
  background: #f6f6f6;
  color: #222;
  cursor: pointer;
  
}
.btn:hover {
  background: #efefef;
  border-color: #cfcfcf;
}
.btn:active { transform: translateY(1px); }
.btn:focus-visible {
  outline: 2px solid #4c9ffe;
  outline-offset: 2px;
}
.btn--ghost {
  background: #fff;
}

/* ---- Small screens ---- */
@media (max-width: 720px) {
  .nav {
    flex-wrap: wrap;
    gap: 10px;
  }
  .nav__logo {
    width: 100%;
    justify-content: center;
  }
  .nav__links {
    width: 100%;
    order: 2;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .nav__right {
    order: 1;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
