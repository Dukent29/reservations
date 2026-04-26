<template>
  <div class="admin-donut">
    <svg viewBox="0 0 120 120" class="admin-donut__svg" role="img" :aria-label="title">
      <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(15, 23, 42, 0.08)" stroke-width="18" />
      <circle
        v-for="segment in segments"
        :key="segment.label"
        cx="60"
        cy="60"
        r="42"
        fill="none"
        :stroke="segment.color"
        stroke-width="18"
        :stroke-dasharray="segment.dashArray"
        :stroke-dashoffset="segment.offset"
        stroke-linecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" text-anchor="middle" class="admin-donut__total">{{ total }}</text>
      <text x="60" y="74" text-anchor="middle" class="admin-donut__caption">total</text>
    </svg>

    <div class="admin-donut__legend">
      <div v-for="segment in segments" :key="segment.label" class="admin-donut__legend-item">
        <span class="admin-donut__swatch" :style="{ backgroundColor: segment.color }"></span>
        <span>{{ segment.label }}</span>
        <strong>{{ segment.value }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Distribution',
  },
  items: {
    type: Array,
    default: () => [],
  },
})

const palette = ['#0f766e', '#ef7d57', '#f5b041', '#6c63ff', '#2d6cdf', '#ff6b81']
const circumference = 2 * Math.PI * 42

const total = computed(() =>
  props.items.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
)

const segments = computed(() => {
  let consumed = 0
  return props.items.map((item, index) => {
    const value = Number(item.value) || 0
    const ratio = total.value > 0 ? value / total.value : 0
    const dash = ratio * circumference
    const segment = {
      label: item.label,
      value,
      color: palette[index % palette.length],
      dashArray: `${dash} ${circumference - dash}`,
      offset: -consumed,
    }
    consumed += dash
    return segment
  })
})
</script>
