<template>
    <div>
      <NavBar :me="me" @logout="logout" />
  
      <div class="rs container">
        <!-- Header -->
        <div class="panel header">
          <input v-model="rs.title" class="input input--title" placeholder="Runsheet title" />
          <input type="date" v-model="dateStr" class="input input--date" />
          <select v-model="rs.status" class="select">
            <option>draft</option>
            <option>open</option>
            <option>assigned</option>
            <option>claimed</option>
            <option>in_progress</option>
            <option>completed</option>
            <option>cancelled</option>
          </select>
          <button class="btn btn--primary" @click="save" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <span class="muted saved" v-if="savedAt">Saved {{ savedAt }}</span>
        </div>
  
        <!-- Photos -->
        <section class="panel">
          <div class="row">
            <h3 class="subtitle">Photos</h3>
            <input type="file" multiple @change="uploadPhotos" />
          </div>
  
          <div class="thumbs">
            <div v-for="p in rs.photos" :key="p" class="thumb">
              <img :src="imageUrl(p)" class="thumb__img" />
              <button class="chip chip--x" @click="removePhoto(p)">×</button>
            </div>
            <div v-if="!rs.photos?.length" class="empty muted">No photos yet.</div>
          </div>
        </section>
  
        <!-- Stops -->
        <section class="panel">
          <div class="row">
            <h3 class="subtitle">Stops</h3>
            <div class="muted">Drag to reorder (hold Alt/Option); or add below</div>
          </div>
  
          <!-- Add stop via place search -->
          <PlaceSearch @select="addStop" />
  
          <div v-if="!rs.stops?.length" class="empty muted">
            No stops yet. Use the place search above to add one.
          </div>
  
          <div
            v-for="(s, sIdx) in rs.stops"
            :key="s._id || sIdx"
            class="stop card"
            draggable="true"
            @dragstart="dragStart(sIdx, $event)"
            @dragover.prevent
            @drop="dropAt(sIdx, $event)"
          >
            <div class="stop__head">
              <div class="stop__meta">
                <div class="stop__title">{{ s.title || s.place?.name || 'Stop' }}</div>
                <div class="stop__addr" v-if="s.place?.address">{{ s.place.address }}</div>
                <a
                  v-if="s.place?.lat && s.place?.lng"
                  :href="mapsUrl(s.place.lat, s.place.lng)"
                  target="_blank" rel="noopener"
                  class="link link--small"
                >Open in Google Maps</a>
              </div>
              <div class="stop__actions">
                <button class="btn btn--ghost" @click="removeStop(s._id)">Remove Stop</button>
              </div>
            </div>
  
            <textarea
              v-model="s.instructions"
              class="textarea"
              rows="2"
              placeholder="Driver instructions for this stop (dock access, hours, contact)…"
              @change="saveStop(s)"
            ></textarea>
  
            <!-- Items at stop -->
            <div class="stop__items">
              <div class="row row--tight">
                <h4 class="mini-title">Items at this stop</h4>
                <input v-model="itemSearch" placeholder="Search items…" class="input" />
                <button class="btn" @click="searchItems">Search</button>
              </div>
  
              <div class="pillbar">
                <button
                  v-for="it in itemResults"
                  :key="it._id"
                  class="pill"
                  @click="addItemToStop(s._id, it)"
                >+ {{ it.name }}</button>
              </div>
  
              <div class="items">
                <div v-for="(ri, idx) in s.items" :key="idx" class="item card">
                  <div class="item__row">
                    <div class="item__name">{{ ri.name }}</div>
                    <div class="qty">
                      <label class="muted">Qty</label>
                      <input type="number" v-model.number="ri.quantity" min="0" class="input input--qty" @change="save" />
                      <button class="btn btn--danger" @click="removeRunItem(s._id, idx)">Remove</button>
                    </div>
                  </div>
  
                  <textarea v-model="ri.notes" class="textarea" rows="2" placeholder="Notes…" @change="save"></textarea>
  
                  <div class="row row--tight">
                    <span class="muted">Photos</span>
                    <input type="file" multiple @change="(e)=>uploadRunItemPhotos(s._id, idx, e)" />
                  </div>
                  <div class="thumbs thumbs--small">
                    <img
                      v-for="p in ri.photos || []"
                      :key="p"
                      :src="imageUrl(p)"
                      class="thumb__img thumb__img--sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
  
        <!-- Assign to driver -->
        <section class="panel">
          <h3 class="subtitle">Assign to Driver</h3>
          <div class="row row--tight">
            <input v-model="userSearch" placeholder="Search users…" class="input" />
            <button class="btn" @click="searchUsers">Search</button>
            <div class="muted" v-if="rs.assignedTo">Current: {{ rs.assignedTo?.name }}</div>
          </div>
          <div class="pillbar">
            <button
              v-for="u in userResults"
              :key="u._id"
              class="pill"
              @click="assign(u)"
            >Assign {{ u.name }} ({{ u.role }})</button>
          </div>
        </section>
  
        <!-- Danger -->
        <section class="panel panel--danger">
          <div class="row">
            <RouterLink class="btn" to="/runsheets">Back to list</RouterLink>
            <button class="btn btn--danger ml-auto" @click="destroy">Delete Runsheet</button>
          </div>
        </section>
  
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import NavBar from '../components/NavBar.vue';
  import PlaceSearch from '../components/PlaceSearch.vue';
  import { useAuth } from '../stores/auth.js';
  import api from '../api/index.js';
  
  const route = useRoute();
  const router = useRouter();
  const auth = useAuth();
  
  const me = ref(null);
  const rs = ref({ title: '', status: 'draft', date: null, photos: [], stops: [] });
  const saving = ref(false);
  const savedAt = ref('');
  const error = ref('');
  
  const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api');
  const imageUrl = (p) => apiBase.replace('/api','') + p;
  const logout = () => auth.logout();
  
  const dateStr = computed({
    get() {
      if (!rs.value?.date) return '';
      const d = new Date(rs.value.date);
      if (isNaN(d)) return '';
      return d.toISOString().slice(0,10);
    },
    set(v) {
      rs.value.date = v ? new Date(v).toISOString() : null;
    }
  });
  
  const stamp = () => { savedAt.value = new Date().toLocaleTimeString(); };
  
  // Load & Save
  const load = async () => {
    try {
      rs.value = await api.get(`/runsheets/${route.params.id}`);
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to load runsheet';
    }
  };
  
  const save = async () => {
    if (!rs.value?._id) return;
    saving.value = true; error.value = '';
    try {
      rs.value = await api.patch(`/runsheets/${rs.value._id}`, rs.value);
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to save';
    } finally {
      saving.value = false;
    }
  };
  
  const destroy = async () => {
    if (!confirm('Delete this runsheet?')) return;
    try {
      await api.del(`/runsheets/${rs.value._id}`);
      router.push('/runsheets');
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to delete';
    }
  };
  
  // Photos on runsheet
  const uploadPhotos = async (e) => {
    const fd = new FormData();
    [...e.target.files].forEach(f => fd.append('photos', f));
    try {
      const resp = await api.post(`/runsheets/${rs.value._id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      rs.value.photos = resp.photos;
      stamp();
    } catch (e2) {
      error.value = e2?.response?.data?.error || 'Failed to upload photos';
    } finally {
      e.target.value = '';
    }
  };
  const removePhoto = async (url) => {
    try {
      const resp = await api.del(`/runsheets/${rs.value._id}/photos`, { url });
      rs.value.photos = resp.photos;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to remove photo';
    }
  };
  
  // Stops
  const addStop = async (place) => {
    try {
      const updated = await api.post(`/runsheets/${rs.value._id}/stops`, { place: place._id, title: place.name, instructions: '' });
      rs.value = updated;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to add stop';
    }
  };
  const saveStop = async (s) => {
    try {
      const updated = await api.patch(`/runsheets/${rs.value._id}/stops/${s._id}`, s);
      rs.value = updated;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to save stop';
    }
  };
  const removeStop = async (stopId) => {
    if (!confirm('Remove this stop?')) return;
    try {
      const updated = await api.del(`/runsheets/${rs.value._id}/stops/${stopId}`);
      rs.value = updated;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to remove stop';
    }
  };
  
  // Reorder stops (simple HTML5 drag-drop)
  let dragIndex = -1;
  const dragStart = (idx, ev) => {
    dragIndex = idx;
    if (ev?.altKey) ev.dataTransfer?.setData('text/plain', String(idx));
  };
  const dropAt = async (idx) => {
    if (dragIndex < 0 || dragIndex === idx) return;
    const arr = [...rs.value.stops];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(idx, 0, moved);
    rs.value.stops = arr;
    dragIndex = -1;
    await save();
  };
  
  // Items lookup + attach
  const itemSearch = ref('');
  const itemResults = ref([]);
  const searchItems = async () => {
    try {
      itemResults.value = await api.get('/items', { q: itemSearch.value });
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to search items';
    }
  };
  const addItemToStop = async (stopId, it) => {
    try {
      const updated = await api.post(`/runsheets/${rs.value._id}/stops/${stopId}/items`, { itemId: it._id, quantity: 1 });
      rs.value = updated;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to add item to stop';
    }
  };
  const removeRunItem = async (stopId, idx) => {
    try {
      const stop = rs.value.stops.find(s => s._id === stopId);
      if (!stop) return;
      const next = { ...stop, items: stop.items.filter((_, i) => i !== idx) };
      const updated = await api.patch(`/runsheets/${rs.value._id}/stops/${stopId}`, next);
      rs.value = updated;
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to remove run item';
    }
  };
  const uploadRunItemPhotos = async (stopId, idx, e) => {
    const fd = new FormData();
    [...e.target.files].forEach(f => fd.append('photos', f));
    try {
      await api.post(`/runsheets/${rs.value._id}/stops/${stopId}/items/${idx}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
      stamp();
    } catch (e2) {
      error.value = e2?.response?.data?.error || 'Failed to upload run-item photos';
    } finally {
      e.target.value = '';
    }
  };
  
  // Assign to driver
  const userSearch = ref('');
  const userResults = ref([]);
  const searchUsers = async () => {
    try {
      userResults.value = await api.get('/users', { q: userSearch.value });
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to search users';
    }
  };
  const assign = async (u) => {
    try {
      rs.value = await api.post(`/runsheets/${rs.value._id}/assign`, { userId: u._id });
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to assign';
    }
  };
  
  // Helpers
  const mapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  
  onMounted(async () => {
    me.value = await auth.fetchMe();
    await load();
  });
  </script>
  
  <style scoped>
  /* -------- Layout containers -------- */
  .container {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 16px;
    display: grid;
    gap: 16px;
  }
  .panel {
    background: #fff;
    border: 1px solid #ececec;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.04);
    padding: 14px 16px;
  }
  .header {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .saved { margin-left: auto; }
  
  /* -------- Typography -------- */
  .subtitle {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  .mini-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }
  .muted {
    color: #6b7280;
    font-size: 12px;
  }
  .error {
    color: #b42318;
    background: #fff1f0;
    border: 1px solid #ffd7d5;
    padding: 10px 12px;
    border-radius: 8px;
  }
  
  /* -------- Rows / spacing helpers -------- */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .row--tight {
    gap: 8px;
    justify-content: flex-start;
  }
  
  /* -------- Inputs -------- */
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
  .input--title { min-width: 260px; flex: 1 1 320px; }
  .input--date { width: 180px; }
  .input--qty { width: 72px; text-align: center; }
  .textarea { width: 100%; resize: vertical; }
  
  /* -------- Buttons / chips / links -------- */
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background .15s ease, border-color .15s ease, transform .02s ease;
  }
  .btn:hover { background: #efefef; border-color: #cdcdcd; }
  .btn:active { transform: translateY(1px); }
  .btn[disabled] { opacity: .6; cursor: not-allowed; }
  .btn--primary {
    background: #111827;
    color: #fff;
    border-color: #111827;
  }
  .btn--primary:hover { background: #0b1220; border-color: #0b1220; }
  .btn--danger {
    background: #fff;
    color: #b42318;
    border-color: #f1b3ac;
  }
  .btn--danger:hover { background: #fff5f5; border-color: #eba79f; }
  .btn--ghost {
    background: #fff;
  }
  
  .chip {
    border: 1px solid #ddd;
    background: #fff;
    color: #333;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 1.2;
  }
  .chip--x {
    position: absolute;
    top: -6px; right: -6px;
    width: 22px; height: 22px;
    border-radius: 50%;
    display: grid; place-items: center;
    cursor: pointer;
  }
  
  .link {
    color: #0f172a;
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }
  .link:hover { border-bottom-color: #0f172a; }
  .link--small { font-size: 12px; }
  
  /* -------- Thumbnails -------- */
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .thumbs--small { gap: 6px; }
  .thumb {
    position: relative;
    width: 96px; height: 96px;
    border: 1px solid #ececec;
    border-radius: 10px;
    overflow: hidden;
    background: #fafafa;
  }
  .thumb__img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb__img--sm {
    width: 64px; height: 64px;
    border: 1px solid #eee;
    border-radius: 8px;
  }
  
  /* -------- Stops -------- */
  .stop {
    margin-top: 12px;
    padding: 14px;
  }
  .stop__head {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 12px;
  }
  .stop__meta { min-width: 0; }
  .stop__title { font-weight: 600; }
  .stop__addr { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .stop__actions { display: flex; gap: 8px; }
  
  /* -------- Items in Stop -------- */
  .stop__items { margin-top: 12px; }
  .pillbar {
    display: flex; flex-wrap: wrap;
    gap: 8px; margin-bottom: 8px;
  }
  .pill {
    border: 1px solid #d6d6d6;
    background: #fff;
    color: #111;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
  }
  .pill:hover { background: #f6f6f6; }
  .items { display: grid; gap: 10px; }
  .item { padding: 10px; }
  .item__row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .item__name { font-weight: 600; min-width: 0; }
  .qty { display: inline-flex; align-items: center; gap: 8px; }
  
  /* -------- Empty states -------- */
  .empty {
    border: 1px dashed #e1e1e1;
    border-radius: 10px;
    background: #fcfcfc;
    padding: 12px;
    text-align: center;
  }
  
  /* -------- Drag cursor -------- */
  [draggable="true"] { cursor: grab; }
  [draggable="true"]:active { cursor: grabbing; }
  
  /* -------- Responsive -------- */
  @media (max-width: 720px) {
    .input--title { flex: 1 1 100%; }
    .input--date { width: 100%; }
    .stop__head { grid-template-columns: 1fr; }
    .item__row { flex-direction: column; align-items: flex-start; }
  }
  </style>
  