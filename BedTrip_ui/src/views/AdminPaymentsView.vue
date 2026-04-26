<!--
  AdminPaymentsView
  =================
  Back-office page for payment monitoring and settlement follow-up.

  Main responsibilities:
  - Load payment transactions from the admin panel API.
  - Summarize transaction count, paid volume, providers and failed/pending items.
  - Render payment status, provider references and partner order IDs.
  - Support pagination for operational review of recent payments.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Paiements</p>
        <h2>Transactions et état des règlements</h2>
      </div>
      <button type="button" class="admin-button admin-button--ghost" @click="loadPayments" :disabled="loading">
        <i class="pi pi-refresh" aria-hidden="true"></i>
        <span>{{ loading ? 'Actualisation...' : 'Actualiser' }}</span>
      </button>
    </header>

    <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>

    <section class="admin-stat-grid">
      <article class="admin-stat-card">
        <p>Total des transactions</p>
        <strong>{{ payments.length }}</strong>
        <span>{{ successCount }} réussies</span>
      </article>
      <article class="admin-stat-card">
        <p>Volume encaissé</p>
        <strong>{{ totalPaid }}</strong>
        <span>{{ pendingCount }} en attente</span>
      </article>
      <article class="admin-stat-card">
        <p>Prestataires</p>
        <strong>{{ uniqueProviders }}</strong>
        <span>{{ failureCount }} en échec</span>
      </article>
    </section>

    <article class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Transactions</p>
          <h3>Derniers paiements</h3>
        </div>
      </header>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Commande partenaire</th>
              <th>Prestataire</th>
              <th>Statut</th>
              <th>Montant</th>
              <th>Référence externe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in payments" :key="payment.id">
              <td>{{ formatDate(payment.created_at) }}</td>
              <td><code>{{ payment.partner_order_id || '-' }}</code></td>
              <td>{{ payment.provider || 'inconnu' }}</td>
              <td><span :class="['admin-badge', `admin-badge--${statusTone(payment.status)}`]">{{ statusLabel(payment.status) }}</span></td>
              <td>{{ formatAmount(payment.amount, payment.currency_code) }}</td>
              <td>{{ payment.external_reference || payment.systempay_order_id || '-' }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPaymentsCount > pageSize" class="admin-pagination">
          <span class="admin-pagination__info">{{ pageRangeLabel }}</span>
          <div class="admin-pagination__actions">
            <button type="button" class="admin-button admin-button--ghost admin-button--small" :disabled="currentPage <= 1 || loading" @click="goToPage(currentPage - 1)">
              Précédent
            </button>
            <span class="admin-pagination__page">Page {{ currentPage }} / {{ totalPages }}</span>
            <button type="button" class="admin-button admin-button--ghost admin-button--small" :disabled="currentPage >= totalPages || loading" @click="goToPage(currentPage + 1)">
              Suivant
            </button>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchAdminPayments } from '../services/adminPanelApi'

const pageSize = 15
const loading = ref(false)
const errorMessage = ref('')
const payments = ref([])
const totalPaymentsCount = ref(0)
const currentPage = ref(1)

const successCount = computed(() =>
  payments.value.filter((payment) => ['paid', 'success'].includes(String(payment.status || '').toLowerCase())).length
)
const pendingCount = computed(() =>
  payments.value.filter((payment) => ['pending', 'initiated'].includes(String(payment.status || '').toLowerCase())).length
)
const failureCount = computed(() =>
  payments.value.filter((payment) => ['failed', 'error', 'cancelled'].includes(String(payment.status || '').toLowerCase())).length
)
const uniqueProviders = computed(() => new Set(payments.value.map((payment) => payment.provider || 'inconnu')).size)
const totalPaid = computed(() =>
  formatAmount(
    payments.value.reduce((sum, payment) => {
      if (!['paid', 'success'].includes(String(payment.status || '').toLowerCase())) return sum
      return sum + (Number(payment.amount) || 0)
    }, 0),
    'EUR'
  )
)
const totalPages = computed(() => Math.max(1, Math.ceil(totalPaymentsCount.value / pageSize)))
const rangeStart = computed(() => (totalPaymentsCount.value ? (currentPage.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, totalPaymentsCount.value))
const pageRangeLabel = computed(() => `${rangeStart.value} – ${rangeEnd.value} / ${totalPaymentsCount.value}`)

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('fr-FR')
}

function formatAmount(value, currency = 'EUR') {
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

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid' || normalized === 'success') return 'success'
  if (normalized === 'pending' || normalized === 'initiated') return 'warning'
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'danger'
  return 'muted'
}

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid' || normalized === 'success') return 'Payé'
  if (normalized === 'pending' || normalized === 'initiated') return 'En attente'
  if (normalized === 'failed' || normalized === 'error') return 'Échec'
  if (normalized === 'cancelled') return 'Annulé'
  return normalized ? status : '-'
}

async function loadPayments(page = currentPage.value) {
  currentPage.value = Math.max(page, 1)
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminPayments({
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
    })
    payments.value = response?.payments || []
    totalPaymentsCount.value = Number(response?.pagination?.total || 0)
  } catch (error) {
    errorMessage.value = error?.statusCode === 401
      ? 'Votre session admin a expiré.'
      : 'Impossible de charger les paiements.'
  } finally {
    loading.value = false
  }
}

function goToPage(page) {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value)
  if (nextPage === currentPage.value) return
  loadPayments(nextPage)
}

onMounted(() => {
  loadPayments()
})
</script>
