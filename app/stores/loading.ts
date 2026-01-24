import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', () => {
  const isLoading = ref(false)
  const message = ref('Đang xử lý...')

  function show(msg = 'Đang xử lý...') {
    message.value = msg
    isLoading.value = true
  }

  function hide() {
    isLoading.value = false
    message.value = ''
  }

  return { isLoading, message, show, hide }
})
