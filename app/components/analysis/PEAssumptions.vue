<script setup lang="ts">
// Props
const props = defineProps<{
  peAssumptions?: Record<string, number>;
  forecastYears?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:peAssumptions', value: Record<string, number>): void;
}>();

// Local copy of P/E assumptions
const localPE = ref<Record<string, number>>({ ...props.peAssumptions });

// Watch for changes and emit
watch(
  localPE,
  (val) => {
    emit('update:peAssumptions', val);
  },
  { deep: true },
);

// Watch for forecast years changes
watch(
  () => props.forecastYears,
  (years) => {
    if (!years) return;

    // Initialize missing years with default value
    years.forEach((year) => {
      if (localPE.value[year] === undefined) {
        localPE.value[year] = 15;
      }
    });
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <div class="pe-assumptions">
    <div class="grid-header">
      <h3 class="grid-title">
        <UIcon name="i-lucide-calculator" class="mr-2" />
        Table 3: Giả định P/E
      </h3>
    </div>

    <div class="pe-inputs">
      <div v-for="year in forecastYears" :key="year" class="pe-input-group">
        <label :for="`pe-${year}`">P/E giả định {{ year }}:</label>
        <UInput
          :id="`pe-${year}`"
          v-model.number="localPE[year]"
          type="number"
          :min="1"
          :max="100"
          :step="0.5"
          size="sm"
          class="w-24"
        />
      </div>

      <div
        v-if="!forecastYears || forecastYears.length === 0"
        class="no-forecast"
      >
        <UIcon name="i-lucide-info" class="mr-2" />
        <span
          >Chưa có năm dự phóng. Thêm năm trong Table 1 để nhập P/E giả
          định.</span
        >
      </div>
    </div>

    <div class="pe-note">
      <UIcon name="i-lucide-info" class="mr-1" />
      <span
        >Giá trị P/E này được sử dụng để tính giá mục tiêu dựa trên EPS dự
        phóng</span
      >
    </div>
  </div>
</template>

<style scoped>
.pe-assumptions {
  width: 100%;
}

.grid-header {
  margin-bottom: 1rem;
}

.grid-title {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text);
}

.pe-inputs {
  display: flex;
  gap: 2rem;
  padding: 1.5rem;
  background: var(--ui-bg-elevated);
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border);
  flex-wrap: wrap;
}

.pe-input-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pe-input-group label {
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
}

.no-forecast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  font-style: italic;
}

.pe-note {
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>
