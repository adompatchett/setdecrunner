// client/src/stores/tenant.js
import { defineStore } from 'pinia';
import api from '../api/index.js'; // adjust if you set up @ alias

export const useTenant = defineStore('tenant', {
  state: () => ({
    slug: '',
    info: null,
  }),
  actions: {
    async setSlug(slug) {
  const s = String(slug || '').toLowerCase();
  console.debug('[tenant] setSlug called', s);
  if (!s) throw new Error('Missing slug');
  if (this.slug === s && this.info) {
    console.debug('[tenant] already loaded');
    return;
  }

  this.slug = s;
  api.setTenantSlug(s);

  try {
    this.info = await api.get(`/tenant/${s}`);
    console.debug('[tenant] loaded info', this.info);
    document.title = `${this.info?.name || 'Production'} • SetDec Runner`;
  } catch (err) {
    console.error('[tenant] api.get failed', err);
    this.info = null;
    throw err;
  }
}
  },
});