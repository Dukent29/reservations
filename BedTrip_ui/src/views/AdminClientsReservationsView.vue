<!--
  AdminClientsReservationsView
  ============================
  Back-office page for client reservations and voucher operations.

  Main responsibilities:
  - Search and paginate recent reservations with client and hotel context.
  - Display payment state, voucher state and booking amount.
  - Download generated vouchers for partner orders.
  - Debounce search input to avoid unnecessary admin API calls.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Clients / Réservations</p>
        <h2>Réservations, clients et bons</h2>
      </div>
      <div class="admin-toolbar">
        <label class="admin-search">
          <i class="pi pi-search" aria-hidden="true"></i>
          <input v-model.trim="search" type="text" placeholder="Rechercher un nom, un hôtel, un client ou un email" @keyup.enter="applySearch" />
        </label>
        <button type="button" class="admin-button admin-button--ghost" @click="applySearch" :disabled="loading">
          <i class="pi pi-search" aria-hidden="true"></i>
          <span>{{ loading ? 'Recherche...' : 'Rechercher' }}</span>
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>

    <article class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Réservations</p>
          <h3>Derniers clients et état des réservations</h3>
        </div>
      </header>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Commande partenaire</th>
              <th>Hôtel</th>
              <th>Montant</th>
              <th>Paiement</th>
              <th>Bon</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reservation in reservations" :key="reservation.partner_order_id">
              <td>{{ formatDate(reservation.created_at) }}</td>
              <td>
                <div class="admin-avatar-cell">
                  <div :class="['admin-avatar', `admin-avatar--${getAvatarColor(reservation.user_email)}`]">
                    {{ getAvatarInitial(reservation.user_email) }}
                  </div>
                  <div>
                    <strong>{{ clientDisplayName(reservation) }}</strong>
                    <div class="admin-table__sub">{{ reservation.user_email || reservation.user_phone || '-' }}</div>
                  </div>
                </div>
              </td>
              <td><code>{{ reservation.partner_order_id }}</code></td>
              <td>{{ hotelName(reservation) }}</td>
              <td>{{ formatAmount(reservation.amount, reservation.currency_code) }}</td>
              <td>
                <span :class="['admin-badge', `admin-badge--${statusTone(reservation.payment_status)}`]">
                  {{ paymentStatusLabel(reservation.payment_status) }}
                </span>
              </td>
              <td>
                <span :class="['admin-badge', `admin-badge--${voucherTone(reservation.voucher_status)}`]">
                  {{ voucherStatusLabel(reservation.voucher_status) }}
                </span>
                <div class="admin-table__sub" v-if="reservation.voucher_ready_at">
                  {{ formatDate(reservation.voucher_ready_at) }}
                </div>
              </td>
              <td>
                <button
                  type="button"
                  class="admin-button admin-button--small"
                  :disabled="downloadingId === reservation.partner_order_id"
                  @click="downloadVoucher(reservation.partner_order_id)"
                >
                  {{ downloadingId === reservation.partner_order_id ? 'Téléchargement...' : 'Télécharger le bon' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalReservationsCount > pageSize" class="admin-pagination">
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { downloadAdminVoucher, fetchAdminReservations } from '../services/adminPanelApi'

const pageSize = 15
const reservations = ref([])
const loading = ref(false)
const errorMessage = ref('')
const downloadingId = ref('')
const search = ref('')
const currentPage = ref(1)
const totalReservationsCount = ref(0)
let searchDebounceTimer = null

const totalPages = computed(() => Math.max(1, Math.ceil(totalReservationsCount.value / pageSize)))
const rangeStart = computed(() => (totalReservationsCount.value ? (currentPage.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, totalReservationsCount.value))
const pageRangeLabel = computed(() => `${rangeStart.value} – ${rangeEnd.value} / ${totalReservationsCount.value}`)

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

function hotelName(reservation) {
  return reservation.hotel?.name || '-'
}

function clientDisplayName(reservation) {
  const fullName = String(reservation.client_full_name || '').trim()
  return fullName || reservation.user_name || 'Client'
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid' || normalized === 'success') return 'success'
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

function paymentStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid' || normalized === 'success') return 'Payé'
  if (normalized === 'pending' || normalized === 'initiated') return 'En attente'
  if (normalized === 'failed' || normalized === 'error') return 'Échec'
  if (normalized === 'cancelled') return 'Annulé'
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

async function loadReservations(page = currentPage.value) {
  currentPage.value = Math.max(page, 1)
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminReservations({
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
      q: search.value,
    })
    reservations.value = response?.reservations || []
    totalReservationsCount.value = Number(response?.pagination?.total || 0)
  } catch (error) {
    errorMessage.value = error?.statusCode === 401
      ? 'Votre session admin a expiré.'
      : 'Impossible de charger les réservations.'
  } finally {
    loading.value = false
  }
}

function applySearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  loadReservations(1)
}

function goToPage(page) {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value)
  if (nextPage === currentPage.value) return
  loadReservations(nextPage)
}

async function downloadVoucher(partnerOrderId) {
  downloadingId.value = partnerOrderId
  errorMessage.value = ''
  try {
    await downloadAdminVoucher(partnerOrderId, 'fr')
    await loadReservations()
  } catch (error) {
    errorMessage.value = error?.statusCode === 409
      ? 'Bon en cours de génération. Réessayez dans quelques instants.'
      : 'Impossible de télécharger le bon.'
  } finally {
    downloadingId.value = ''
  }
}

onMounted(() => {
  loadReservations()
})

watch(
  () => search.value,
  () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }
    searchDebounceTimer = window.setTimeout(() => {
      loadReservations(1)
    }, 300)
  }
)

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
})
</script>
