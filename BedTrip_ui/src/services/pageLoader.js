import { computed, readonly, ref } from 'vue'

// Simple global loader store used by the progress bar.
const activeRequests = ref(0)
const progress = ref(0)
const visible = ref(false)
let tickTimer = null

function clearTimer() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function startProgressLoop() {
  clearTimer()
  tickTimer = setInterval(() => {
    // Ease towards 90% while navigation is pending.
    progress.value = Math.min(progress.value + 0.05, 0.9)
  }, 200)
}

export function startPageLoading() {
  activeRequests.value += 1
  if (activeRequests.value === 1) {
    progress.value = 0.1
    visible.value = true
    startProgressLoop()
  }
}

function finishWithDelay() {
  clearTimer()
  progress.value = 1
  setTimeout(() => {
    if (activeRequests.value === 0) {
      visible.value = false
      progress.value = 0
    }
  }, 200)
}

export function stopPageLoading() {
  if (activeRequests.value === 0) return
  activeRequests.value -= 1
  if (activeRequests.value === 0) {
    finishWithDelay()
  }
}

export function failPageLoading() {
  activeRequests.value = 0
  finishWithDelay()
}

export function usePageLoader() {
  return {
    isVisible: readonly(visible),
    progress: computed(() => Math.round(progress.value * 100)),
  }
}
