<template>
  <div class="login">
     
    <div class="login__card">
      <p class="login__subtitle">Sign in to continue</p>
      <!-- Logo -->
     <div class="nav__logo">
      <img src="/logo.png" alt="Set Dec Runner Logo" />
      
    </div>
      <a class="btn btn--google" :href="api + '/auth/google'">
        Continue with Google
      </a>
      <a class="btn btn--facebook" :href="api + '/auth/facebook'">
        Continue with Facebook
      </a>

      <div class="login__info">
        <p v-if="redirecting">Signing you in…</p>
        <p v-else>
          After authenticating, you’ll be redirected back here automatically.
        </p>
        <p class="login__note">
          First user to sign in becomes <span class="bold">admin</span> and is
          auto-authorized for the site.
        </p>
      </div>

      <p v-if="error" class="login__error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';

const router = useRouter();
const auth = useAuth();
const api = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const redirecting = ref(false);
const error = ref('');

onMounted(async () => {
  try {
    if (window.location.hash.startsWith('#token=')) {
      const token = decodeURIComponent(window.location.hash.slice('#token='.length));
      auth.setToken(token);
      window.location.hash = '';
      redirecting.value = true;
      await auth.fetchMe();
      router.replace('/');
      return;
    }

    if (auth.token) {
      redirecting.value = true;
      await auth.fetchMe().catch(() => {});
      router.replace('/');
    }
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Login failed';
    redirecting.value = false;
  }
});
</script>

<style scoped>
/* Page layout */
.login {
  height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f6fa;
  font-family: Arial, sans-serif;
}

.login__card {
  background: #fff;
  border: 1px solid #ddd;
  padding: 28px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  text-align: center;
  width: 100%;
  max-width: 360px;
  overflow: hidden; /* prevent button spill */
}

/* Ensure padding + border are included in width */
.login__card,
.login__card * {
  box-sizing: border-box;
}

/* Title + subtitle */
.login__title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #222;
}

.login__subtitle {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
}

/* Logo */
.nav__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.nav__logo img {
  height: 72px;     /* reduced so it doesn’t crowd */
  max-width: 100%;
  width: auto;
}

.nav__logo-text {
  font-weight: 600;
  font-size: 16px;
  color: #222;
  white-space: nowrap;
}

/* Buttons */
.btn {
  display: block;
  width: 100%;
  padding: 10px 14px;
  margin-bottom: 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  color: #222;
  transition: background 0.2s ease, border-color 0.2s ease;
  box-sizing: border-box; /* key fix */
}

.btn:hover {
  background: #f2f2f2;
  border-color: #bbb;
}

.btn--google {
  background: #fff;
}

.btn--facebook {
  background: #3b5998;
  color: #fff;
  border-color: #3b5998;
}
.btn--facebook:hover {
  background: #334d84;
  border-color: #334d84;
}

/* Info text */
.login__info {
  font-size: 11px;
  color: #555;
  margin-top: 12px;
  line-height: 1.5;
}

.login__note {
  margin-top: 8px;
}

.bold {
  font-weight: bold;
}

/* Error message */
.login__error {
  color: #b00020;
  font-size: 12px;
  margin-top: 12px;
}
</style>


  