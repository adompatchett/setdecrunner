<template>
  <div class="min-h-screen flex flex-col bg-gray-50">

    <!-- Main content -->
    <main class="flex-1 max-w-6xl mx-auto w-full p-4">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="text-xs text-gray-500 border-t p-3 text-center">
      © {{ new Date().getFullYear() }} Set-Deco Runsheets
    </footer>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from './stores/auth.js';

const auth = useAuth();
const me = auth.me;

const logout = () => auth.logout();
</script>

<style scoped>
/* Keep styles minimal – Tailwind classes do most of the work */
</style>
