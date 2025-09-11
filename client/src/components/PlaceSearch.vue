<template>
    <!-- can be a fragment; declaring emits makes it fine -->
    <div>
      <input v-model="q" @input="search" placeholder="Search places…" />
      <ul v-if="results.length">
        <li
          v-for="p in results"
          :key="p._id"
          @click="pick(p)"
        >
          {{ p.name }} <small v-if="p.address">— {{ p.address }}</small>
        </li>
      </ul>
    </div>
  </template >
  
  <script setup>
  import { ref } from 'vue'
  import api from '../api.js';
  
  const emit = defineEmits(['select'])     // ← declare the event
  
  const q = ref('')
  const results = ref([])
  
  const search = async () => {
    results.value = await api.get('/tenant/places', { q: q.value })
  }
  
  const pick = (place) => {
    emit('select', place)                  // ← emit it
  }
  </script>