<script setup lang="ts">
import type { InputField, InputNote } from '~/spreadsheet/types';

type EditableField = Extract<InputField, 'currentPrice' | 'outstandingShares' | 'revenueGrowth' | 'grossMargin' | 'netProfitGrowth'>;

const props = defineProps<{
  values: Record<EditableField, number>;
  labels: Record<InputField, string>;
  notes: Record<InputField, InputNote>;
}>();

const emit = defineEmits<{
  update: [field: EditableField, value: number];
}>();

const PERCENT = { style: 'percent', maximumFractionDigits: 2 } as const;
const INTEGER = { maximumFractionDigits: 0 } as const;

const groups = computed(() => [
  {
    title: 'Giả định dự phóng',
    hint: 'Áp dụng cho các quý (F)',
    fields: (['revenueGrowth', 'grossMargin', 'netProfitGrowth'] as const).map(field => ({
      field,
      format: PERCENT,
      step: 0.01,
      disabled: props.notes[field].kind === 'unused',
    })),
  },
  {
    title: 'Định giá',
    hint: 'Giá dùng để tính P/E và giá mục tiêu',
    fields: [
      { field: 'currentPrice' as const, format: INTEGER, step: 100, disabled: false },
      { field: 'outstandingShares' as const, format: INTEGER, step: 1_000_000, disabled: false },
    ],
  },
]);

const update = (field: EditableField, value: number | null | undefined) => {
  emit('update', field, value ?? 0);
};
</script>

<template>
  <section
    class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 md:p-4"
    aria-label="Giả định"
  >
    <div class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 lg:gap-8">
      <fieldset v-for="group in groups" :key="group.title">
        <legend class="flex items-baseline gap-2 mb-2">
          <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ group.title }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ group.hint }}</span>
        </legend>
        <div class="grid gap-3" :class="group.fields.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'">
          <UFormField
            v-for="f in group.fields"
            :key="f.field"
            :label="labels[f.field]"
            :help="f.disabled ? notes[f.field].text : undefined"
            :ui="{ label: 'text-xs text-gray-500 dark:text-gray-400 font-normal', help: 'text-xs mt-1' }"
          >
            <UInputNumber
              :model-value="values[f.field]"
              :format-options="f.format"
              :step="f.step"
              :step-snapping="false"
              :disabled="f.disabled"
              :ui="{ base: 'tabular-nums' }"
              class="w-full"
              @update:model-value="(v: number | null | undefined) => update(f.field, v)"
            />
          </UFormField>
        </div>
      </fieldset>
    </div>
  </section>
</template>
