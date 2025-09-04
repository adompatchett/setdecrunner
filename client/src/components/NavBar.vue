<template>
  <nav class="nav">
    <!-- Logo -->
    <div class="nav__logo">
      <img src="/logo.png" alt="Set Dec Runner Logo" />
      <span class="nav__logo-text">Set Dec Runner</span>
    </div>

    <!-- Navigation Links -->
    <div class="nav__links">
      <RouterLink class="nav__link" to="/">Dashboard</RouterLink>
      <RouterLink class="nav__link" to="/runsheets">Run Sheets</RouterLink>
      <RouterLink class="nav__link" to="/items">Items</RouterLink>
      <RouterLink class="nav__link" to="/places">Places</RouterLink>
      <RouterLink
        v-if="me?.role==='admin'"
        class="nav__link"
        to="/admin/users"
      >Admin</RouterLink>
    </div>

    <!-- User Info -->
    <div class="nav__right">
      <img v-if="me?.photo" :src="me.photo" class="nav__avatar" alt="Profile" />
      <span class="nav__name" :title="me?.name">{{ me?.name }}</span>
      <button class="btn btn--ghost" @click="$emit('logout')">Logout</button>
    </div>
  </nav>
</template>

<script setup>
const props = defineProps({ me: Object });
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
