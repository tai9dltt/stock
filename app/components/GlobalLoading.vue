<script setup lang="ts">
const loadingStore = useLoadingStore();
</script>

<template>
  <div
    v-if="loadingStore.isLoading"
    class="fixed inset-0 z-9999 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm transition-opacity"
  >
    <div
      class="px-10 py-8 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800"
    >
      <!-- Loading Spinner -->
      <UIcon
        name="i-lucide-loader-2"
        class="w-12 h-12 animate-spin text-primary-500"
      />

      <!-- Text -->
      <div class="text-center space-y-1">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ loadingStore.message }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Vui lòng đợi trong giây lát...
        </p>
      </div>
    </div>
  </div>
</template>
