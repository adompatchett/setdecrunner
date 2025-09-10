<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="container">
      <!-- Toolbar -->
      <div class="toolbar">
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

        <!-- Type filter -->
        <select v-model="typeFilter" class="select">
          <option value="">All types</option>
          <option value="purchase">Purchase</option>
          <option value="rental">Rental</option>
        </select>

        <input v-model="q" placeholder="Filter by title" class="input input--grow" />

        <button class="btn" @click="load" :disabled="loading">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>

        <span class="muted" v-if="lastUpdated">Updated {{ lastUpdated }}</span>
      </div>

      <!-- Lists -->
      <div v-if="loading" class="muted">Loading…</div>

      <div v-else class="list">
        <div v-for="r in filteredList" :key="r._id" class="card item">
          <!-- Left column -->
          <!-- Left column -->
<div class="item__left">
  <img
    class="thumb"
    :src="thumbFor(r)"
    :alt="r.title || 'Runsheet'"
    draggable="false"
    @error="onImgError($event)"
  />

  <div>
    <div class="item__title">
      <RouterLink class="link" :to="{ name: 'runsheet-view', params: { id: r._id } }">
        {{ r.title || 'Untitled' }}
      </RouterLink>
      <span class="badge">{{ r.status }}</span>
      <span v-if="r.purchaseType" class="badge">{{ r.purchaseType }}</span>
    </div>
    <div class="meta">
      <span>Created: {{ shortDate(r.createdAt) }}</span>
      <span v-if="r.date"> · For: {{ shortDate(r.date) }}</span>
      <span> · By: {{ r.createdBy?.name || '—' }}</span>
      <span> · Assigned: {{ r.assignedTo?.name || '—' }}</span>
    </div>
  </div>
</div>

          <!-- Right column: actions -->
          <div class="item__actions">
            <RouterLink
              class="btn"
              :to="{ name: 'runsheet-view', params: { id: r._id } }"
            >
              View Official
            </RouterLink>

            <RouterLink
              class="btn"
              :to="{ name: 'runsheet-beta', params: { id: r._id } }"
            >
              View Beta
            </RouterLink>

            <RouterLink
            class="btn"
            :to="{ name: 'runsheet-edit',params:{id: r._id}}">
          
          Edit Runsheet
          </RouterLink>

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
                  <div v-if="s.place?.address" class="stop__addr">{{ s.place.address }}</div>
                </div>
              </div>
              <div v-else class="muted">No stops yet.</div>
            </div>
          </details>
        </div>

        <div v-if="!filteredList.length" class="empty">
          No runsheets match your filters.
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import NavBar from '../components/NavBar.vue';
import api from '../api/index.js';

const router = useRouter();
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
const typeFilter = ref(''); // '', 'purchase', 'rental'
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
  // Send type to API if supported (harmless if ignored)
  if (typeFilter.value) params.purchaseType = typeFilter.value;
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

// Normalize various possible image urls (absolute, uploads path, etc.)
const rawApiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api').replace(/\/+$/, '');
const apiOrigin  = rawApiBase.replace(/\/api\/?$/, '') || window.location.origin;

function normalizeImg(src) {
  if (!src) return '';
  let p = String(src);

  // Absolute / data URI
  if (/^(?:https?:)?\/\//i.test(p) || p.startsWith('data:')) {
    if (p.startsWith('//')) return `https:${p}`;
    if (location.protocol === 'https:' && p.startsWith('http:')) p = p.replace(/^http:/i, 'https:');
    return p;
  }

  // Map filesystem-ish or relative '/uploads/...' to the API origin
  p = p.replace(/\\/g, '/');
  const idx = p.indexOf('/uploads/');
  if (idx !== -1) p = p.slice(idx);
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.startsWith('/uploads/')) p = p.replace(/^\/+/, '/uploads/');
  return `${apiOrigin}${p}`;
}

// Safely pick the first available image from different shapes
function pickFirstImage(obj) {
  if (!obj) return '';

  // Common single-image fields
  if (obj.coverImage) return obj.coverImage.url || obj.coverImage.src || obj.coverImage;
  if (obj.image)      return obj.image.url || obj.image.src || obj.image;
  if (obj.thumbnail)  return obj.thumbnail.url || obj.thumbnail.src || obj.thumbnail;
  if (obj.photo)      return obj.photo.url || obj.photo.src || obj.photo;

  // If an array of images is present
  if (Array.isArray(obj.images) && obj.images.length) {
    const first = obj.images[0];
    return first?.url || first?.src || first;
  }
  return '';
}

// Try to resolve from list item first, then from details (if already fetched), else logo
function thumbFor(r) {
  // 1) Direct fields on the runsheet row
  let url =
    pickFirstImage(r) ||
    pickFirstImage(r.firstItem || {}) ||
    // sometimes APIs include a shallow preview of items
    (Array.isArray(r.items) && r.items.length ? pickFirstImage(r.items[0]) : '');

  // 2) If not found, check details (loaded via ensureDetails)
  if (!url) {
    const d = details.value[r._id];
    if (d) {
      url =
        pickFirstImage(d) ||
        (Array.isArray(d.items) && d.items.length ? pickFirstImage(d.items[0]) : '') ||
        (Array.isArray(d.stops) && d.stops.length ? pickFirstImage(d.stops[0]) : '');
    }
  }

  // 3) Normalize or fallback to logo
  return normalizeImg(url || '/logo.png');
}

// If an image 404s, swap to logo
function onImgError(e) {
  if (!e?.target) return;
  if (e.target.dataset.fallback) return; // prevent loops
  e.target.dataset.fallback = '1';
  e.target.src = '/logo.png';
}


const createRS = async () => {
  creating.value = true; error.value = '';
  try {
    const rs = await api.post('/runsheets', { title: 'Untitled', status: 'draft' });
    router.push({ name: 'runsheet-edit', params: { id: rs._id } });
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
  return (list.value || []).filter((r) => {
    const titleOk = !term || (r.title || '').toLowerCase().includes(term);
    const typeOk = !typeFilter.value || (r.purchaseType || '').toLowerCase() === typeFilter.value;
    return titleOk && typeOk;
  });
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

// Reload when server-backed filters change
watch([mine, assignedToMe, open, statusFilter, typeFilter], load);

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
:root{
  --bg:#0f1113;
  --panel:#14171a;
  --elev:#191d21;
  --ink:#f5f6f7;
  --muted:#a4a8ae;
  --line:#2c3137;
  --line-light:#3a4047;
  --accent:#ffffff;
  --focus:#ffffff;
  --shadow-soft:0 6px 16px rgba(0,0,0,.25);
  --shadow-inset:inset 0 1px 0 rgba(255,255,255,.04);
}

*{box-sizing:border-box}
.container{
  max-width:1200px;margin:0 auto;padding:18px 20px 28px;
  background:var(--bg);color:var(--ink);
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif;
}

/* Toolbar */
.toolbar{
  display:grid;grid-template-columns:auto auto auto auto auto 1fr auto auto;
  gap:10px;align-items:center;
  background:var(--panel);border:1px solid var(--line-light);border-radius:12px;
  padding:12px;margin-bottom:16px;box-shadow:var(--shadow-soft);
}
.toolbar .muted{color:var(--muted)}
.input--grow{width:100%}

/* Cards/List */
.list{display:grid;gap:12px}
.card{
  background:var(--panel);border:1px solid var(--line-light);
  border-radius:12px;box-shadow:var(--shadow-soft);
}
.item{
  display:grid;grid-template-columns:1fr auto;gap:14px;padding:16px;
}
.item__title{
  display:flex;align-items:baseline;gap:10px;font-weight:700;letter-spacing:.2px;
}
.link{
  color:var(--accent);text-decoration:none;border-bottom:1px solid transparent;
}
.link:hover{border-bottom-color:var(--accent)}
.meta{margin-top:6px;color:var(--muted);font-size:12px;letter-spacing:.2px}
.badge{
  display:inline-block;padding:4px 9px;border-radius:999px;font-size:11px;
  text-transform:uppercase;letter-spacing:.6px;color:var(--ink);
  background:var(--elev);border:1px solid var(--line-light);
}

/* Buttons */
.btn,a.btn,.router-link-active.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
  text-decoration:none;user-select:none;cursor:pointer;
  background-color:transparent;color:var(--ink);
  border:1px solid var(--line-light);border-radius:10px;padding:9px 12px;
  font-weight:700;letter-spacing:.3px;
  transition:transform .04s ease,filter .12s ease,box-shadow .12s ease,border-color .12s ease,background-color .12s ease;
  box-shadow:var(--shadow-inset);
}
.btn:hover,a.btn:hover{background-color:rgba(255,255,255,.06)}
.btn:active,a.btn:active{transform:translateY(1px)}
.btn:disabled,a.btn[aria-disabled="true"]{opacity:.65;cursor:not-allowed}
.btn--primary{
  background-color:var(--accent);color:#111;border-color:#dcdcdc;
  box-shadow:0 4px 10px rgba(0,0,0,.25);
}
.btn--primary:hover{filter:brightness(.96)}
.btn--danger{background:#f4f4f4;color:#000;border-color:#dcdcdc}

/* Inputs & Selects */
.input,.select{
  width:100%;background:var(--elev);color:var(--ink);
  border:1px solid var(--line-light);border-radius:10px;padding:9px 11px;
  outline:none;box-shadow:var(--shadow-inset);
}
.input::placeholder{color:var(--muted)}
.input:focus,.select:focus{
  border-color:var(--focus);
  box-shadow:0 0 0 2px rgba(255,255,255,.08),var(--shadow-inset);
}

/* Checkboxes (black border) */
.check{display:inline-flex;align-items:center;gap:8px;color:var(--ink);user-select:none}
.check input[type="checkbox"]{
  appearance:none;width:18px;height:18px;cursor:pointer;
  border:2px solid #000;border-radius:4px;background:var(--elev);
  position:relative;box-shadow:var(--shadow-inset);
}
.check input[type="checkbox"]:checked{
  background:var(--accent);border-color:#000;
}
.check input[type="checkbox"]:checked::after{
  content:"";position:absolute;left:5px;top:2px;width:6px;height:10px;
  border:solid #111;border-width:0 2px 2px 0;transform:rotate(45deg);
}

/* Actions column */
.item__actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end}

/* Inline Assign Panel */
.assign{
  background:var(--panel);border:1px dashed var(--line-light);border-top:none;
  padding:12px;border-radius:0 0 12px 12px;box-shadow:var(--shadow-soft) inset;
}
.assign__row{display:grid;grid-template-columns:1fr 300px auto auto;gap:10px}
.error{
  color:#fff;background:#101216;border:1px solid var(--line-light);
  padding:8px 10px;border-radius:10px;margin-top:10px;box-shadow:var(--shadow-soft);
}

/* Peek (details) */
.peek{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.peek>summary{cursor:pointer;list-style:none;color:var(--ink);font-weight:700}
.peek>summary::-webkit-details-marker{display:none}
.peek__body{
  margin-top:10px;background:var(--elev);border:1px solid var(--line-light);
  border-radius:12px;padding:12px;box-shadow:var(--shadow-soft);
}
.stops{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:8px;
}
.stop{border:1px solid var(--line-light);border-radius:10px;padding:10px;background:#15181c;box-shadow:var(--shadow-inset)}
.stop__title{font-weight:700}
.stop__addr{color:var(--muted);font-size:12px}

/* Empty state */
.empty{
  text-align:center;color:var(--muted);padding:30px 10px;
  border:1px dashed var(--line-light);border-radius:12px;background:#111418;
  box-shadow:var(--shadow-soft) inset;
}
.muted{color:var(--muted)}

/* Focus ring */
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}

/* Thumbnail block */
.item__left{
  display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:start;
}
.thumb{
  width:72px;height:72px;border-radius:8px;object-fit:cover;object-position:center;
  background:#fff;border:1px solid var(--line-light,#3a4047);
  box-shadow:0 4px 12px rgba(0,0,0,.25);user-select:none;
}

/* Responsive */
@media (max-width:980px){
  .toolbar{grid-template-columns:1fr 1fr auto;grid-auto-rows:min-content}
  .item{grid-template-columns:1fr}
  .item__actions{justify-content:flex-start}
  .assign__row{grid-template-columns:1fr}
}
</style>





  
  