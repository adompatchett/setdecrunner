<template>
  <div class="login">
    <div class="login__card">
      <p class="login__subtitle">Sign in to continue</p>

      <!-- Logo -->
      <div class="nav__logo">
        <img src="/logo.png" alt="Set Dec Runner Logo" />
      </div>

      <!-- OAuth buttons -->
      <div class="mb-3 flex col gap-2">
        <a class="btn btn--google w-full" :href="api + '/auth/google'">Continue with Google</a>
        <a class="btn btn--facebook w-full" :href="api + '/auth/facebook'">Continue with Facebook</a>
      </div>

      <!-- Divider -->
      <div class="divider">or use email</div>

      <!-- Tabs -->
      <div class="pillbar mb-3">
        <button type="button" class="pill" :class="{ 'pill--active': mode==='signin' }" @click="mode='signin'">
          Sign in
        </button>
        <button type="button" class="pill" :class="{ 'pill--active': mode==='signup' }" @click="mode='signup'">
          Create account
        </button>
      </div>

      <!-- Sign in (local) -->
      <form v-if="mode==='signin'" class="flex col gap-2" @submit.prevent="onSignIn">
        <input
          class="input"
          type="text"
          v-model.trim="signin.identifier"
          placeholder="Email or Username"
          autocomplete="username"
          required
        />
        <input
          class="input"
          type="password"
          v-model="signin.password"
          placeholder="Password"
          autocomplete="current-password"
          required
        />
        <button class="btn btn--primary w-full" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <!-- Sign up (local) -->
      <form v-else class="flex col gap-2" @submit.prevent="onSignUp">
        <div class="row gap-2">
          <input class="input" type="text" v-model.trim="signup.firstName" placeholder="First name" required />
          <input class="input" type="text" v-model.trim="signup.lastName" placeholder="Last name" required />
        </div>
        <input class="input" type="email" v-model.trim="signup.email" placeholder="Email" autocomplete="email" required />
        <input class="input" type="text" v-model.trim="signup.username" placeholder="Username (optional)" autocomplete="username" />
        <input class="input" type="password" v-model="signup.password" placeholder="Password (min 8 chars)" autocomplete="new-password" required />
        <input class="input" type="password" v-model="signup.password2" placeholder="Confirm password" autocomplete="new-password" required />
        <button class="btn btn--primary w-full" :disabled="loading">
          {{ loading ? 'Creating…' : 'Create account' }}
        </button>
      </form>

      <div class="login__info">
        <p v-if="redirecting">Signing you in…</p>
        <p v-else>After authenticating, you’ll be redirected back here automatically.</p>
        <p class="login__note">
          First user to sign in becomes <span class="bold">admin</span> and is auto-authorized for the site.
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

const mode = ref('signin'); // 'signin' | 'signup'
const redirecting = ref(false);
const loading = ref(false);
const error = ref('');

const signin = ref({ identifier: '', password: '' });
const signup = ref({ firstName: '', lastName: '', email: '', username: '', password: '', password2: '' });

function validateSignup() {
  if (!signup.value.firstName || !signup.value.lastName) return 'Please enter your first and last name.';
  if (signup.value.password.length < 8) return 'Password must be at least 8 characters.';
  if (signup.value.password !== signup.value.password2) return 'Passwords do not match.';
  return '';
}

async function onSignIn() {
  try {
    error.value = '';
    loading.value = true;
    await auth.loginLocal({ identifier: signin.value.identifier, password: signin.value.password });
    router.replace('/');
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Sign in failed';
  } finally {
    loading.value = false;
  }
}

async function onSignUp() {
  try {
    error.value = '';
    const ve = validateSignup();
    if (ve) { error.value = ve; return; }
    loading.value = true;
    await auth.registerLocal({
      firstName: signup.value.firstName,
      lastName:  signup.value.lastName,
      email:     signup.value.email,
      username:  signup.value.username || undefined,
      password:  signup.value.password,
    });
    router.replace('/');
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}

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
.login {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f6fa;
  font-family: Arial, sans-serif;
}

.login__card {
  background: #fff;
  border: 1px solid #e3e6eb;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.1);
  padding: 32px 28px;
  width: 100%;
  max-width: 420px;
  text-align: center;
  animation: fadeIn 0.3s ease-out;
}

.login__subtitle {
  font-size: 15px;
  color: #666;
  margin-bottom: 20px;
}

.nav__logo {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.nav__logo img {
  height: 80px;
  width: auto;
}

.divider {
  position: relative;
  text-align: center;
  font-size: 13px;
  color: #999;
  margin: 16px 0;
}
.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #ddd;
}
.divider::before { left: 0; }
.divider::after { right: 0; }

.pillbar {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.pill {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #ddd;
  background: #f9f9f9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.pill--active {
  background: #222;
  color: #fff;
  border-color: #222;
}

.input {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 10px;
  font-size: 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: #555;
}

.btn {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}
.btn.w-full { width: 100%; }

.btn--primary {
  background: #222;
  color: #fff;
  border: none;
}
.btn--primary:disabled {
  background: #888;
  cursor: not-allowed;
}

.btn--google {
  background: #fff;
  color: #444;
  border: 1px solid #ddd;
}
.btn--facebook {
  background: #1877f2;
  color: #fff;
  border: none;
}

.login__info {
  font-size: 13px;
  color: #555;
  margin-top: 18px;
}
.login__note {
  font-size: 12px;
  color: #777;
  margin-top: 8px;
}
.bold { font-weight: 700; }

.login__error {
  color: #d93025;
  margin-top: 12px;
  font-size: 13px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>