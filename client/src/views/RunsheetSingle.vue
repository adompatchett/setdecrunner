<!-- client/src/views/RunsheetSingle.vue -->
<template>
    <div class="max-w-4xl mx-auto p-4">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold">{{ rs?.title || 'Run Sheet' }}</h1>
          <p class="text-sm text-gray-600">
            Type: <strong class="uppercase">{{ rs?.purchaseType }}</strong>
            <span v-if="rs?.purchaseType === 'rental'">
              • Pickup: {{ fmt(rs?.pickupDate) }} • Return: {{ fmt(rs?.returnDate) }}
            </span>
          </p>
          <p v-if="rs?.takeTo" class="text-sm text-gray-600">
            Take to: <strong>{{ rs.takeTo.name }}</strong> — {{ rs.takeTo.address }}
          </p>
        </div>
        <router-link
          v-if="canEdit"
          :to="{ name: 'runsheet-edit', params: { id: rs?._id }}"
          class="px-3 py-2 rounded border"
        >Edit</router-link>
      </div>
  
      <div class="grid gap-6">
        <!-- Example sections; render your existing data -->
        <section v-if="rs?.items?.length">
          <h2 class="font-semibold mb-2">Items</h2>
          <ul class="list-disc ml-5">
            <li v-for="(it, i) in rs.items" :key="i">
              {{ it.name }} <span v-if="it.qty">× {{ it.qty }}</span>
            </li>
          </ul>
        </section>
  
        <section v-if="rs?.stops?.length">
          <h2 class="font-semibold mb-2">Stops</h2>
          <ol class="list-decimal ml-5">
            <li v-for="(s, i) in rs.stops" :key="i">
              {{ s.label || s.name }} — {{ s.address }}
            </li>
          </ol>
        </section>
  
        <section v-if="rs?.instructions">
          <h2 class="font-semibold mb-2">Instructions</h2>
          <pre class="whitespace-pre-wrap bg-gray-50 p-3 rounded">{{ rs.instructions }}</pre>
        </section>
      </div>
    </div>
  </template>
  
  <script setup>
  import { onMounted, ref, computed } from 'vue';
  import { useRoute } from 'vue-router';
  import api from '../api';
  import { useAuth } from '../stores/auth'; // adjust path
  
  const route = useRoute();
  const rs = ref(null);
  const auth = useAuth();
  
  const canEdit = computed(() => {
    // mirror your existing owner/admin logic client-side (auth guard on server is the source of truth)
    const u = auth.user;
    if (!u || !rs.value) return false;
    return u.role === 'admin' || String(rs.value.createdBy?._id || rs.value.createdBy) === String(u._id);
  });
  
  function fmt(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString();
  }
  
  onMounted(async () => {
    rs.value = await api.getRunSheet(route.params.id);
  });
  </script>
  