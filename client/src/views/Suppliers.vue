<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="container">
      <h2>Suppliers</h2>

      <div class="row">
        <input v-model="q" placeholder="Search suppliers by name, address, contact" />
        <button @click="search">Search</button>
        <!-- Just navigate; don't create here -->
        <button @click="goNew">New Supplier</button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="!suppliers.length" class="muted">No suppliers found.</div>

      <ul>
        <li v-for="s in suppliers" :key="s._id">
          <RouterLink :to="{ name: 'supplier-edit', params: { id: s._id } }">
            {{ s.name }} — {{ s.address }}
          </RouterLink>
          <div class="muted">
            <span v-if="s.contactName">Contact: {{ s.contactName }} · </span>
            <span v-if="s.phone">Tel: {{ s.phone }}</span>
          </div>
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
const suppliers = ref([]);
const error = ref('');

const logout = () => auth.logout();

const load = async () => {
  try {
    suppliers.value = await api.get('/suppliers', q.value ? { q: q.value } : undefined);
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to load suppliers';
  }
};

const search = () => load();

// Navigate to the dedicated "new" route
const goNew = () => {
  router.push({ name: 'supplier-new' });
};

onMounted(async () => {
  me.value = await auth.fetchMe();
  await load();
});
</script>

<style scoped>
/* ---------- Layout ---------- */
.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 16px;
}

h2 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

/* ---------- Inputs ---------- */
.input,
select,
.textarea,
:where(input[type="text"], input[type="search"], input:not([type])) {
  border: 1px solid #d6d6d6;
  background: #fff;
  color: #111;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}
:where(input[type="text"], input[type="search"], input:not([type])) { height: 34px; }
:where(input[type="text"], input[type="search"], input:not([type])) { width: 280px; }
@media (max-width: 720px) {
  :where(input[type="text"], input[type="search"], input:not([type])) { width: 100%; }
}

/* ---------- Buttons ---------- */
.btn,
button {
  appearance: none;
  border: 1px solid #d6d6d6;
  background: #f7f7f7;
  color: #1f2937;
  font: inherit;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: background .15s ease, border-color .15s ease, transform .02s ease;
}
.btn:hover,
button:hover { background: #efefef; border-color: #cdcdcd; }
.btn:active,
button:active { transform: translateY(1px); }

/* Optional primary style if you add class="btn btn--primary" later */
.btn--primary {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
.btn--primary:hover { background: #0b1220; border-color: #0b1220; }

/* ---------- List ---------- */
ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 12px;
}
li {
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  padding: 12px 14px;
}
li > a {
  color: #111827;
  text-decoration: none;
  font-weight: 600;
}
li > a:hover { text-decoration: underline; }
li .muted { margin-top: 4px; }

/* ---------- Helpers ---------- */
.muted { color: #6b7280; font-size: 12px; }
.error {
  margin-top: 12px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffd7d5;
  padding: 10px 12px;
  border-radius: 8px;
}

/* ---------- Responsive ---------- */
@media (max-width: 760px) {
  .row { gap: 8px; }
}
</style>
