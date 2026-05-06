interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function useAiChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return

    // Add user message
    messages.value.push({
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    })

    isLoading.value = true
    error.value = null

    try {
      // Build messages for API (without timestamps)
      const apiMessages = messages.value.map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await $fetch<{ success: boolean; message: string }>('/api/ai/chat', {
        method: 'POST',
        body: { messages: apiMessages }
      })

      // Add assistant response
      messages.value.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      })

      if (!response.success) {
        error.value = response.message
      }
    } catch (err: any) {
      const errorMessage = err.data?.message || err.message || 'Không thể kết nối đến AI'
      error.value = errorMessage
      messages.value.push({
        role: 'assistant',
        content: `⚠️ ${errorMessage}`,
        timestamp: new Date()
      })
    } finally {
      isLoading.value = false
    }
  }

  function clearChat() {
    messages.value = []
    error.value = null
  }

  return {
    messages: readonly(messages),
    isLoading: readonly(isLoading),
    error: readonly(error),
    sendMessage,
    clearChat
  }
}
