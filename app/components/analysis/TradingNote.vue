<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

// Props
const props = defineProps<{
  noteHtml?: string;
}>();

// Emits
const emit = defineEmits<{
  (
    e: 'save',
    data: {
      noteHtml: string;
      entryPrice: number | null;
      targetPrice: number | null;
      stopLoss: number | null;
    },
  ): void;
}>();

// Trading plan inputs
const entryPrice = ref<number | null>(null);
const targetPrice = ref<number | null>(null);
const stopLoss = ref<number | null>(null);

// Tiptap editor
const editor = useEditor({
  content: props.noteHtml || '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [2, 3],
      },
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
    },
  },
});

// Watch for prop changes
watch(
  () => props.noteHtml,
  (newHtml) => {
    if (editor.value && newHtml && newHtml !== editor.value.getHTML()) {
      editor.value.commands.setContent(newHtml);
    }
  },
);

// Calculator helpers
const riskRewardRatio = computed(() => {
  if (!entryPrice.value || !targetPrice.value || !stopLoss.value) return null;
  const reward = targetPrice.value - entryPrice.value;
  const risk = entryPrice.value - stopLoss.value;
  if (risk <= 0) return null;
  return (reward / risk).toFixed(2);
});

const potentialGain = computed(() => {
  if (!entryPrice.value || !targetPrice.value) return null;
  return (
    ((targetPrice.value - entryPrice.value) / entryPrice.value) *
    100
  ).toFixed(1);
});

const potentialLoss = computed(() => {
  if (!entryPrice.value || !stopLoss.value) return null;
  return (
    ((entryPrice.value - stopLoss.value) / entryPrice.value) *
    100
  ).toFixed(1);
});

// Save handler
const handleSave = () => {
  emit('save', {
    noteHtml: editor.value?.getHTML() || '',
    entryPrice: entryPrice.value,
    targetPrice: targetPrice.value,
    stopLoss: stopLoss.value,
  });
};

// Set values from parent
const setValues = (data: {
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
}) => {
  if (data.entryPrice !== undefined) entryPrice.value = data.entryPrice;
  if (data.targetPrice !== undefined) targetPrice.value = data.targetPrice;
  if (data.stopLoss !== undefined) stopLoss.value = data.stopLoss;
};

// Get values for global save
const getTradingData = () => {
  return {
    noteHtml: editor.value?.getHTML() || '',
    entryPrice: entryPrice.value,
    targetPrice: targetPrice.value,
    stopLoss: stopLoss.value,
  };
};

// Expose methods
defineExpose({ setValues, getTradingData });

// Cleanup
onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="trading-note-container">
    <!-- Trading Plan Section -->
    <div class="trading-plan">
      <h3 class="section-title">
        <UIcon name="i-lucide-target" class="mr-2" />
        Kế hoạch giao dịch
      </h3>

      <div class="plan-inputs">
        <div class="input-group">
          <label for="entry-price">Vùng mua (Entry)</label>
          <UInput
            id="entry-price"
            v-model.number="entryPrice"
            type="number"
            placeholder="25,000"
            :step="100"
            size="lg"
          >
            <template #trailing>
              <span class="text-gray-500 text-sm">đ</span>
            </template>
          </UInput>
        </div>

        <div class="input-group">
          <label for="target-price">Mục tiêu (Target)</label>
          <UInput
            id="target-price"
            v-model.number="targetPrice"
            type="number"
            placeholder="35,000"
            :step="100"
            size="lg"
            class="target-input"
          >
            <template #trailing>
              <span class="text-gray-500 text-sm">đ</span>
            </template>
          </UInput>
          <span v-if="potentialGain" class="input-hint positive">
            +{{ potentialGain }}%
          </span>
        </div>

        <div class="input-group">
          <label for="stop-loss">Cắt lỗ (Stoploss)</label>
          <UInput
            id="stop-loss"
            v-model.number="stopLoss"
            type="number"
            placeholder="22,000"
            :step="100"
            size="lg"
            class="stoploss-input"
          >
            <template #trailing>
              <span class="text-gray-500 text-sm">đ</span>
            </template>
          </UInput>
          <span v-if="potentialLoss" class="input-hint negative">
            -{{ potentialLoss }}%
          </span>
        </div>
      </div>

      <!-- Risk/Reward Summary -->
      <div v-if="riskRewardRatio" class="risk-reward">
        <UIcon name="i-lucide-scale" class="mr-2" />
        <span>Risk/Reward Ratio:</span>
        <span
          class="ratio-value"
          :class="{
            good: Number(riskRewardRatio) >= 2,
            bad: Number(riskRewardRatio) < 1,
          }"
        >
          1:{{ riskRewardRatio }}
        </span>
      </div>
    </div>

    <!-- Notes Section -->
    <div class="notes-section">
      <h3 class="section-title">
        <UIcon name="i-lucide-file-text" class="mr-2" />
        Ghi chú phân tích
      </h3>

      <!-- Editor Toolbar -->
      <div v-if="editor" class="editor-toolbar">
        <UButton
          :variant="editor.isActive('bold') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-lucide-bold"
          @click="editor.chain().focus().toggleBold().run()"
        />
        <UButton
          :variant="editor.isActive('italic') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-lucide-italic"
          @click="editor.chain().focus().toggleItalic().run()"
        />
        <UButton
          :variant="editor.isActive('bulletList') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-lucide-list"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <UButton
          :variant="editor.isActive('orderedList') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-lucide-list-ordered"
          @click="editor.chain().focus().toggleOrderedList().run()"
        />
        <UButton
          :variant="
            editor.isActive('heading', { level: 2 }) ? 'solid' : 'ghost'
          "
          size="xs"
          icon="i-lucide-heading-2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        />
        <UButton
          :variant="
            editor.isActive('heading', { level: 3 }) ? 'solid' : 'ghost'
          "
          size="xs"
          icon="i-lucide-heading-3"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        />
      </div>

      <!-- Editor Content -->
      <div class="editor-wrapper">
        <EditorContent :editor="editor" />
      </div>
    </div>

    <!-- Save Button -->
  </div>
</template>

<style scoped>
.trading-note-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--ui-text);
}

.trading-plan {
  padding: 1.25rem;
  background: var(--ui-bg-elevated);
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border);
}

.plan-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .plan-inputs {
    grid-template-columns: 1fr;
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.input-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
}

.input-hint {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 0.75rem;
  font-weight: 600;
}

.input-hint.positive {
  color: #10b981;
}

.input-hint.negative {
  color: #ef4444;
}

.risk-reward {
  display: flex;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ui-border);
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}

.ratio-value {
  margin-left: 0.5rem;
  font-weight: 700;
  font-size: 1rem;
}

.ratio-value.good {
  color: #10b981;
}

.ratio-value.bad {
  color: #ef4444;
}

.notes-section {
  padding: 1.25rem;
  background: var(--ui-bg-elevated);
  border-radius: 0.75rem;
  border: 1px solid var(--ui-border);
}

.editor-toolbar {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: var(--ui-bg);
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border);
}

.editor-wrapper {
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  background: var(--ui-bg);
  overflow: hidden;
}

.editor-wrapper :deep(.ProseMirror) {
  min-height: 200px;
  padding: 1rem;
  outline: none;
}

.editor-wrapper :deep(.ProseMirror p) {
  margin: 0.5rem 0;
}

.editor-wrapper :deep(.ProseMirror ul),
.editor-wrapper :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
}

.editor-wrapper :deep(.ProseMirror h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
}

.editor-wrapper :deep(.ProseMirror h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 0.75rem;
}
</style>
