<script setup lang="ts">
import type { InputField, InputNote } from '~/spreadsheet/types';

type EditableField = Extract<InputField, 'currentPrice' | 'outstandingShares' | 'revenueGrowth' | 'grossMargin' | 'netProfitGrowth'>;

const props = defineProps<{
  /** Values the sheet currently uses */
  values: Record<EditableField, number>;
  labels: Record<InputField, string>;
  notes: Record<InputField, InputNote>;
}>();

const emit = defineEmits<{
  /** Apply the changed fields to the sheet */
  apply: [changes: Partial<Record<EditableField, number>>];
  /** Replace the P/E scenarios with a ladder from the P/E history */
  regeneratePe: [];
}>();

const PERCENT = { style: 'percent', maximumFractionDigits: 2 } as const;
const INTEGER = { maximumFractionDigits: 0 } as const;

const groups = computed(() => [
  {
    title: 'Giả định dự phóng',
    regeneratePe: false,
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
    regeneratePe: true,
    hint: 'Giá dùng để tính P/E và giá mục tiêu',
    fields: [
      { field: 'currentPrice' as const, format: INTEGER, step: 100, disabled: false },
      { field: 'outstandingShares' as const, format: INTEGER, step: 1_000_000, disabled: false },
    ],
  },
]);

const FIELDS = ['revenueGrowth', 'grossMargin', 'netProfitGrowth', 'currentPrice', 'outstandingShares'] as const;

// ─── Draft: edits stay here until "Áp dụng" ───────────────────────────

const draft = reactive({ ...props.values });

const isChanged = (field: EditableField) => Math.abs(draft[field] - props.values[field]) > 1e-9;
const changedFields = computed(() => FIELDS.filter(isChanged));

// The sheet values change on load or when a cell is edited in the sheet:
// follow them, except for fields with a pending edit
watch(
  () => ({ ...props.values }),
  (next, prev) => {
    for (const field of FIELDS) {
      if (!prev || Math.abs(draft[field] - prev[field]) < 1e-9) draft[field] = next[field];
    }
  },
);

const setDraft = (field: EditableField, value: number | null | undefined) => {
  draft[field] = value ?? 0;
};

/**
 * UInputNumber only commits on blur / Enter; read the text while typing so
 * "Áp dụng" is enabled straight away ("25" or "25%" → 0.25).
 */
const onTyping = (field: EditableField, isPercent: boolean, event: Event) => {
  const text = (event.target as HTMLInputElement).value.replace(/[^\d.-]/g, '');
  if (text === '' || text === '-' || text === '.') return;
  const value = Number(text);
  if (Number.isFinite(value)) draft[field] = isPercent ? value / 100 : value;
};

const apply = () => {
  if (changedFields.value.length === 0) return;
  emit('apply', Object.fromEntries(changedFields.value.map(f => [f, draft[f]])));
};

const reset = () => {
  Object.assign(draft, props.values);
};
</script>

<template>
  <form
    class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 md:p-4"
    aria-label="Giả định"
    @submit.prevent="apply"
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
              :model-value="draft[f.field]"
              :format-options="f.format"
              :step="f.step"
              :step-snapping="false"
              :disabled="f.disabled"
              :highlight="isChanged(f.field)"
              :color="isChanged(f.field) ? 'warning' : 'primary'"
              :ui="{ base: 'tabular-nums' }"
              class="w-full"
              @update:model-value="(v: number | null | undefined) => setDraft(f.field, v)"
              @input="(e: Event) => onTyping(f.field, f.format === PERCENT, e)"
            />
          </UFormField>
        </div>
        <UButton
          v-if="group.regeneratePe"
          type="button"
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-refresh-ccw"
          class="mt-2 px-0"
          title="Bỏ các P/E đang có, tạo lại theo P/E 5 năm gần nhất: thấp nhất, vùng thấp, trung vị, vùng cao, cao nhất và P/E hiện tại"
          @click="emit('regeneratePe')"
        >
          Tạo lại thang P/E theo lịch sử 5 năm
        </UButton>
      </fieldset>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <span v-if="changedFields.length > 0" class="mr-auto text-xs text-amber-700 dark:text-amber-400">
        {{ changedFields.length }} giá trị chưa áp dụng vào bảng tính
      </span>
      <span v-else class="mr-auto text-xs text-gray-500 dark:text-gray-400">
        Sửa một hoặc nhiều giá trị rồi bấm Áp dụng (hoặc Enter)
      </span>
      <UButton
        v-if="changedFields.length > 0"
        color="neutral"
        variant="ghost"
        icon="i-lucide-undo-2"
        @click="reset"
      >
        Hoàn tác
      </UButton>
      <UButton type="submit" icon="i-lucide-calculator" :disabled="changedFields.length === 0">
        Áp dụng
      </UButton>
    </div>
  </form>
</template>
