<!-- client/src/views/SetPassword.vue -->
<template>
    <div class="login">
      <div class="login__card">
        <h2 class="login__title">Set your password</h2>
        <form class="flex col gap-2" @submit.prevent="submit">
          <input class="input" v-model.trim="password" type="password" placeholder="New password (min 8 chars)" required />
          <input class="input" v-model.trim="confirm" type="password" placeholder="Confirm password" required />
          <button class="btn btn--primary" :disabled="loading">{{ loading ? 'Saving…' : 'Set password' }}</button>
          <p v-if="msg" class="text-muted">{{ msg }}</p>
          <p v-if="err" class="login__error">{{ err }}</p>
        </form>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import api from '../api/index.js';
  import { useRouter, useRoute } from 'vue-router';
  
  const router = useRouter();
  const route = useRoute();
  const token = ref('');
  const email = ref('');
  const password = ref('');
  const confirm = ref('');
  const loading = ref(false);
  const msg = ref('');
  const err = ref('');
  
  onMounted(() => {
    token.value = route.query.token || '';
    email.value = route.query.email || '';
  });
  
  async function submit() {
    if (password.value.length < 8) { err.value = 'Password must be at least 8 characters'; return; }
    if (password.value !== confirm.value) { err.value = 'Passwords do not match'; return; }
    try {
      loading.value = true; err.value = ''; msg.value = '';
      await api.post('/auth/complete-reset', { token: token.value, email: email.value, password: password.value });
      msg.value = 'Password set! You can now sign in.';
      setTimeout(() => router.replace('/login'), 800);
    } catch (e) {
      err.value = e?.response?.data?.error || e.message || 'Failed to set password';
    } finally {
      loading.value = false;
    }
  }
  </script>