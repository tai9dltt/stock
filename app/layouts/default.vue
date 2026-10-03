<script setup lang="ts">
const route = useRoute();
const toast = useToast();

// Open any stock from the header
const symbolInput = ref('');
const openStock = () => {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) return;
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) {
    toast.add({ title: 'Mã không hợp lệ', description: 'Nhập mã cổ phiếu, ví dụ FPT, VCB, HPG', color: 'warning' });
    return;
  }
  symbolInput.value = '';
  navigateTo(`/analysis/${symbol}`);
};

const isListPage = computed(() => route.path === '/analysis');
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header
      class="sticky top-0 z-50 h-14 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800"
    >
      <div class="h-full max-w-screen-2xl mx-auto px-3 md:px-4 flex items-center gap-4">
        <NuxtLink to="/analysis" class="flex items-center gap-2 shrink-0">
          <span class="flex items-center justify-center size-8 rounded-lg bg-primary-500 text-white">
            <UIcon name="i-lucide-chart-candlestick" class="size-5" />
          </span>
          <span class="hidden sm:block font-semibold text-gray-900 dark:text-white">Stock Analysis</span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1 ml-2">
          <UButton
            to="/analysis"
            variant="ghost"
            :color="isListPage ? 'primary' : 'neutral'"
            icon="i-lucide-list"
          >
            Danh sách
          </UButton>
        </nav>

        <form class="ml-auto w-full max-w-xs" @submit.prevent="openStock">
          <UInput
            v-model="symbolInput"
            icon="i-lucide-search"
            placeholder="Mở mã cổ phiếu (FPT, VCB…)"
            class="w-full"
            :ui="{ base: 'uppercase placeholder:normal-case' }"
            aria-label="Mở mã cổ phiếu"
          />
        </form>
      </div>
    </header>

    <main>
      <slot />
    </main>
  </div>
</template>
