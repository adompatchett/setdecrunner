<template>
    <div>
      <NavBar :me="me" @logout="logout" />
  
      <div class="container">
        <h2>Sets</h2>
  
        <div class="row">
          <input v-model="q" placeholder="Search sets by name or number" />
          <button @click="search">Search</button>
          <button @click="create">New Set</button>
        </div>
  
        <div v-if="error" class="error">{{ error }}</div>
  
        <div v-if="!sets.length" class="muted">No sets found.</div>
  
        <ul>
          <li v-for="s in sets" :key="s._id">
            <RouterLink :to="{ name: 'set-edit', params: { id: s._id } }">
              {{ s.number }} — {{ s.name }}
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import NavBar from '../components/NavBar.vue';
  import { useAuth } from '../stores/auth.js';
  import api from '../api/index.js';
  
  const router = useRouter();
  const auth = useAuth();
  
  const me = ref(null);
  const q = ref('');
  const sets = ref([]);
  const error = ref('');
  
  const logout = () => auth.logout();
  
  const load = async () => {
    try {
      sets.value = await api.get('/sets', q.value ? { q: q.value } : undefined);
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to load sets';
    }
  };
  
  const search = () => load();
  
  const create = async () => {
    try {
      const created = await api.post('/sets', { name: 'Untitled Set', number: Date.now().toString().slice(-6) });
      router.push({ name: 'set-edit', params: { id: created._id } });
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to create set';
    }
  };
  
  onMounted(async () => {
    me.value = await auth.fetchMe();
    await load();
  });
  </script>
  
  <style scoped>
/* Layout */
.container {
  max-width: 980px;
  margin: 24px auto;
  padding: 0 16px;
}

h2 {
  margin: 8px 0 16px;
  font-size: 1.6rem;
  font-weight: 700;
}

/* Search / actions row */
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.row input[type="text"],
.row input:not([type]) ,
.row input {
  flex: 1 1 280px;
  min-width: 220px;
  padding: 10px 12px;
  border: 1px solid #d6d6db;
  border-radius: 10px;
  outline: none;
  background: #fff;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.row input:focus {
  border-color: #6b7cff;
  box-shadow: 0 0 0 3px rgba(107, 124, 255, 0.15);
}

.row button {
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f0f1f5;
  color: #1f2330;
  cursor: pointer;
  font-weight: 600;
  transition: background .15s ease, transform .02s ease;
}

.row button:hover {
  background: #e6e8f0;
}

.row button:active {
  transform: translateY(1px);
}

/* Make the "New Set" feel primary without extra classes */
.row button:last-child {
  background: #5868ff;
  color: #fff;
}
.row button:last-child:hover {
  background: #4454ff;
}

/* Messages */
.muted {
  color: #6b7280;
}

.error {
  margin: 8px 0 16px;
  padding: 10px 12px;
  background: #fff1f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-left: 4px solid #ef4444;
  border-radius: 8px;
}

/* List → responsive grid of cards */
ul {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

li {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  transition: box-shadow .15s ease, transform .05s ease, border-color .15s ease;
}

li:hover {
  border-color: #d1d5db;
  box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
  transform: translateY(-1px);
}

li a {
  display: block;
  padding: 14px 16px;
  text-decoration: none;
  color: #111827;
}

li a:focus {
  outline: none;
}

li a span,
li a strong {
  display: block;
}

/* Optional: style the number + name inline via the dash already in your template */
li a::before {
  /* no bullet; keep clean */
}

/* Small screens */
@media (max-width: 420px) {
  .row {
    gap: 8px;
  }
  .row button {
    flex: 0 0 auto;
  }
}
</style>
