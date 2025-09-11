<template>
  <div>
    <NavBar :me="me" @logout="logout" />

    <div class="users-page">
      <!-- Toolbar -->
      <div class="toolbar">
        <input
          v-model="q"
          placeholder="Search users (name or email)"
          class="input"
        />
        <button class="btn btn--primary" @click="load" :disabled="loading">
          {{ loading ? 'Searching…' : 'Search' }}
        </button>
        <button class="btn" @click="reset">Reset</button>

        <div class="toolbar__spacer"></div>

        <!-- New: Create user -->
        <button class="btn btn--primary" @click="openCreate" :disabled="creating">
          + Create User
        </button>

        <span class="toolbar__stamp" v-if="lastUpdated">
          Updated {{ lastUpdated }}
        </span>
      </div>

      <!-- List -->
      <div v-if="loading" class="muted">Loading…</div>

      <div v-else class="table-wrap card">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Authorized</th>
              <th>Banned</th>
              <th>Provider</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in list" :key="u._id">
              <td>
                <div class="usercell">
                  <img v-if="u.photo" :src="u.photo" class="avatar" alt="" />
                  <div class="truncate">{{ u.name || '—' }}</div>
                </div>
              </td>
              <td class="truncate email">{{ u.email || '—' }}</td>
              <td>
                <select
                  class="select"
                  v-model="u.role"
                  :disabled="savingId===u._id || isSelf(u)"
                  @change="save(u)"
                >
                  <option value="admin">admin</option>
                  <option value="driver">driver</option>
                  <option value="user">user</option>
                </select>
              </td>
              <td>
                <label class="check">
                  <input type="checkbox" v-model="u.siteAuthorized" :disabled="savingId===u._id || isSelf(u)" @change="save(u)" />
                  <span class="pill" :class="u.siteAuthorized ? 'pill--ok' : 'pill--muted'">
                    {{ u.siteAuthorized ? 'Yes' : 'No' }}
                  </span>
                </label>
              </td>
              <td>
                <label class="check">
                  <input type="checkbox" v-model="u.banned" :disabled="savingId===u._id || isSelf(u)" @change="save(u)" />
                  <span class="pill" :class="u.banned ? 'pill--danger' : 'pill--ok'">
                    {{ u.banned ? 'Banned' : 'Active' }}
                  </span>
                </label>
              </td>
              <td class="ucase small">{{ u.oauthProvider || u.provider || 'local' }}</td>
              <td class="small">{{ shortDate(u.createdAt) }}</td>
              <td class="text-right">
                <button class="btn btn--ghost" @click="view(u)">View</button>
                <button
                  class="btn btn--danger"
                  :disabled="savingId===u._id || isSelf(u)"
                  @click="removeUser(u)"
                >Remove</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!list.length" class="empty muted">
          No users match your search.
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </div>

    <!-- Profile Modal -->
    <div v-if="active" class="modal">
      <div class="modal__backdrop" @click="active=null"></div>
      <div class="modal__card">
        <div class="modal__head">
          <h3 class="title">User Profile</h3>
          <button class="btn btn--ghost" @click="active=null">Close</button>
        </div>

        <div class="profile">
          <img v-if="active.photo" :src="active.photo" class="avatar avatar--lg" alt="" />
          <div>
            <div class="profile__name">{{ active.name || '—' }}</div>
            <div class="muted small">{{ active.email || '—' }}</div>
          </div>
        </div>

        <div class="details">
          <div>
            <div class="label small">Role</div>
            <div class="mono">{{ active.role }}</div>
          </div>
          <div>
            <div class="label small">Provider</div>
            <div class="mono ucase">{{ active.oauthProvider || active.provider || 'local' }}</div>
          </div>
          <div>
            <div class="label small">Authorized</div>
            <div class="pill" :class="active.siteAuthorized ? 'pill--ok' : 'pill--muted'">
              {{ active.siteAuthorized ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="label small">Banned</div>
            <div class="pill" :class="active.banned ? 'pill--danger' : 'pill--ok'">
              {{ active.banned ? 'Banned' : 'Active' }}
            </div>
          </div>
          <div>
            <div class="label small">Created</div>
            <div class="small">{{ longDate(active.createdAt) }}</div>
          </div>
          <div>
            <div class="label small">Updated</div>
            <div class="small">{{ longDate(active.updatedAt) }}</div>
          </div>
        </div>

        <div class="modal__foot">
          <button class="btn" @click="toggleAuth(active)" :disabled="savingId===active._id || isSelf(active)">
            {{ active.siteAuthorized ? 'Revoke Site Access' : 'Authorize Site Access' }}
          </button>
          <button class="btn" @click="toggleBan(active)" :disabled="savingId===active._id || isSelf(active)">
            {{ active.banned ? 'Unban' : 'Ban' }}
          </button>
          <button class="btn btn--danger" @click="removeUser(active)" :disabled="savingId===active._id || isSelf(active)">
            Remove Account
          </button>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <div v-if="createOpen" class="modal">
      <div class="modal__backdrop" @click="closeCreate"></div>
      <div class="modal__card">
        <div class="modal__head">
          <h3 class="title">Create User & Send Invite</h3>
          <button class="btn btn--ghost" @click="closeCreate">Close</button>
        </div>

        <form class="grid" @submit.prevent="createUser">
          <input class="input" v-model.trim="createForm.firstName" placeholder="First name" />
          <input class="input" v-model.trim="createForm.lastName" placeholder="Last name" />
          <input class="input" v-model.trim="createForm.email" placeholder="Email" type="email" required />
          <input class="input" v-model.trim="createForm.username" placeholder="Username (optional)" />

          <div class="row gap-2">
            <label class="label small">Role</label>
            <select class="select" v-model="createForm.role">
              <option value="user">user</option>
              <option value="driver">driver</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <label class="check">
            <input type="checkbox" v-model="createForm.siteAuthorized" />
            <span>Authorize site access immediately</span>
          </label>

          <div class="modal__foot">
            <button class="btn btn--primary" :disabled="creating">
              {{ creating ? 'Sending Invite…' : 'Create & Send Invite' }}
            </button>
            <span class="muted small" v-if="createError">{{ createError }}</span>
            <span class="small" v-if="createMsg">{{ createMsg }}</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import NavBar from '../components/NavBar.vue';
import { useAuth } from '../auth.js';
import api from '../api.js';

const auth = useAuth();
const me = ref(null);

const q = ref('');
const list = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const savingId = ref('');
const lastUpdated = ref('');

const active = ref(null); // currently viewed profile

// Create modal state
const createOpen = ref(false);
const creating = ref(false);
const createForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  role: 'user',
  siteAuthorized: false,
});
const createError = ref('');
const createMsg = ref('');

const logout = () => auth.logout();

const stamp = () => { lastUpdated.value = new Date().toLocaleTimeString(); };

const shortDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString();
};
const longDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString();
};

const isSelf = (u) => me.value && u._id === me.value._id;

const load = async () => {
  loading.value = true; error.value = '';
  try {
    list.value = await api.get('/users', { q: q.value });
    stamp();
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Failed to load users';
  } finally {
    loading.value = false;
  }
};

const reset = async () => { q.value = ''; await load(); };

const save = async (u) => {
  savingId.value = u._id; error.value = '';
  try {
    const body = { role: u.role, siteAuthorized: !!u.siteAuthorized, banned: !!u.banned };
    const updated = await api.patch(`/tenant/users/${u._id}`, body);
    Object.assign(u, updated);
    notice.value = 'Changes saved';
    setTimeout(() => (notice.value = ''), 1200);
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to update user';
    await reloadSingle(u._id);
  } finally {
    savingId.value = '';
  }
};

const toggleAuth = async (u) => {
  u.siteAuthorized = !u.siteAuthorized;
  await save(u);
};
const toggleBan = async (u) => {
  if (!u.banned && isSelf(u)) return;
  u.banned = !u.banned;
  await save(u);
};

const removeUser = async (u) => {
  if (isSelf(u)) { alert('You cannot remove your own account from here.'); return; }
  if (!confirm(`Remove user "${u.name || u.email || 'account'}"? This cannot be undone.`)) return;
  savingId.value = u._id; error.value = '';
  try {
    await api.del(`/tenant/users/${u._id}`);
    list.value = list.value.filter(x => x._id !== u._id);
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to remove user';
    await reloadSingle(u._id);
  } finally {
    savingId.value = '';
  }
};

const view = async (u) => {
  try {
    active.value = await api.get(`/tenant/users/${u._id}`);
  } catch (e) {
    error.value = e?.response?.data?.error || 'Failed to load profile';
  }
};

const reloadSingle = async (id) => {
  try {
    const fresh = await api.get(`/tenant/users/${id}`);
    const idx = list.value.findIndex(u => u._id === id);
    if (idx >= 0) list.value[idx] = fresh;
    if (active.value?._id === id) active.value = fresh;
  } catch { /* ignore */ }
};

// ---- Create user modal handlers ----
const openCreate = () => {
  createError.value = '';
  createMsg.value = '';
  createOpen.value = true;
};
const closeCreate = () => {
  createOpen.value = false;
  createForm.value = { firstName: '', lastName: '', email: '', username: '', role: 'user', siteAuthorized: false };
};

const createUser = async () => {
  try {
    createError.value = '';
    createMsg.value = '';
    if (!createForm.value.email) { createError.value = 'Email is required'; return; }
    creating.value = true;

    // IMPORTANT: This hits the admin invite endpoint that issues an email + reset link
    await api.post('/tenant/admin/users', {
      firstName: createForm.value.firstName || undefined,
      lastName:  createForm.value.lastName  || undefined,
      email:     createForm.value.email,
      username:  createForm.value.username || undefined,
      role:      createForm.value.role,
      siteAuthorized: !!createForm.value.siteAuthorized
    });

    createMsg.value = 'Invitation sent';
    await load();            // refresh list so the new user appears
    setTimeout(() => { closeCreate(); }, 600);
  } catch (e) {
    createError.value = e?.response?.data?.error || e.message || 'Failed to create user';
  } finally {
    creating.value = false;
  }
};

onMounted(async () => {
  me.value = await auth.fetchMe();
  if (me.value?.role !== 'admin') {
    error.value = 'Admins only';
    return;
  }
  await load();
});
</script>

<style scoped>
/* Layout */
.users-page {
  padding: 16px;
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
  box-sizing: border-box;
}

/* Cards / Surfaces */
.card {
  background: #fff;
  border: 1px solid #E5E7EB; /* gray-200 */
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

/* Toolbar */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(16,24,40,.04);
}
.toolbar__stamp {
  margin-left: auto;
  font-size: 12px;
  color: #6B7280; /* gray-500 */
}

/* Inputs / selects / buttons */
.input, .select {
  border: 1px solid #D1D5DB; /* gray-300 */
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  min-width: 280px;
  outline: none;
  transition: box-shadow .15s, border-color .15s;
  background: #fff;
}
.input:focus, .select:focus {
  border-color: #6366F1; /* indigo-500 */
  box-shadow: 0 0 0 3px rgba(99,102,241,.2);
}

.btn {
  border: 1px solid #D1D5DB;
  background: #fff;
  color: #111827; /* gray-900 */
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

.btn--danger {
  color: #B91C1C; /* red-700 */
  border-color: #FCA5A5; /* red-300 */
  background: #FEF2F2; /* red-50 */
}
.btn--danger:hover {
  background: #FEE2E2; /* red-100 */
}

.btn--ghost {
  background: transparent;
  border-color: #E5E7EB;
}
.btn--ghost:hover {
  background: #F9FAFB;
}

/* Table */
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}
.table thead th {
  position: sticky;
  top: 0;
  background: #F9FAFB; /* gray-50 */
  text-align: left;
  padding: 10px;
  font-weight: 600;
  color: #374151; /* gray-700 */
  border-bottom: 1px solid #E5E7EB;
}
.table tbody tr {
  border-top: 1px solid #E5E7EB;
}
.table tbody td {
  padding: 10px;
  vertical-align: middle;
}
.table tbody tr:hover {
  background: #FAFAFA;
}
.text-right { text-align: right; }
.small { font-size: 12px; color: #374151; }

/* Cells */
.usercell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}
.email { max-width: 260px; }
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ucase { text-transform: uppercase; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

/* Avatar */
.avatar {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  object-fit: cover;
}
.avatar--lg {
  width: 48px;
  height: 48px;
}

/* Pills / statuses */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid transparent;
}
.pill--ok {
  color: #065F46;            /* emerald-800 */
  background: #ECFDF5;       /* emerald-50 */
  border-color: #A7F3D0;     /* emerald-300 */
}
.pill--danger {
  color: #991B1B;            /* red-800 */
  background: #FEF2F2;       /* red-50 */
  border-color: #FCA5A5;     /* red-300 */
}
.pill--muted {
  color: #374151;            /* gray-700 */
  background: #F3F4F6;       /* gray-100 */
  border-color: #E5E7EB;     /* gray-200 */
}

/* Checkbox label */
.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  user-select: none;
}

/* Empty state */
.empty {
  padding: 12px;
  border-top: 1px dashed #E5E7EB;
}
.muted { color: #6B7280; }

/* Errors */
.error {
  color: #B91C1C;
  font-size: 14px;
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
}
.modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.4);
}
.modal__card {
  position: relative;
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 10px 30px rgba(0,0,0,.08);
  padding: 16px;
  display: grid;
  gap: 12px;
}
.modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.modal__foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #E5E7EB;
}
.title {
  font-size: 18px;
  font-weight: 600;
}

/* Profile top */
.profile {
  display: flex;
  align-items: center;
  gap: 12px;
}
.profile__name {
  font-weight: 600;
}

/* Profile details grid */
.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}
.label {
  color: #6B7280;
}

/* Scrollbar polish (WebKit) */
.table-wrap::-webkit-scrollbar {
  height: 8px;
}
.table-wrap::-webkit-scrollbar-track {
  background: #F3F4F6;
  border-radius: 999px;
}
.table-wrap::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 999px;
}
.table-wrap::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}

/* Responsive tweaks */
@media (max-width: 640px) {
  .input { min-width: 0; width: 100%; }
  .toolbar { gap: 10px; }
  .toolbar__stamp { width: 100%; margin-left: 0; text-align: right; }
  .details { grid-template-columns: 1fr; }
}
</style>
