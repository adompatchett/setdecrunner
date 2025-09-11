<!-- client/src/views/ThankYou.vue -->
<template>
  <div class="container">
    <h1>Thanks! Finalizing your production…</h1>
    <p v-if="loading">Please wait a moment.</p>
    <p v-if="err" class="error">{{ err }}</p>
    <p v-if="slug && !loading">Redirecting to {{ slug }}…</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiGet } from '../api.js'; // same API helper you use elsewhere

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const err = ref('');
const slug = ref('');

async function init() {
  const sessionId = route.query.session_id;
  if (!sessionId) { err.value = 'Missing session id'; loading.value = false; return; }

  try {
    const data = await apiGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);

    // Save auth + tenant selection
    if (data.token) localStorage.setItem('token', data.token);
    if (data.user)  localStorage.setItem('user', JSON.stringify(data.user));
    if (data.productionId) localStorage.setItem('currentProductionId', data.productionId);
    if (data.slug) {
      localStorage.setItem('lastSlug', data.slug);
      slug.value = data.slug;
      // Route name should be whatever shows your tenant home (e.g. ':slug' layout)
      router.replace({ name: 'tenant-home', params: { slug: data.slug } });
      return;
    }

    // If somehow slug missing, show a friendly nudge (rare)
    err.value = 'Still preparing your production. Please refresh in a few seconds.';
  } catch (e) {
    err.value = e?.message || 'Could not resolve checkout session.';
  } finally {
    loading.value = false;
  }
}

onMounted(init);
</script>