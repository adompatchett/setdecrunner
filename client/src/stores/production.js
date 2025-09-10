import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../api'; // Your API instance

export const useProduction = defineStore('production', () => {
  // State
  const current = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Getters
  const productionId = computed(() => current.value?.id || null);
  const productionSlug = computed(() => current.value?.slug || null);
  const productionName = computed(() => current.value?.name || null);

  // Actions
  const fetchBySlug = async (slug) => {
    if (!slug) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.get(`/productions/by-slug/${slug}`);
      current.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Production not found';
      current.value = null;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchById = async (id) => {
    if (!id) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await api.get(`/productions/${id}`);
      current.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Production not found';
      current.value = null;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const clearCurrent = () => {
    current.value = null;
    error.value = null;
  };

  // Helper to get production-aware API calls
  const getApiPath = (path) => {
    if (!productionId.value) {
      throw new Error('No production selected');
    }
    return `/productions/${productionId.value}${path}`;
  };

  return {
    // State
    current,
    loading,
    error,
    
    // Getters
    productionId,
    productionSlug,
    productionName,
    
    // Actions
    fetchBySlug,
    fetchById,
    clearCurrent,
    getApiPath,
  };
});