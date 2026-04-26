<!--
  AdminDashboardView
  ==================
  Back-office overview dashboard for commercial and operational activity.

  Main responsibilities:
  - Load dashboard metrics for weekly, monthly, yearly or custom periods.
  - Render reservation, revenue and payment summary cards.
  - Feed activity, revenue and payment status charts.
  - Provide date-range validation before custom dashboard refreshes.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Vue d'ensemble</p>
        <h2>Tableau de bord</h2>
      </div>
      <div class="admin-page__controls">
        <label class="admin-inline-field admin-inline-field--row">
          <span>Période :</span>
          <select v-model="selectedPeriod" @change="loadOverview">
            <option value="week">Hebdomadaire</option>
            <option value="month">Mensuelle</option>
            <option value="year">Annuelle</option>
            <option value="custom">Personnalisée</option>
          </select>
        </label>
        <label v-if="selectedPeriod === 'custom'" class="admin-inline-field admin-inline-field--row">
          <span>Du :</span>
          <input v-model="customStartDate" type="date" />
        </label>
        <label v-if="selectedPeriod === 'custom'" class="admin-inline-field admin-inline-field--row">
          <span>Au :</span>
          <input v-model="customEndDate" type="date" />
        </label>
        <button
          type="button"
          class="admin-button admin-button--ghost"
          @click="loadOverview"
          :disabled="loading || (selectedPeriod === 'custom' && !isCustomRangeValid)"
        >
          <i class="pi pi-refresh" aria-hidden="true"></i>
          <span>{{ loading ? 'Actualisation...' : selectedPeriod === 'custom' ? 'Appliquer la période' : 'Actualiser les données' }}</span>
        </button>
      </div>
    </header>

    <p v-if="selectedPeriod === 'custom'" class="admin-inline-note">
      <template v-if="isCustomRangeValid">Période sélectionnée : {{ customPeriodLabel }}</template>
      <template v-else>Saisissez une date de début antérieure ou égale à la date de fin.</template>
    </p>

    <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>

    <section class="admin-stat-grid">
      <article v-for="card in statCards" :key="card.label" class="admin-stat-card">
        <p>{{ card.label }}</p>
        <strong>{{ card.value }}</strong>
        <span>{{ card.hint }}</span>
      </article>
    </section>

    <section class="admin-grid admin-grid--charts">
      <article class="admin-surface">
        <header class="admin-surface__head">
          <div>
            <p class="admin-surface__eyebrow">Activité</p>
            <h3>{{ activityTitle }}</h3>
          </div>
        </header>
        <AdminChartJs
          type="line"
          :data="activityChartData"
          :options="lineOptions"
        />
      </article>

      <article class="admin-surface">
        <header class="admin-surface__head">
          <div>
            <p class="admin-surface__eyebrow">Chiffre d'affaires</p>
            <h3>{{ revenueTitle }}</h3>
          </div>
        </header>
        <AdminChartJs
          type="line"
          :data="revenueChartData"
          :options="lineOptions"
        />
      </article>
    </section>

    <section class="admin-grid admin-grid--secondary">
      <article class="admin-surface">
        <header class="admin-surface__head">
          <div>
            <p class="admin-surface__eyebrow">Réservations</p>
            <h3>Dernières réservations</h3>
          </div>
          <router-link to="/admin/clients" class="admin-button admin-button--small">Voir tout</router-link>
        </header>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Bon</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in recentBookings" :key="booking.partner_order_id">
                <td>{{ formatDate(booking.created_at) }}</td>
                <td>
                  <div class="admin-avatar-cell">
                    <div :class="['admin-avatar', `admin-avatar--${getAvatarColor(booking.user_email)}`]">
                      {{ getAvatarInitial(booking.user_email) }}
                    </div>
                    <div>
                      <strong>{{ getBookingName(booking) }}</strong>
                      <div class="admin-table__sub">{{ booking.user_email || booking.user_phone || '-' }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ formatCurrency(booking.amount, booking.currency_code) }}</td>
                <td>
                  <span :class="['admin-badge', `admin-badge--${statusTone(booking.status)}`]">
                    {{ bookingStatusLabel(booking.status) }}
                  </span>
                </td>
                <td>
                  <span :class="['admin-badge', `admin-badge--${voucherTone(booking.voucher_status)}`]">
                    {{ voucherStatusLabel(booking.voucher_status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="admin-surface">
        <header class="admin-surface__head">
          <div>
            <p class="admin-surface__eyebrow">Répartition</p>
            <h3>{{ providersTitle }}</h3>
          </div>
        </header>
        <AdminChartJs
          type="bar"
          :data="providerBarData"
          :options="barOptions"
        />
      </article>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AdminChartJs from '../components/admin/AdminChartJs.vue'
import { fetchAdminOverview, fetchAdminReservations } from '../services/adminPanelApi'

const loading = ref(false)
const errorMessage = ref('')
const recentBookings = ref([])
const selectedPeriod = ref('week')
const customStartDate = ref(getDefaultRangeStart())
const customEndDate = ref(getDefaultRangeEnd())
const overview = reactive({
  metrics: {
    totalBookings: 0,
    confirmedBookings: 0,
    readyVouchers: 0,
    totalPayments: 0,
    paidRevenue: 0,
    totalUsers: 0,
    totalPosts: 0,
    publishedPosts: 0,
  },
  charts: {
    activity: [],
    revenue: [],
    paymentProviders: [],
  },
})

const periodLabels = {
  week: '7 derniers jours',
  month: '30 derniers jours',
  year: '12 derniers mois',
  custom: 'la période personnalisée',
}

const isCustomRangeValid = computed(() => {
  if (selectedPeriod.value !== 'custom') return true
  return Boolean(customStartDate.value && customEndDate.value && customStartDate.value <= customEndDate.value)
})

const customPeriodLabel = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return 'période incomplète'
  return `${formatDateOnly(customStartDate.value)} au ${formatDateOnly(customEndDate.value)}`
})

const selectedPeriodLabel = computed(() => {
  if (selectedPeriod.value === 'custom' && isCustomRangeValid.value) {
    return customPeriodLabel.value
  }
  return periodLabels[selectedPeriod.value] || periodLabels.week
})

const activityTitle = computed(() => `Réservations sur ${selectedPeriodLabel.value}`)
const revenueTitle = computed(() => `Évolution des paiements sur ${selectedPeriodLabel.value}`)
const providersTitle = computed(() => `Classement des prestataires sur ${selectedPeriodLabel.value}`)

const statCards = computed(() => [
  {
    label: 'Réservations',
    value: overview.metrics.totalBookings,
    hint: `${overview.metrics.confirmedBookings} confirmées`,
  },
  {
    label: "Chiffre d'affaires",
    value: formatCurrency(overview.metrics.paidRevenue),
    hint: `${overview.metrics.totalPayments} paiements enregistrés`,
  },
  {
    label: 'Utilisateurs',
    value: overview.metrics.totalUsers,
    hint: 'Comptes administrateur, éditeur et lecture',
  },
  {
    label: 'Bons prêts',
    value: overview.metrics.readyVouchers,
    hint: `${overview.metrics.unreadNotifications || 0} notifications non lues`,
  },
])

const palette = ['#0f766e', '#ef7d57', '#f5b041', '#2d6cdf', '#6c63ff', '#ff6b81']

const lineOptions = {
  scales: {
    x: {
      ticks: { color: '#6f6256', font: { family: 'Manrope', size: 11 } },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      ticks: { color: '#6f6256', font: { family: 'Manrope', size: 11 } },
      grid: { color: 'rgba(108, 83, 57, 0.1)' },
      border: { display: false },
    },
  },
}

const barOptions = {
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: {
      ticks: { color: '#6f6256', font: { family: 'Manrope', size: 11 } },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      ticks: { color: '#6f6256', font: { family: 'Manrope', size: 11 } },
      grid: { color: 'rgba(108, 83, 57, 0.1)' },
      border: { display: false },
    },
  },
}

const activityChartData = computed(() => ({
  labels: overview.charts.activity.map((item) => item.label),
  datasets: [
    {
      label: 'Réservations',
      data: overview.charts.activity.map((item) => Number(item.value || 0)),
      borderColor: '#0f766e',
      backgroundColor: 'rgba(15, 118, 110, 0.14)',
      fill: true,
      tension: 0.38,
      pointRadius: 4,
      pointHoverRadius: 5,
    },
  ],
}))

const revenueChartData = computed(() => ({
  labels: overview.charts.revenue.map((item) => item.label),
  datasets: [
    {
      label: "Chiffre d'affaires",
      data: overview.charts.revenue.map((item) => Number(item.value || 0)),
      borderColor: '#ef7d57',
      backgroundColor: 'rgba(239, 125, 87, 0.14)',
      fill: true,
      tension: 0.38,
      pointRadius: 4,
      pointHoverRadius: 5,
    },
  ],
}))

const providerBarData = computed(() => ({
  labels: overview.charts.paymentProviders.map((item) => item.label),
  datasets: [
    {
      label: 'Transactions',
      data: overview.charts.paymentProviders.map((item) => Number(item.value || 0)),
      backgroundColor: palette,
      borderRadius: 10,
      borderSkipped: false,
    },
  ],
}))

function formatCurrency(value, currency = 'EUR') {
  const amount = Number(value) || 0
  const normalizedCurrency = String(currency || 'EUR').trim().toUpperCase() || 'EUR'

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount)
  } catch (_) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('fr-FR')
}

function formatDateOnly(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultRangeEnd() {
  return toDateInputValue(new Date())
}

function getDefaultRangeStart() {
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return toDateInputValue(start)
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'success', 'confirmed', 'completed', 'ok'].includes(normalized)) return 'success'
  if (normalized === 'pending' || normalized === 'initiated') return 'warning'
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'danger'
  return 'muted'
}

function voucherTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'ready') return 'success'
  if (normalized === 'queued' || normalized === 'processing') return 'warning'
  if (normalized === 'failed') return 'danger'
  return 'muted'
}

function getAvatarInitial(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return normalized.charAt(0).toUpperCase() || '?'
}

function getAvatarColor(email) {
  const colors = ['teal', 'orange', 'amber', 'blue', 'purple', 'pink']
  const normalized = String(email || '').trim().toLowerCase()
  const hash = normalized.charCodeAt(0) || 0
  return colors[hash % colors.length]
}

function getBookingName(booking) {
  const fullName = String(booking.client_full_name || '').trim()
  return fullName || booking.user_name || 'Client'
}

function bookingStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'confirmed') return 'Confirmée'
  if (normalized === 'completed' || normalized === 'ok') return 'Terminée'
  if (normalized === 'pending' || normalized === 'initiated') return 'En attente'
  if (normalized === 'failed' || normalized === 'error') return 'Échec'
  if (normalized === 'cancelled') return 'Annulée'
  return normalized ? status : 'Inconnu'
}

function voucherStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'ready') return 'Prêt'
  if (normalized === 'queued') return 'En file'
  if (normalized === 'processing') return 'En cours'
  if (normalized === 'failed') return 'Échec'
  return normalized ? status : 'Non demandé'
}

async function loadRecentBookings() {
  try {
    const response = await fetchAdminReservations({ limit: 3, offset: 0 })
    recentBookings.value = response?.reservations || []
  } catch (error) {
    console.error('Impossible de charger les dernières réservations :', error)
  }
}

async function loadOverview() {
  if (selectedPeriod.value === 'custom' && !isCustomRangeValid.value) {
    errorMessage.value = 'Choisissez une plage de dates valide pour afficher le tableau de bord.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminOverview({
      period: selectedPeriod.value,
      start: selectedPeriod.value === 'custom' ? customStartDate.value : '',
      end: selectedPeriod.value === 'custom' ? customEndDate.value : '',
    })
    overview.metrics = response?.metrics || overview.metrics
    overview.charts = response?.charts || overview.charts
    if (response?.period) {
      selectedPeriod.value = response.period
    }
    if (response?.range?.start) {
      customStartDate.value = response.range.start
    }
    if (response?.range?.end) {
      customEndDate.value = response.range.end
    }
    await loadRecentBookings()
  } catch (error) {
    errorMessage.value = error?.statusCode === 401
      ? 'Votre session admin a expiré.'
      : 'Impossible de charger le tableau de bord.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOverview()
})
</script>
