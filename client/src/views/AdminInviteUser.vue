<!-- client/src/views/AdminInviteUser.vue -->
<template>
    <div class="panel">
      <h2>Invite User</h2>
      <form class="flex col gap-2" @submit.prevent="submit">
        <div class="row gap-2">
          <input class="input" v-model.trim="form.firstName" placeholder="First name" />
          <input class="input" v-model.trim="form.lastName" placeholder="Last name" />
        </div>
        <input class="input" v-model.trim="form.email" type="email" placeholder="Email" required />
        <input class="input" v-model.trim="form.username" placeholder="Username (optional)" />
        <div class="row gap-2">
          <select class="select" v-model="form.role">
            <option value="user">User</option>
            <option value="driver">Driver</option>
            <option value="admin">Admin</option>
          </select>
          <label class="chip">
            <input type="checkbox" v-model="form.siteAuthorized" />
            <span>Site Authorized</span>
          </label>
        </div>
        <button class="btn btn--primary" :disabled="loading">{{ loading ? 'Sending…' : 'Invite' }}</button>
        <p v-if="msg" class="text-muted">{{ msg }}</p>
        <p v-if="err" class="login__error">{{ err }}</p>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useAdmin } from '../admin.js';
  
  const admin = useAdmin();
  const loading = ref(false);
  const msg = ref('');
  const err = ref('');
  const form = ref({
    firstName: '', lastName: '', email: '', username: '',
    role: 'user', siteAuthorized: false
  });
  
  async function submit() {
    try {
      loading.value = true; err.value = ''; msg.value = '';
      await admin.inviteUser(form.value);
      msg.value = 'Invitation sent!';
      form.value = { firstName:'', lastName:'', email:'', username:'', role:'user', siteAuthorized:false };
    } catch (e) {
      err.value = e?.response?.data?.error || e.message || 'Failed to send invite';
    } finally {
      loading.value = false;
    }
  }
  </script>