<template>
    <div>
      <NavBar :me="me" @logout="logout" />
  
      <div class="container">
        <!-- People Card -->
        <div class="card">
          <div class="toolbar">
            <h3 class="mini-title">People</h3>
            <span class="spacer"></span>
            <button class="btn btn--primary" @click="goNew">New Person</button>
          </div>
  
          <hr class="divider" />
  
          <div class="row row--tight" style="padding: 0 12px 12px;">
            <input
              v-model="q"
              class="input input--grow"
              placeholder="Search by name, email, phone"
            />
            <button class="btn" @click="search">Search</button>
          </div>
  
          <div v-if="error" class="error" style="margin: 0 12px 12px;">{{ error }}</div>
  
          <div v-else-if="!people.length" class="empty muted">No people found.</div>
  
          <div v-else class="list" style="padding: 0 12px 12px;">
            <div v-for="p in people" :key="p._id" class="card">
              <div class="item">
                <div class="item__main">
                  <div class="item__title">
                    <img
                      v-if="p.photo"
                      :src="photoSrc(p.photo)"
                      alt=""
                      class="thumb"
                      style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid #eee;"
                    />
                    <RouterLink
                      class="name"
                      :to="{ name: 'person-edit', params: { id: p._id } }"
                    >
                      {{ p.name }}
                    </RouterLink>
                  </div>
                  <div class="meta">
                    <span v-if="p.email">Email: {{ p.email }}</span>
                    <span v-if="p.email && p.phone"> · </span>
                    <span v-if="p.phone">Phone: {{ p.phone }}</span>
                  </div>
                </div>
  
                <div class="item__actions">
                  <RouterLink
                    class="btn"
                    :to="{ name: 'person-edit', params: { id: p._id } }"
                  >
                    Edit
                  </RouterLink>
                </div>
              </div>
            </div>
          </div>
        </div> <!-- /card -->
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { useRouter, RouterLink } from 'vue-router';
  import NavBar from '../components/NavBar.vue';
  import { useAuth } from '../stores/auth.js';
  import api from '../api/index.js';
  
  const router = useRouter();
  const auth = useAuth();
  
  const me = ref(null);
  const q = ref('');
  const people = ref([]);
  const error = ref('');
  
  const logout = () => auth.logout();
  
  const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api');
  const apiOrigin = apiBase.replace(/\/api$/, '');
  const photoSrc = (p) => {
    if (!p) return '';
    if (/^(https?:)?\/\//i.test(p) || p.startsWith('data:')) return p;
    return `${apiOrigin}${p.startsWith('/') ? p : '/' + p}`;
  };
  
  const load = async () => {
    try {
      people.value = await api.get('/people', q.value ? { q: q.value } : undefined);
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to load people';
    }
  };
  
  const search = () => load();
  const goNew = () => router.push({ name: 'person-new' });
  
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

.list {
  display: grid;
  gap: 12px;
}

.card {
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
}

/* ---------- Toolbar ---------- */
.toolbar {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mini-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.divider {
  height: 1px;
  background: #eee;
  margin: 0 0 12px;
  border: none;
}

.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row--tight { justify-content: flex-start; gap: 8px; }
.spacer { margin-left: auto; }

/* ---------- Inputs ---------- */
.input,
.select,
.textarea {
  border: 1px solid #d6d6d6;
  background: #fff;
  color: #111;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}
.input { height: 34px; }
.input--grow { width: 280px; }
@media (max-width: 720px) { .input--grow { width: 100%; } }

.textarea { width: 100%; resize: vertical; }

/* ---------- Buttons ---------- */
.btn {
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
.btn:hover { background: #efefef; border-color: #cdcdcd; }
.btn:active { transform: translateY(1px); }

.btn--primary {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
.btn--primary:hover { background: #0b1220; border-color: #0b1220; }

/* ---------- People list items ---------- */
.item {
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}

.item__main { min-width: 0; }

.item__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  font-weight: 600;
  word-break: break-word;
  color: #111;
  text-decoration: none;
}
.name:hover { text-decoration: underline; }

.meta {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.item__actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
}

/* avatar/thumb (40x40 is set inline; keep shared look) */
.thumb {
  border: 1px solid #eee;
  background: #fafafa;
}

/* ---------- Empty & error ---------- */
.empty {
  padding: 14px;
  text-align: center;
}

.muted { color: #6b7280; font-size: 12px; }

.error {
  margin: 12px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffd7d5;
  padding: 10px 12px;
  border-radius: 8px;
}

/* ---------- Responsive ---------- */
@media (max-width: 760px) {
  .item { grid-template-columns: 1fr; }
}
</style>
