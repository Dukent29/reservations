<!--
  ReservationsListView
  ====================
  Internal reservation monitor combining local booking records with ETG status.

  Main responsibilities:
  - Load reservation rows from the backend.
  - Display local database status beside supplier status.
  - Surface partner order IDs, ETG order IDs, traveler data and amounts.
  - Show database and supplier error reasons for operational follow-up.
-->

<template>
  <section class="workspace__content reservations-list-view">
    <section class="card">
      <h1>Réservations</h1>
      <p class="muted">
        Liste des réservations (veritabanı + ETG).
      </p>

      <div
        v-if="loading"
        class="loading-state"
      >
        Chargement…
      </div>
      <div
        v-else-if="error"
        class="error-state"
      >
        {{ error }}
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <table class="reservations-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Réf. partenaire</th>
              <th>Réf. fournisseur (ETG)</th>
              <th>Hôtel</th>
              <th>Voyageur</th>
              <th>Montant</th>
              <th>Statut (DB)</th>
              <th>Statut ETG</th>
              <th>Raison erreur (DB)</th>
              <th>Raison erreur (ETG)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in reservations"
              :key="r.id || r.partner_order_id"
            >
              <td>{{ formatDate(r.created_at) }}</td>
              <td><code>{{ r.partner_order_id || '-' }}</code></td>
              <td><code>{{ r.etg_order_id ?? r.etg_status?.id ?? '-' }}</code></td>
              <td>{{ hotelName(r) }}</td>
              <td>{{ r.user_name || r.user_email || '-' }}</td>
              <td>{{ formatAmount(r.amount, r.currency_code) }}</td>
              <td><span :class="['badge', 'badge--' + statusClass(r.status)]">{{ r.status || '-' }}</span></td>
              <td>{{ etgStatusText(r.etg_status) }}</td>
              <td class="reason-cell">{{ errorReasonFromDb(r) }}</td>
              <td class="reason-cell">{{ errorReasonFromEtg(r.etg_status) }}</td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="reservations.length === 0"
          class="muted no-data"
        >
          Aucune réservation.
        </p>
      </div>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const reservations = ref([])

function formatDate(val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? val : d.toLocaleString('fr-FR')
  } catch {
    return val
  }
}

function hotelName(r) {
  const form = r.booking_form
  if (!form || typeof form !== 'object') return '-'
  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel
  return hotel?.name || form.hotel_name || form.hotelName || form.name || '-'
}

function formatAmount(amount, currency) {
  if (amount == null) return '-'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '-'
  const cur = currency || 'EUR'
  return `${n.toFixed(2)} ${cur}`
}

function statusClass(status) {
  if (!status) return 'muted'
  const s = String(status).toLowerCase()
  if (s === 'paid' || s === 'confirmed' || s === 'ok') return 'success'
  if (s === 'pending' || s === 'initiated') return 'warning'
  if (s === 'failed' || s === 'error' || s === 'cancelled') return 'error'
  return 'muted'
}

function etgStatusText(etg) {
  if (etg == null) return '-'
  if (etg._error) return `Erreur: ${etg._error}`
  const status = etg.status ?? etg.order_status ?? etg.booking_status
  if (status != null) return String(status)
  return typeof etg === 'object' ? '—' : String(etg)
}

/** Neden "error" (DB'de kayıtlı): ETG finish cevabı raw içinde. */
function errorReasonFromDb(r) {
  if (String(r?.status || '').toLowerCase() !== 'error') return '—'
  const raw = r.raw
  if (!raw || typeof raw !== 'object') return '—'
  const msg = raw.message ?? raw.error ?? raw.reason ?? raw.error_message
  if (msg != null && String(msg).trim()) return String(msg).trim()
  const debug = raw.debug
  if (debug != null) {
    if (typeof debug === 'string') return debug
    const dMsg = debug?.error ?? debug?.message ?? debug?.reason
    if (dMsg != null) return String(dMsg)
  }
  return raw.error_code ? `Code: ${raw.error_code}` : '—'
}

/** Neden ETG status/check hata: _error (exception) veya ETG cevabındaki message/error. */
function errorReasonFromEtg(etg) {
  if (etg == null) return '—'
  if (etg._error) {
    let s = etg._error
    if (etg._http) s += ` (HTTP ${etg._http})`
    if (etg._debug && typeof etg._debug === 'object') {
      const d = etg._debug.error ?? etg._debug.message ?? etg._debug.reason
      if (d) s += ` — ${d}`
    } else if (etg._debug && typeof etg._debug === 'string') {
      s += ` — ${etg._debug}`
    }
    return s
  }
  const msg = etg.message ?? etg.error ?? etg.reason ?? etg.error_message
  if (msg != null && String(msg).trim()) return String(msg).trim()
  const debug = etg.debug
  if (debug != null && typeof debug === 'object') {
    const d = debug.error ?? debug.message ?? debug.reason
    if (d) return String(d)
  }
  return '—'
}

async function fetchReservations() {
  loading.value = true
  error.value = ''
  try {
    const url = `${API_BASE}/api/booking/reservations?limit=100&etg=true`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) {
      error.value = data?.error || data?.message || `HTTP ${res.status}`
      reservations.value = []
      return
    }
    reservations.value = data.reservations || []
  } catch (e) {
    error.value = e?.message || String(e)
    reservations.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/config`)
    const data = await res.json()
    if (!data || data.autofill !== true) {
      router.replace('/')
      return
    }
  } catch {
    router.replace('/')
    return
  }
  fetchReservations()
})
</script>

<style scoped>
.reservations-list-view {
  padding-top: 1rem;
}

.reservations-list-view h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 1rem;
}

.reservations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.reservations-table th,
.reservations-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.reservations-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
}

.reservations-table code {
  font-size: 0.8rem;
  background: #f1f5f9;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.badge--success {
  background: #dcfce7;
  color: #166534;
}

.badge--warning {
  background: #fef3c7;
  color: #92400e;
}

.badge--error {
  background: #fee2e2;
  color: #991b1b;
}

.badge--muted {
  background: #f1f5f9;
  color: #64748b;
}

.loading-state,
.error-state {
  padding: 1.5rem;
  text-align: center;
}

.error-state {
  color: #b91c1c;
}

.no-data {
  padding: 1.5rem;
  text-align: center;
}

.reason-cell {
  max-width: 280px;
  font-size: 0.8rem;
  color: #64748b;
  word-break: break-word;
}
</style>
