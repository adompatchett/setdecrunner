import { defineStore } from 'pinia';
import api from '../api/index.js';
import router from '../router'; // <-- import your Vue Router instance

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null
  }),

  actions: {
    setToken(t) {
      this.token = t;
      if (t) {
        localStorage.setItem('token', t);
      } else {
        localStorage.removeItem('token');
      }
      api.setToken(t);
    },

    async fetchMe() {
      this.user = await api.get('/auth/me');
      return this.user;
    },

    async logout() {
      // Clear local app session
      this.setToken('');
      this.user = null;

      try {
        // Facebook logout if FB SDK is loaded
        if (window.FB) {
          await new Promise(resolve => {
            window.FB.getLoginStatus(res => {
              if (res.status === 'connected') {
                window.FB.logout(() => resolve());
              } else {
                resolve();
              }
            });
          });
        }
      } catch (err) {
        console.warn('FB logout failed/ignored:', err);
      }

      // Redirect to login screen
      router.push('/login');
    }
  }
});