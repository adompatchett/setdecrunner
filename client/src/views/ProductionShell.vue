<!-- src/layouts/ProductionShell.vue -->
<template>
  <div class="min-h-screen bg-[#f6f7fb] text-[#222]">
    <!-- Optional theme stylesheet (per-production) -->
    <link v-if="tenant.info?.branding?.themeCssUrl"
          rel="stylesheet"
          :href="tenant.info.branding.themeCssUrl" />

    <!-- Top bar -->
    <header class="bg-white border-b border-[#ececec]">
      <div class="container flex items-center justify-between py-3 gap-4">
        <RouterLink :to="`/${slug}`" class="flex items-center gap-3 nav__logo">
          <img v-if="tenant.info?.branding?.logoUrl"
               :src="tenant.info.branding.logoUrl"
               alt="Logo"
               class="h-8 w-auto" />
          <div class="flex flex-col">
            <span class="font-bold text-lg leading-5">{{ title }}</span>
            <span class="text-xs text-[#666] leading-4">SetDec Runner</span>
          </div>
        </RouterLink>

        <nav class="flex items-center gap-2">
          <RouterLink :to="`/${slug}`" class="btn btn--ghost">Dashboard</RouterLink>
          <RouterLink :to="`/${slug}/runsheets`" class="btn btn--ghost">Runsheets</RouterLink>
          <RouterLink :to="`/${slug}/people`" class="btn btn--ghost">People</RouterLink>
          <RouterLink :to="`/${slug}/suppliers`" class="btn btn--ghost">Suppliers</RouterLink>
          <RouterLink :to="`/${slug}/items`" class="btn btn--ghost">Items</RouterLink>
          <RouterLink :to="`/${slug}/places`" class="btn btn--ghost">Places</RouterLink>
          <RouterLink :to="`/${slug}/driver`" class="btn btn--ghost">Driver</RouterLink>

          <RouterLink
            v-if="auth.user?.role === 'admin'"
            :to="`/${slug}/admin/users`"
            class="btn btn--ghost"
          >Admin</RouterLink>

          <div class="h-6 w-px bg-[#e5e7eb] mx-1" />

          <button v-if="auth.token"
                  class="btn btn--danger"
                  @click="logout">Logout</button>
          <RouterLink v-else :to="`/${slug}/login`" class="btn btn--primary">Login</RouterLink>
        </nav>
      </div>
    </header>

    <!-- Tenant alerts -->
    <div v-if="loading" class="container py-6">
      <div class="card p-4">Loading production…</div>
    </div>
    <div v-else-if="notFound" class="container py-6">
      <div class="card p-4">
        <div class="text-lg font-semibold mb-2">Production not found</div>
        <p class="text-[#666]">The production “{{ slug }}” doesn’t exist or you don’t have access.</p>
      </div>
    </div>

    <!-- Main content -->
    <main v-else class="container py-6">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="border-t border-[#ececec] py-6 mt-8">
      <div class="container flex items-center justify-between">
        <div class="muted">© {{ year }} {{ title }} • SetDec Runner</div>
        <div class="nav__links">
          <a href="https://github.com/adompatchett/setdecrunner" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { useTenant } from '../stores/tenant.js';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const tenant = useTenant();

const slug = computed(() => String(route.params.slug || ''));
const loading = ref(true);
const notFound = ref(false);
const year = new Date().getFullYear();

const title = computed(() => tenant.info?.name || 'Production');

async function ensureTenantLoaded() {
  console.debug('[Shell] ensureTenantLoaded for', slug.value);
  loading.value = true;
  notFound.value = false;
  try {
    if (slug.value) {
      await tenant.setSlug(slug.value);
      console.debug('[Shell] tenant.setSlug finished', tenant.info);
    }
  } catch (err) {
    console.error('[Shell] tenant.setSlug failed', err);
    notFound.value = true;
  } finally {
    console.debug('[Shell] setting loading=false');
    loading.value = false;
  }
}

function logout() {
  auth.logout();
  // Send user to this production's login page
  router.push({ path: `/${slug.value}/login`, query: { r: `/${slug.value}` } });
}

onMounted(ensureTenantLoaded);
watch(() => route.params.slug, ensureTenantLoaded);
</script>

<style scoped>
.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 16px;
}

/* Buttons (aligns with your utility classes) */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 14px;
  background: #f6f7fb;
}
.btn--primary { background: #111; color: #fff; }
.btn--danger  { background: #e11d48; color: #fff; }
.btn--ghost   { background: transparent; border-color: #e5e7eb; color: #111; }
.btn:hover    { opacity: .92; }

.card {
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
}

.muted { color: #666; font-size: 13px; }
.nav__links a { color: #666; margin-left: 12px; }
.nav__links a:hover { color: #111; }
</style>
