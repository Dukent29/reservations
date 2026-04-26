<template>
  <div class="admin-bars" role="img" :aria-label="title">
    <div v-for="item in normalizedItems" :key="item.label" class="admin-bars__row">
      <div class="admin-bars__meta">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
      <div class="admin-bars__track">
        <span class="admin-bars__fill" :style="{ width: `${item.ratio}%`, background: color }"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Bars',
  },
  items: {
    type: Array,
    default: () => [],
  },
  color: {
    type: String,
    default: 'linear-gradient(90deg, #ef7d57 0%, #f5b041 100%)',
  },
})

const normalizedItems = computed(() => {
  const maxValue = Math.max(...props.items.map((item) => Number(item.value) || 0), 1)
  return props.items.map((item) => ({
    ...item,
    ratio: Math.max(8, ((Number(item.value) || 0) / maxValue) * 100),
  }))
})
</script>
