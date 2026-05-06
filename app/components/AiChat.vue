<script setup lang="ts">
const { messages, isLoading, sendMessage, clearChat } = useAiChat();

const isOpen = ref(false);
const inputText = ref('');
const messagesContainer = ref<HTMLElement>();

// Send message
const handleSend = async () => {
  if (!inputText.value.trim()) return;
  const text = inputText.value;
  inputText.value = '';
  await sendMessage(text);
  scrollToBottom();
};

// Auto scroll to bottom when new messages arrive
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

watch(
  messages,
  () => {
    scrollToBottom();
  },
  { deep: true },
);

// Quick prompts
const quickPrompts = [
  {
    label: '📋 Danh sách CP',
    prompt: 'Cho tôi xem danh sách cổ phiếu đang theo dõi',
  },
  { label: '💰 Giá CP', prompt: 'Giá hiện tại của PVD?' },
  { label: '📊 Phân tích', prompt: 'Phân tích tài chính PVD' },
  {
    label: '📰 Tin tức',
    prompt: 'Tin tức mới nhất về thị trường chứng khoán Việt Nam',
  },
];

const sendQuickPrompt = (prompt: string) => {
  inputText.value = prompt;
  handleSend();
};

// Format message content with basic markdown
const formatContent = (content: string) => {
  return (
    content
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="bg-gray-900 text-green-400 p-3 rounded-lg my-2 overflow-x-auto text-sm"><code>$1</code></pre>',
      )
      // Inline code
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">$1</code>',
      )
      // Line breaks
      .replace(/\n/g, '<br>')
  );
};
</script>

<template>
  <!-- Floating Chat Button -->
  <button v-show="!isOpen" class="ai-chat-fab" @click="isOpen = true">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
    <span class="ai-chat-fab-badge" v-if="messages.length > 0">{{
      messages.length
    }}</span>
  </button>

  <!-- Chat Panel -->
  <Transition name="chat-panel">
    <div v-if="isOpen" class="ai-chat-panel">
      <!-- Header -->
      <div class="ai-chat-header">
        <div class="ai-chat-header-left">
          <div class="ai-chat-avatar">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <div>
            <h3 class="ai-chat-title">AI Trợ lý</h3>
            <span class="ai-chat-subtitle">Gemini · Real-time data</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button
            class="ai-chat-header-btn"
            @click="clearChat"
            title="Xóa lịch sử"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
          <button
            class="ai-chat-header-btn"
            @click="isOpen = false"
            title="Đóng"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="ai-chat-messages">
        <!-- Welcome message -->
        <div v-if="messages.length === 0" class="ai-chat-welcome">
          <div class="ai-chat-welcome-icon">🤖</div>
          <h4>Xin chào!</h4>
          <p>
            Tôi là trợ lý AI phân tích cổ phiếu. Tôi có thể lấy giá real-time,
            phân tích BCTC, và đưa ra nhận xét.
          </p>
          <div class="ai-chat-quick-prompts">
            <button
              v-for="qp in quickPrompts"
              :key="qp.label"
              class="ai-chat-quick-btn"
              @click="sendQuickPrompt(qp.prompt)"
            >
              {{ qp.label }}
            </button>
          </div>
        </div>

        <!-- Message bubbles -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="ai-chat-message"
          :class="{
            'ai-chat-message--user': msg.role === 'user',
            'ai-chat-message--assistant': msg.role === 'assistant',
          }"
        >
          <div
            class="ai-chat-bubble"
            :class="{
              'ai-chat-bubble--user': msg.role === 'user',
              'ai-chat-bubble--assistant': msg.role === 'assistant',
            }"
          >
            <div
              v-if="msg.role === 'assistant'"
              v-html="formatContent(msg.content)"
            />
            <span v-else>{{ msg.content }}</span>
          </div>
        </div>

        <!-- Loading indicator -->
        <div
          v-if="isLoading"
          class="ai-chat-message ai-chat-message--assistant"
        >
          <div class="ai-chat-bubble ai-chat-bubble--assistant">
            <div class="ai-chat-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="ai-chat-input-area">
        <input
          v-model="inputText"
          class="ai-chat-input"
          placeholder="Hỏi về cổ phiếu..."
          :disabled="isLoading"
          @keyup.enter="handleSend"
        />
        <button
          class="ai-chat-send-btn"
          :disabled="!inputText.trim() || isLoading"
          @click="handleSend"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ─── Floating Action Button ─── */
.ai-chat-fab {
  position: fixed;
  bottom: 5px;
  right: 150px;
  z-index: 1000;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow:
    0 4px 20px rgba(99, 102, 241, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.ai-chat-fab:hover {
  transform: scale(1.08);
  box-shadow:
    0 6px 28px rgba(99, 102, 241, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.2);
}
.ai-chat-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Chat Panel ─── */
.ai-chat-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1001;
  width: 400px;
  height: 580px;
  background: white;
  border-radius: 16px;
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
:root.dark .ai-chat-panel {
  background: #1a1a2e;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
}

/* ─── Header ─── */
.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  flex-shrink: 0;
}
.ai-chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-chat-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}
.ai-chat-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
}
.ai-chat-subtitle {
  font-size: 11px;
  opacity: 0.8;
}
.ai-chat-header-actions {
  display: flex;
  gap: 4px;
}
.ai-chat-header-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.ai-chat-header-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* ─── Messages Area ─── */
.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}
.ai-chat-messages::-webkit-scrollbar {
  width: 4px;
}
.ai-chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

/* ─── Welcome ─── */
.ai-chat-welcome {
  text-align: center;
  padding: 24px 16px;
  color: #6b7280;
}
:root.dark .ai-chat-welcome {
  color: #9ca3af;
}
.ai-chat-welcome-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.ai-chat-welcome h4 {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
}
:root.dark .ai-chat-welcome h4 {
  color: #f3f4f6;
}
.ai-chat-welcome p {
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 20px;
}
.ai-chat-quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.ai-chat-quick-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
:root.dark .ai-chat-quick-btn {
  background: #2d2d44;
  border-color: #4b4b6b;
  color: #d1d5db;
}
.ai-chat-quick-btn:hover {
  background: #f3f4f6;
  border-color: #6366f1;
  color: #6366f1;
}
:root.dark .ai-chat-quick-btn:hover {
  background: #3d3d5c;
  border-color: #818cf8;
  color: #818cf8;
}

/* ─── Message Bubbles ─── */
.ai-chat-message {
  margin-bottom: 12px;
  display: flex;
}
.ai-chat-message--user {
  justify-content: flex-end;
}
.ai-chat-message--assistant {
  justify-content: flex-start;
}
.ai-chat-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.6;
  word-wrap: break-word;
}
.ai-chat-bubble--user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-bottom-right-radius: 4px;
}
.ai-chat-bubble--assistant {
  background: #f3f4f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}
:root.dark .ai-chat-bubble--assistant {
  background: #2d2d44;
  color: #e5e7eb;
}

/* ─── Typing Indicator ─── */
.ai-chat-typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.ai-chat-typing span {
  width: 7px;
  height: 7px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.ai-chat-typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.ai-chat-typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

/* ─── Input Area ─── */
.ai-chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: white;
  flex-shrink: 0;
}
:root.dark .ai-chat-input-area {
  border-color: rgba(255, 255, 255, 0.08);
  background: #1a1a2e;
}
.ai-chat-input {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13px;
  outline: none;
  background: #f9fafb;
  color: #1f2937;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
:root.dark .ai-chat-input {
  background: #2d2d44;
  border-color: #4b4b6b;
  color: #e5e7eb;
}
.ai-chat-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}
.ai-chat-input:disabled {
  opacity: 0.6;
}
.ai-chat-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.ai-chat-send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
}
.ai-chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ─── Panel Transition ─── */
.chat-panel-enter-active {
  animation: chat-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.chat-panel-leave-active {
  animation: chat-slide-up 0.2s ease-in reverse;
}
@keyframes chat-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ─── Responsive ─── */
@media (max-width: 480px) {
  .ai-chat-panel {
    width: calc(100vw - 16px);
    height: calc(100vh - 100px);
    bottom: 8px;
    right: 8px;
    border-radius: 12px;
  }
}
</style>
