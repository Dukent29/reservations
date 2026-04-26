<template>
  <div class="admin-chartjs">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { Chart } from 'chart.js/auto'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
})

const canvasRef = ref(null)
let chartInstance = null

function renderChart() {
  if (!canvasRef.value) return
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  chartInstance = new Chart(canvasRef.value, {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 550,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          labels: {
            color: '#6f6256',
            boxWidth: 12,
            boxHeight: 12,
            useBorderRadius: true,
            borderRadius: 4,
            font: {
              family: 'Manrope',
              size: 12,
              weight: 600,
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(35, 24, 21, 0.92)',
          titleFont: {
            family: 'Manrope',
            size: 12,
            weight: 700,
          },
          bodyFont: {
            family: 'Manrope',
            size: 12,
          },
          padding: 12,
          cornerRadius: 10,
        },
      },
      ...props.options,
    },
  })
}

watch(
  () => [props.type, props.data, props.options],
  () => {
    renderChart()
  },
  { deep: true },
)

onMounted(() => {
  renderChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>
