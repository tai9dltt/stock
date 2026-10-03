<script setup lang="ts">
const isHydrated = ref(false);

onMounted(() => {
  isHydrated.value = true;
});
</script>

<template>
  <UApp
    :class="{
      'opacity-0': !isHydrated,
      'opacity-100 transition-opacity duration-150': isHydrated,
    }"
  >
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <UNotifications />
    <GlobalLoading />
  </UApp>
</template>
