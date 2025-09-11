<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="driver-page">
      <!-- Controls -->
      <div class="toolbar card">
        <button class="btn btn--primary" @click="load" :disabled="loading">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>

        <label class="check">
          <input type="checkbox" v-model="autoRefresh" />
          <span>Auto-refresh (15s)</span>
        </label>

        <span v-if="lastUpdated" class="toolbar__stamp">Updated {{ lastUpdated }}</span>
      </div>

      <!-- Assigned to me -->
      <section class="section">
        <h2 class="h2">Assigned to Me</h2>

        <div v-if="myList.length === 0" class="empty card small">
          Nothing assigned yet.
        </div>

        <div class="stack">
          <div v-for="r in myList" :key="r._id" class="runsheet card">
            <div class="runsheet__head">
              <div class="runsheet__meta">
                <div class="runsheet__title">{{ r.title }}</div>
                <div class="small">
                  Status:
                  <span class="pill"
                        :class="{
                          'pill--ok': r.status==='completed',
                          'pill--warn': r.status==='assigned' || r.status==='claimed',
                          'pill--info': r.status==='in_progress'
                        }">
                    {{ r.status.toUpperCase() }}
                  </span>
                </div>
                <div class="small" v-if="r.assignedTo?.name">
                  Driver: {{ r.assignedTo.name }}
                </div>
              </div>

              <div class="runsheet__actions">
                <RouterLink
                  class="btn btn--ghost"
                  :to="{ name: 'runsheet-view', params: { slug, id: r._id } }"
                >
                  Open
                </RouterLink>

                <button
                  v-if="r.status==='assigned' || r.status==='claimed'"
                  class="btn"
                  :disabled="busyId===r._id"
                  @click="setStatus(r,'in_progress')"
                >
                  Start
                </button>
                <button
                  v-if="r.status==='in_progress'"
                  class="btn btn--success"
                  :disabled="busyId===r._id"
                  @click="setStatus(r,'completed')"
                >
                  Complete
                </button>
              </div>
            </div>

            <!-- Expand for quick view of stops & directions -->
            <details class="details" @toggle="(e)=> e.target.open && ensureDetails(r)">
              <summary>Stops & Quick Actions</summary>

              <div v-if="details[r._id]" class="stops">
                <div v-if="details[r._id].stops?.length" class="stops__list">
                  <div v-for="s in details[r._id].stops" :key="s._id" class="stop card card--sub">
                    <div class="stop__title">{{ s.title || s.place?.name }}</div>
                    <div class="small muted" v-if="s.place?.address">{{ s.place.address }}</div>
                    <div class="stop__links">
                      <a
                        v-if="s.place?.lat && s.place?.lng"
                        class="link small"
                        :href="mapsUrl(s.place.lat, s.place.lng)"
                        target="_blank"
                        rel="noopener"
                      >Directions</a>
                    </div>
                  </div>
                </div>
                <div v-else class="small muted">No stops yet.</div>
              </div>
            </details>
          </div>
        </div>
      </section>

      <!-- Open pool -->
      <section class="section">
        <h2 class="h2">Available (Open Pool)</h2>

        <div v-if="openList.length === 0" class="empty card small">
          No open runsheets right now.
        </div>

        <div class="stack">
          <div v-for="r in openList" :key="r._id" class="runsheet card">
            <div class="runsheet__head">
              <div class="runsheet__meta">
                <div class="runsheet__title">{{ r.title }}</div>
                <div class="small">
                  Status:
                  <span class="pill pill--info">{{ r.status }}</span>
                </div>
              </div>
              <button class="btn" :disabled="busyId===r._id" @click="claim(r)">
                Claim
              </button>
            </div>
          </div>
        </div>
      </section>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import api, { apiGet } from '../api.js';

const route = useRoute();
const router = useRouter();
const slug = computed(() => String(route.params.slug || ''));

// user info for NavBar
const me = ref(null);

// data
const openList = ref([]);
const myList = ref([]);
const loading = ref(false);
const autoRefresh = ref(true);
const lastUpdated = ref('');
const error = ref('');
const busyId = ref('');
const details = ref({}); // cache of runsheet details by id
let timer = null;

// logout -> slug-aware route that clears storage in its beforeEnter
const logout = () => {
  router.replace({ name: 'tenant-logout', params: { slug: slug.value } });
};

const stamp = () => { lastUpdated.value = new Date().toLocaleTimeString(); };

const load = async () => {
  loading.value = true; error.value = '';
  try {
    const [openRes, myRes] = await Promise.all([
      api.get('/tenant/runsheets', { open: 1 }),
      api.get('/tenant/runsheets', { assignedToMe: 1 }),
    ]);
    openList.value = Array.isArray(openRes) ? openRes : (openRes.items || []);
    myList.value   = Array.isArray(myRes)   ? myRes   : (myRes.items   || []);
    stamp();
  } catch (e) {
    error.value = e?.body?.error || e?.message || 'Failed to load';
  } finally {
    loading.value = false;
  }
};

const claim = async (r) => {
  error.value = ''; busyId.value = r._id;
  try {
    await api.post(`/tenant/runsheets/${r._id}/claim`);
    await load();
  } catch (e) {
    error.value = e?.body?.error || 'Could not claim runsheet';
  } finally {
    busyId.value = '';
  }
};

const setStatus = async (r, status) => {
  error.value=''; busyId.value = r._id;
  try {
    await api.patch(`/tenant/runsheets/${r._id}`, { status });
    await load();
  } catch (e) {
    error.value = e?.body?.error || 'Could not update status';
  } finally {
    busyId.value='';
  }
};

const ensureDetails = async (r) => {
  if (details.value[r._id]) return;
  try {
    details.value[r._id] = await api.get(`/tenant/runsheets/${r._id}`);
  } catch {}
};

const mapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

onMounted(async () => {
  try { me.value = await apiGet('/auth/me'); } catch { me.value = null; }
  await load();
  timer = setInterval(() => { if (autoRefresh.value) load(); }, 15000);
});

onBeforeUnmount(() => { if (timer) clearInterval(timer); });

watch(autoRefresh, (v) => { if (v) load(); });
</script>

<style scoped>
/* Page layout */
.driver-page {
  padding: 16px;
  display: grid;
  gap: 16px;
  box-sizing: border-box;
  max-width: 960px;
  margin: 0 auto;
}

/* Surfaces */
.card {
  background: #fff;
  border: 1px solid #E5E7EB; /* gray-200 */
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16,24,40,0.04);
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}
.toolbar__stamp {
  margin-left: auto;
  font-size: 12px;
  color: #6B7280; /* gray-500 */
}

/* Headings / sections */
.section { display: grid; gap: 10px; }
.h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

/* Buttons */
.btn {
  border: 1px solid #D1D5DB;
  background: #fff;
  color: #111827;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background .15s, border-color .15s, box-shadow .15s, color .15s;
}
.btn:hover { background: #F9FAFB; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.btn--primary {
  background: #4F46E5; /* indigo-600 */
  color: #fff;
  border-color: #4F46E5;
}
.btn--primary:hover { background: #4338CA; border-color: #4338CA; }

.btn--success {
  background: #10B981; /* emerald-500 */
  color: #fff;
  border-color: #10B981;
}
.btn--success:hover { background: #059669; border-color: #059669; }

.btn--ghost {
  background: transparent;
  border-color: #E5E7EB;
}
.btn--ghost:hover { background: #F9FAFB; }

/* Checkbox label */
.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  user-select: none;
}

/* Stacks / lists */
.stack { display: grid; gap: 10px; }
.empty { padding: 12px; }

/* Runsheet card */
.runsheet {
  padding: 12px;
}
.runsheet__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
}
.runsheet__meta { display: grid; gap: 4px; }
.runsheet__title { font-weight: 600; color: #111827; }
.runsheet__actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Pills (statuses) */
.pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid transparent;
}
.pill--ok {
  color: #065F46; background: #ECFDF5; border-color: #A7F3D0;
}
.pill--warn {
  color: #92400E; background: #FFFBEB; border-color: #FCD34D;
}
.pill--info {
  color: #1E40AF; background: #EFF6FF; border-color: #93C5FD;
}

/* Details / stops */
.details {
  margin-top: 10px;
}
.details > summary {
  cursor: pointer;
  font-size: 14px;
  color: #1D4ED8; /* blue-700ish */
  list-style: none;
}
.details > summary::-webkit-details-marker { display: none; }
.details[open] > summary { margin-bottom: 6px; }

.stops { display: grid; gap: 8px; }
.stops__list { display: grid; gap: 8px; }
.card--sub {
  border-radius: 10px;
  border-color: #EEF2F7;
  padding: 10px;
}
.stop__title { font-weight: 600; }
.stop__links { margin-top: 6px; }
.link {
  color: #1D4ED8;
  text-decoration: underline;
}

/* Utilities */
.small { font-size: 12px; }
.muted { color: #6B7280; }
.error { color: #B91C1C; font-size: 14px; }

/* Responsive */
@media (max-width: 640px) {
  .runsheet__head { gap: 10px; }
  .toolbar { gap: 10px; flex-wrap: wrap; }
  .toolbar__stamp { width: 100%; text-align: right; margin-left: 0; }
}
</style>
