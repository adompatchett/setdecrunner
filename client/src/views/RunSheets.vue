<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="container">
      <!-- Toolbar -->
      <div class="toolbar card">
        <button class="btn btn--primary" @click="createRS" :disabled="creating">
          {{ creating ? 'Creating…' : 'New Run Sheet' }}
        </button>

        <select v-model="statusFilter" class="select">
          <option value="">All statuses</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>

        <label class="check">
          <input type="checkbox" v-model="mine" />
          <span>Mine</span>
        </label>
        <label class="check">
          <input type="checkbox" v-model="assignedToMe" />
          <span>Assigned to me</span>
        </label>
        <label class="check">
          <input type="checkbox" v-model="open" />
          <span>Open pool</span>
        </label>

        <div class="spacer"></div>

        <input v-model="q" placeholder="Filter by title" class="input input--grow" />
        <button class="btn" @click="load" :disabled="loading">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
        <span class="muted" v-if="lastUpdated">Updated {{ lastUpdated }}</span>
      </div>

      <!-- Lists -->
      <div v-if="loading" class="muted">Loading…</div>

      <div v-else class="list">
        <div
          v-for="r in filteredList"
          :key="r._id"
          class="card item"
        >
          <div class="item__left">
            <div class="item__title">
              <RouterLink class="link" :to="'/runsheets/'+r._id">{{ r.title || 'Untitled' }}</RouterLink>
              <span class="badge">{{ r.status }}</span>
            </div>
            <div class="meta">
              <span>Created: {{ shortDate(r.createdAt) }}</span>
              <span v-if="r.date">For: {{ shortDate(r.date) }}</span>
              <span>By: {{ r.createdBy?.name || '—' }}</span>
              <span>Assigned: {{ r.assignedTo?.name || '—' }}</span>
            </div>
          </div>

          <div class="item__actions">
            <RouterLink class="btn" :to="'/runsheets/'+r._id">Open</RouterLink>

            <!-- Claim (open + unassigned) -->
            <button
              v-if="r.status==='open' && !r.assignedTo"
              class="btn"
              :disabled="busyId===r._id"
              @click="claim(r)"
            >Claim</button>

            <!-- Start / Complete -->
            <button
              v-if="r.status==='assigned' || r.status==='claimed'"
              class="btn"
              :disabled="busyId===r._id"
              @click="setStatus(r,'in_progress')"
            >Start</button>

            <button
              v-if="r.status==='in_progress'"
              class="btn"
              :disabled="busyId===r._id"
              @click="setStatus(r,'completed')"
            >Complete</button>

            <!-- Admin: Assign / Reassign -->
            <button
              v-if="me?.isAdmin && canShowAssign(r)"
              class="btn"
              :disabled="busyId===r._id"
              @click="toggleAssign(r)"
            >
              {{ r.assignedTo ? 'Reassign' : 'Assign' }}
            </button>

            <!-- Assignee (or Admin) can release back to open -->
            <button
              v-if="canRelease(r)"
              class="btn"
              :disabled="busyId===r._id"
              @click="release(r)"
            >
              Release
            </button>

            <!-- Delete -->
            <button
              class="btn btn--danger"
              :disabled="busyId===r._id"
              @click="del(r)"
            >Delete</button>
          </div>

          <!-- Inline Assign Panel -->
          <div v-if="assignOpenId===r._id" class="assign card">
            <div class="assign__row">
              <input
                v-model="userQuery"
                class="input"
                placeholder="Search users by name or email"
                @input="debouncedFetchUsers()"
              />
              <select v-model="selectedUserId" class="select">
                <option disabled value="">Select user…</option>
                <option
                  v-for="u in users"
                  :key="u._id"
                  :value="u._id"
                >
                  {{ u.name }} <span v-if="u.email">({{ u.email }})</span>
                </option>
              </select>
              <button
                class="btn btn--primary"
                :disabled="!selectedUserId || busyId===r._id"
                @click="assign(r)"
              >
                Assign
              </button>
              <button class="btn" @click="toggleAssign()">
                Cancel
              </button>
            </div>
            <p v-if="assignError" class="error">{{ assignError }}</p>
          </div>

          <!-- Peek: stops -->
          <details class="peek" @toggle="(e)=> e.target.open && ensureDetails(r)">
            <summary>Preview</summary>
            <div v-if="details[r._id]" class="peek__body">
              <div><strong>Stops:</strong> {{ details[r._id].stops?.length || 0 }}</div>
              <div v-if="details[r._id].stops?.length" class="stops">
                <div v-for="s in details[r._id].stops" :key="s._id" class="stop">
                  <div class="stop__title">{{ s.title || s.place?.name }}</div>
                  <div class="stop__addr" v-if="s.place?.address">{{ s.place.address }}</div>
                </div>
              </div>
              <div v-else class="muted">No stops yet.</div>
            </div>
          </details>
        </div>

        <div v-if="!filteredList.length" class="card empty">
          No runsheets match your filters.
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import NavBar from '../components/NavBar.vue';
import api from '../api/index.js';

const auth = useAuth();
const me = ref(null);

const list = ref([]);
const loading = ref(false);
const error = ref('');
const creating = ref(false);
const busyId = ref('');
const details = ref({});
const lastUpdated = ref('');

const mine = ref(false);
const assignedToMe = ref(false);
const open = ref(false);
const statusFilter = ref('');
const q = ref('');

const statuses = ['draft','open','assigned','claimed','in_progress','completed','cancelled'];

const logout = () => auth.logout();

const stamp = () => { lastUpdated.value = new Date().toLocaleTimeString(); };

const paramsForLoad = () => {
  const params = {};
  if (mine.value) params.mine = 1;
  if (assignedToMe.value) params.assignedToMe = 1;
  if (open.value) params.open = 1;
  if (statusFilter.value) params.status = statusFilter.value;
  return params;
};

const load = async () => {
  loading.value = true; error.value = '';
  try {
    list.value = await api.get('/runsheets', paramsForLoad());
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Failed to load runsheets';
  } finally {
    loading.value = false;
  }
};

const createRS = async () => {
  creating.value = true; error.value = '';
  try {
    const rs = await api.post('/runsheets', { title: 'Untitled', status: 'draft' });
    location.href = `/runsheets/${rs._id}`;
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to create runsheet';
  } finally {
    creating.value = false;
  }
};

const claim = async (r) => {
  busyId.value = r._id; error.value = '';
  try {
    await api.post(`/runsheets/${r._id}/claim`);
    await load();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not claim runsheet';
  } finally {
    busyId.value = '';
  }
};

const setStatus = async (r, status) => {
  busyId.value = r._id; error.value = '';
  try {
    await api.patch(`/runsheets/${r._id}`, { status });
    await load();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not update status';
  } finally {
    busyId.value = '';
  }
};

const del = async (r) => {
  if (!confirm(`Delete runsheet "${r.title}"?`)) return;
  busyId.value = r._id; error.value = '';
  try {
    await api.del(`/runsheets/${r._id}`);
    await load();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to delete';
  } finally {
    busyId.value = '';
  }
};

const ensureDetails = async (r) => {
  if (details.value[r._id]) return;
  try {
    details.value[r._id] = await api.get(`/runsheets/${r._id}`);
  } catch {}
};

const filteredList = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return list.value;
  return list.value.filter(r => (r.title || '').toLowerCase().includes(term));
});

const shortDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString();
};

onMounted(async () => {
  me.value = await auth.fetchMe();
  await load();
});

watch([mine, assignedToMe, open, statusFilter], load);

/* ---------- Assignment UX + actions ---------- */
const assignOpenId = ref('');
const users = ref([]);
const userQuery = ref('');
const selectedUserId = ref('');
const assignError = ref('');

let assignTimer;
const debouncedFetchUsers = (delay = 300) => {
  clearTimeout(assignTimer);
  assignTimer = setTimeout(fetchUsers, delay);
};

const toggleAssign = async (r = null) => {
  assignError.value = '';
  users.value = [];
  selectedUserId.value = '';
  userQuery.value = '';
  assignOpenId.value = r ? r._id : '';
  if (r) await fetchUsers(); // initial load
};

const fetchUsers = async () => {
  try {
    users.value = await api.get('/users', {
      q: userQuery.value?.trim() || '',
      limit: 20,
    });
  } catch (e) {
    assignError.value = e?.response?.data?.error || 'Failed to load users';
  }
};

const assign = async (r) => {
  if (!selectedUserId.value) return;
  busyId.value = r._id; assignError.value = '';
  try {
    await api.post(`/runsheets/${r._id}/assign`, { userId: selectedUserId.value });
    await load();
    toggleAssign(); // close
  } catch (e) {
    assignError.value = e?.response?.data?.error || 'Could not assign';
  } finally {
    busyId.value = '';
  }
};

const canShowAssign = (r) => {
  if (!r) return false;
  if (['completed','cancelled'].includes(r.status)) return false;
  return ['open','assigned','claimed','draft','in_progress'].includes(r.status);
};

const canRelease = (r) => {
  if (!r) return false;
  if (['completed','cancelled'].includes(r.status)) return false;
  const isAssignee = r.assignedTo?._id === me.value?._id;
  return isAssignee || !!me.value?.isAdmin;
};

const release = async (r) => {
  busyId.value = r._id; error.value = '';
  try {
    await api.post(`/runsheets/${r._id}/release`);
    await load();
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not release';
  } finally {
    busyId.value = '';
  }
};
</script>

<style scoped>
/* Layout shells (keep light; assume global app styles exist) */
.container { max-width: 1100px; margin: 0 auto; padding: 16px; }
.card {
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.toolbar {
  display: flex; gap: 10px; align-items: center; margin-bottom: 14px;
  flex-wrap: wrap;
}
.spacer { flex: 1; }
.input { padding: 8px 10px; border: 1px solid #d0d4d9; border-radius: 6px; }
.input--grow { min-width: 240px; flex: 1; }
.select { padding: 8px 10px; border: 1px solid #d0d4d9; border-radius: 6px; background: #fff; }
.check { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #333; }
.btn {
  padding: 8px 12px; border: 1px solid #cfd3d8; border-radius: 6px;
  background: #f8f9fb; cursor: pointer; font-weight: 600;
}
.btn:hover { background: #f1f3f6; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn--primary { background: #0d6efd; border-color: #0d6efd; color: #fff; }
.btn--primary:hover { background: #0b5ed7; }
.btn--danger { background: #ffefef; border-color: #ffd2d2; color: #c00; }
.link { text-decoration: none; color: #0d6efd; }
.muted { color: #6b7280; font-size: 13px; }
.badge {
  margin-left: 8px; font-size: 12px; padding: 2px 6px; border-radius: 999px;
  background: #eef2ff; color: #374151; border: 1px solid #e5e7eb;
}

/* List items */
.list { display: grid; gap: 10px; }
.item { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
.item__title { font-size: 16px; font-weight: 700; display: flex; align-items: center; }
.meta { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 10px; color: #4b5563; font-size: 13px; }
.item__actions { display: flex; gap: 8px; align-items: center; }

/* Assign panel */
.assign { margin-top: 10px; padding: 12px; background: #fbfdff; }
.assign__row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.assign .input, .assign .select { min-width: 220px; }
.error { color: #b42318; margin-top: 8px; }

/* Preview */
.peek { margin-top: 8px; }
.peek summary { cursor: pointer; color: #374151; }
.peek__body { padding-top: 8px; }
.stops { display: grid; gap: 6px; margin-top: 6px; }
.stop { padding: 8px; border: 1px dashed #e5e7eb; border-radius: 6px; background: #fafafa; }
.stop__title { font-weight: 600; }
.stop__addr { color: #6b7280; font-size: 13px; }

/* Empty state */
.empty { text-align: center; color: #6b7280; padding: 24px; }
</style>

  
  