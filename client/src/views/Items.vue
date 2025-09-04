<template>
    <div>
      <NavBar :me="me" @logout="logout" />
  
      <div class="container">
        <!-- Toolbar -->
        <div class="toolbar card">
          <input v-model="q" placeholder="Search items (name, text index)" class="input input--grow" />
          <select v-model="filterPlaceId" class="select">
            <option :value="''">All places</option>
            <option v-for="p in placeFilterOpts" :key="p._id" :value="p._id">{{ p.name }}</option>
          </select>
          <button class="btn" @click="load">Search</button>
          <button class="btn btn--primary" @click="createItem">New Item</button>
          <span class="spacer"></span>
          <span class="muted" v-if="lastUpdated">Updated {{ lastUpdated }}</span>
        </div>
  
        <!-- List -->
        <div v-if="loading" class="muted">Loading…</div>
  
        <div v-else class="list">
          <div v-for="it in list" :key="it._id" class="card item">
            <div class="item__main">
              <div class="item__title">
                <div class="name">{{ it.name }}</div>
                <span class="qty">(x{{ it.quantity }})</span>
              </div>
              <div class="meta" v-if="it.location?.name">{{ it.location.name }}</div>
              <div class="desc" v-if="it.description">{{ it.description }}</div>
  
              <div class="thumbs">
                <img
                  v-for="p in it.photos || []"
                  :key="p"
                  :src="imageUrl(p)"
                  class="thumb"
                  alt="Item photo"
                />
              </div>
            </div>
  
            <div class="item__actions">
              <button class="btn" @click="edit(it)">Edit</button>
              <button class="btn btn--danger" @click="del(it)">Delete</button>
            </div>
          </div>
  
          <div v-if="!list.length && !loading" class="card empty muted">
            No items found. Try a different search.
          </div>
        </div>
  
        <!-- Editor Modal -->
        <div v-if="editing" class="modal">
          <div class="modal__card">
            <div class="modal__head">
              <h3 class="title">{{ editing._id ? 'Edit Item' : 'New Item' }}</h3>
              <button class="btn" @click="editing=null">Close</button>
            </div>
  
            <div class="grid">
              <div class="field">
                <label class="label">Name</label>
                <input v-model="editing.name" class="input" placeholder="Lamp, sofa, etc." />
              </div>
  
              <div class="field">
                <label class="label">Quantity</label>
                <input type="number" v-model.number="editing.quantity" min="0" class="input" />
              </div>
  
              <div class="field field--full">
                <label class="label">Description</label>
                <textarea v-model="editing.description" rows="3" class="textarea" placeholder="Notes, condition, color, measurements…"></textarea>
              </div>
  
              <!-- Location Picker -->
              <div class="divider field--full"></div>
              <div class="field field--full">
                <div class="row">
                  <div class="mini-title">Location</div>
                  <div class="muted">Selected: {{ editing.location?.name || '(none)' }}</div>
                </div>
                <div class="row row--tight">
                  <input v-model="placeQ" placeholder="Search places…" class="input input--grow" />
                  <button class="btn" @click="searchPlaces">Search</button>
                  <button v-if="editing.location" class="btn" @click="clearLocation">Clear</button>
                </div>
                <div class="pillbar">
                  <button
                    v-for="p in placeResults"
                    :key="p._id"
                    class="pill"
                    @click="setLocation(p)"
                  >
                    {{ p.name }}
                  </button>
                </div>
              </div>
  
              <!-- Photos -->
              <div class="divider field--full"></div>
              <div class="field field--full">
                <div class="row row--tight">
                  <div class="mini-title">Photos</div>
                  <input type="file" multiple @change="uploadItemPhotos" />
                </div>
                <div class="thumbs thumbs--edit">
                  <div v-for="p in editing.photos || []" :key="p" class="thumbwrap">
                    <img :src="imageUrl(p)" class="thumb thumb--lg" />
                    <button class="chip chip--x" @click="removeItemPhoto(p)">×</button>
                  </div>
                </div>
              </div>
            </div>
  
            <div class="modal__foot">
              <button class="btn btn--primary" @click="save" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
            </div>
          </div>
        </div>
  
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import NavBar from '../components/NavBar.vue';
  import { useAuth } from '../stores/auth.js';
  import api from '../api/index.js';
  
  const auth = useAuth();
  const me = ref(null);
  const q = ref('');
  const filterPlaceId = ref('');
  const placeFilterOpts = ref([]);
  const list = ref([]);
  const loading = ref(false);
  const error = ref('');
  const lastUpdated = ref('');
  const editing = ref(null);
  const saving = ref(false);
  
  const placeQ = ref('');
  const placeResults = ref([]);
  
  const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:4000/api');
  
  const logout = () => auth.logout();
  const imageUrl = (p) => apiBase.replace('/api','') + p;
  
  const stamp = () => { lastUpdated.value = new Date().toLocaleTimeString(); };
  
  const loadPlacesForFilter = async () => {
    try {
      placeFilterOpts.value = await api.get('/places', { q: '' });
    } catch {}
  };
  
  const load = async () => {
    loading.value = true; error.value = '';
    try {
      const params = { q: q.value };
      if (filterPlaceId.value) params.placeId = filterPlaceId.value;
      list.value = await api.get('/items', params);
      stamp();
    } catch (e) {
      error.value = e?.response?.data?.error || e.message || 'Failed to load items';
    } finally {
      loading.value = false;
    }
  };
  
  const createItem = () => {
    editing.value = { name: 'Untitled', quantity: 1, description: '', photos: [], location: null };
  };
  
  const edit = (it) => {
    editing.value = JSON.parse(JSON.stringify(it)); // clone
  };
  
  const save = async () => {
    if (!editing.value?.name?.trim()) { error.value = 'Name is required'; return; }
    saving.value = true; error.value = '';
    try {
      const payload = { ...editing.value };
      if (payload.location && payload.location._id) payload.location = payload.location._id;
      if (!payload.photos) payload.photos = [];
      if (editing.value._id) {
        editing.value = await api.patch(`/items/${editing.value._id}`, payload);
      } else {
        editing.value = await api.post('/items', payload);
      }
      await load();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to save';
    } finally {
      saving.value = false;
    }
  };
  
  const del = async (it) => {
    if (!confirm(`Delete "${it.name}"?`)) return;
    try {
      await api.del(`/items/${it._id}`);
      await load();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to delete';
    }
  };
  
  // Photos (requires existing _id)
  const uploadItemPhotos = async (e) => {
    if (!editing.value?._id) {
      await save();
      if (!editing.value?._id) return;
    }
    const fd = new FormData();
    [...e.target.files].forEach(f => fd.append('photos', f));
    try {
      const it = await api.post(`/items/${editing.value._id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      editing.value = it;
      await load();
    } catch (e2) {
      error.value = e2?.response?.data?.error || 'Failed to upload photos';
    } finally {
      e.target.value = '';
    }
  };
  
  const removeItemPhoto = async (url) => {
    try {
      const it = await api.del(`/items/${editing.value._id}/photos`, { url });
      editing.value = it;
      await load();
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to remove photo';
    }
  };
  
  // Location helpers
  const searchPlaces = async () => {
    try {
      placeResults.value = await api.get('/places', { q: placeQ.value });
    } catch (e) {
      error.value = e?.response?.data?.error || 'Failed to search places';
    }
  };
  const setLocation = (p) => { editing.value.location = p; };
  const clearLocation = () => { editing.value.location = null; };
  
  onMounted(async () => {
    me.value = await auth.fetchMe();
    await Promise.all([load(), loadPlacesForFilter()]);
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
  
  .toolbar {
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  
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
  .spacer { margin-left: auto; }
  
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
  .btn--danger {
    background: #fff;
    color: #b42318;
    border-color: #f1b3ac;
  }
  .btn--danger:hover { background: #fff5f5; border-color: #eba79f; }
  
  /* ---------- Item cards ---------- */
  .item {
    padding: 14px 16px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
  }
  .item__main { min-width: 0; }
  .item__actions {
    display: flex; gap: 8px; align-items: flex-start; justify-content: flex-end;
  }
  .item__title { display: flex; align-items: baseline; gap: 8px; }
  .name { font-weight: 600; word-break: break-word; }
  .qty { font-size: 12px; color: #6b7280; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .desc { margin-top: 6px; white-space: pre-wrap; font-size: 14px; color: #1f2937; }
  
  .thumbs {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .thumb {
    width: 56px; height: 56px;
    object-fit: cover;
    border: 1px solid #eee;
    border-radius: 8px;
    background: #fafafa;
  }
  
  /* ---------- Empty state ---------- */
  .empty {
    padding: 14px;
    text-align: center;
  }
  
  /* ---------- Modal ---------- */
  .modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.4);
    display: grid; place-items: center;
    z-index: 50;
  }
  .modal__card {
    background: #fff;
    width: 100%;
    max-width: 720px;
    border-radius: 12px;
    border: 1px solid #ececec;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .modal__head,
  .modal__foot {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .title { font-size: 18px; font-weight: 600; margin: 0; }
  
  /* ---------- Editor grid ---------- */
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 12px;
  }
  .field { display: grid; gap: 6px; }
  .field--full { grid-column: 1 / -1; }
  .label { font-size: 12px; color: #6b7280; }
  .mini-title { font-size: 14px; font-weight: 600; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .row--tight { justify-content: flex-start; gap: 8px; }
  .divider { height: 1px; background: #eee; margin: 8px 0; border: none; }
  
  /* ---------- Editor photos ---------- */
  .thumbs--edit { gap: 10px; margin-top: 8px; }
  .thumbwrap { position: relative; width: 80px; height: 80px; }
  .thumb--lg {
    width: 100%; height: 100%;
    border-radius: 10px; border: 1px solid #ececec; object-fit: cover; background: #fafafa;
  }
  .chip {
    position: absolute; top: -6px; right: -6px;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #dcdcdc;
    display: grid; place-items: center;
    cursor: pointer;
  }
  .chip--x { font-weight: 600; }
  
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
    .item { grid-template-columns: 1fr; }
    .modal__card { max-width: 94vw; }
    .grid { grid-template-columns: 1fr; }
  }
  </style>
  