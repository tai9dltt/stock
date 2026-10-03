<script setup lang="ts">
const isHydrated = ref(false);

onMounted(() => {
  isHydrated.value = true;
});

useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Stock Analysis` : 'Stock Analysis'),
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
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <GlobalLoading />
  </UApp>
</template>
