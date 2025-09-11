// client/src/stores/admin.js
import { defineStore } from 'pinia';
import api from '../api.js';

export const useAdmin = defineStore('admin', {
  actions: {
    inviteUser(payload) { return api.postAdmin('/users', payload); }
  }
});