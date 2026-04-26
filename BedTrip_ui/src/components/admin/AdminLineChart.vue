<template>
  <div class="admin-chart" role="img" :aria-label="title">
    <svg viewBox="0 0 320 180" class="admin-chart__svg" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path
        v-if="areaPath"
        :d="areaPath"
        :fill="`url(#${gradientId})`"
      />
      <polyline
        v-if="linePath"
        :points="linePath"
        fill="none"
        :stroke="color"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        v-for="point in plottedPoints"
        :key="point.label"
        :cx="point.x"
        :cy="point.y"
        r="4.5"
        :fill="color"
        stroke="#fff9ef"
        stroke-width="2"
      />
    </svg>
    <div class="admin-chart__labels">
      <span v-for="point in points" :key="point.label">{{ point.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Chart',
  },
  points: {
    type: Array,
    default: () => [],
  },
  color: {
    type: String,
    default: '#0f766e',
  },
})

const gradientId = `admin-chart-gradient-${Math.random().toString(36).slice(2, 8)}`
const width = 320
const height = 180
const paddingX = 18
const paddingTop = 16
const paddingBottom = 28

const plottedPoints = computed(() => {
  if (!props.points.length) return []
  const maxValue = Math.max(...props.points.map((point) => Number(point.value) || 0), 1)
  const usableWidth = width - paddingX * 2
  const usableHeight = height - paddingTop - paddingBottom

  return props.points.map((point, index) => {
    const x =
      props.points.length === 1
        ? width / 2
        : paddingX + (usableWidth * index) / (props.points.length - 1)
    const ratio = (Number(point.value) || 0) / maxValue
    const y = height - paddingBottom - ratio * usableHeight
    return {
      ...point,
      x,
      y,
    }
  })
})

const linePath = computed(() =>
  plottedPoints.value.length
    ? plottedPoints.value.map((point) => `${point.x},${point.y}`).join(' ')
    : ''
)

const areaPath = computed(() => {
  if (!plottedPoints.value.length) return ''
  const first = plottedPoints.value[0]
  const last = plottedPoints.value[plottedPoints.value.length - 1]
  return [
    `M ${first.x} ${height - paddingBottom}`,
    ...plottedPoints.value.map((point) => `L ${point.x} ${point.y}`),
    `L ${last.x} ${height - paddingBottom}`,
    'Z',
  ].join(' ')
})
</script>
