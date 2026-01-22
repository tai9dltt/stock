<script setup lang="ts">
// Redirect to analysis page
navigateTo('/analysis');
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-4xl text-primary"
      />
      <p class="mt-4 text-gray-500">Đang chuyển hướng...</p>
    </div>
  </div>
</template>
