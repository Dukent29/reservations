<script setup>
import { computed } from 'vue'
import { usePageLoader } from '../services/pageLoader'

const { isVisible, progress } = usePageLoader()
const widthStyle = computed(() => `${progress.value}%`)
</script>

<template>
  <transition name="page-progress">
    <div
      v-if="isVisible"
      class="page-progress"
    >
      <span
        class="page-progress__bar"
        :style="{ width: widthStyle }"
      ></span>
    </div>
  </transition>
</template>

<style scoped>
.page-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 9999;
  background: transparent;
}

.page-progress__bar {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #f83838, #fd6565);
  transition: width 0.2s ease;
}

.page-progress-enter-active,
.page-progress-leave-active {
  transition: opacity 0.2s ease;
}

.page-progress-enter-from,
.page-progress-leave-to {
  opacity: 0;
}
</style>
