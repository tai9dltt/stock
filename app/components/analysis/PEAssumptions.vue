<script setup lang="ts">
// Props
const props = defineProps<{
  pe2022?: number;
  pe2023?: number;
}>();

const emit = defineEmits<{
  (e: 'update:pe2022', value: number): void;
  (e: 'update:pe2023', value: number): void;
}>();

const pe2022 = ref(props.pe2022 || 15);
const pe2023 = ref(props.pe2023 || 15);

watch(pe2022, (val) => emit('update:pe2022', val));
watch(pe2023, (val) => emit('update:pe2023', val));
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
      <div class="pe-input-group">
        <label for="pe-2022">P/E giả định 2022:</label>
        <UInput
          id="pe-2022"
          v-model.number="pe2022"
          type="number"
          :min="1"
          :max="100"
          :step="0.5"
          size="sm"
          class="w-24"
        />
      </div>

      <div class="pe-input-group">
        <label for="pe-2023">P/E giả định 2023:</label>
        <UInput
          id="pe-2023"
          v-model.number="pe2023"
          type="number"
          :min="1"
          :max="100"
          :step="0.5"
          size="sm"
          class="w-24"
        />
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

.pe-note {
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
</style>
