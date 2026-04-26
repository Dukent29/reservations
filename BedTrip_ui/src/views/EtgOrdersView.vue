<!--
  EtgOrdersView
  =============
  Internal operations view for completed ETG / RateHawk supplier orders.

  Main responsibilities:
  - Load completed supplier orders for the active ETG environment.
  - Display order IDs, partner references, dates, status and amounts.
  - Surface ETG environment and partner configuration so test/prod data is clear.
  - Help diagnose host allowlist and supplier access errors.
-->

<template>
  <section class="workspace__content etg-orders-view">
    <section class="card">
      <h1>Commandes ETG (complétées)</h1>
      <p class="muted">
        Liste de toutes les commandes complétées côté ETG (RateHawk / Emerging Travel).
      </p>
      <div
        v-if="etgEnvLabel"
        class="etg-env-bar"
      >
        <span>
          Environnement ETG : <strong :class="etgEnv === 'sandbox' ? 'etg-env--test' : 'etg-env--live'">{{ etgEnvLabel }}</strong>
        </span>
        <router-link
          :to="switchEnvRoute"
          class="btn-switch-env"
        >
          {{ switchEnvButtonLabel }}
        </router-link>
      </div>
      <div
        v-if="etgBaseUrl || etgPartnerId"
        class="etg-config-bar"
      >
        <span v-if="etgPartnerId">Partner ID : <code>{{ etgPartnerId }}</code></span>
        <span v-if="etgBaseUrl">Endpoint : <code class="endpoint-url">{{ etgBaseUrl }}</code></span>
      </div>
      <p class="etg-hint">
        Les commandes affichées sont celles liées à ces identifiants ETG. Même clé sur dev et prod → mêmes commandes. Si vous ne voyez pas vos réservations, essayez <strong>Switch to TEST</strong> (commandes sandbox) ou <strong>PROD</strong> (commandes production).
      </p>

      <div
        v-if="loading"
        class="loading-state"
      >
        Chargement…
      </div>
      <div
        v-else-if="pageError"
        class="error-state"
      >
        <template v-if="pageError === 'not_allowed_host'">
          <p><strong>not_allowed_host</strong></p>
          <p class="error-hint">
            L’API ETG n’accepte les requêtes que depuis des adresses IP/hôtes autorisés dans votre compte partenaire.
            Ajoutez l’adresse IP du serveur qui héberge cette application dans le portail RateHawk (Paramètres → API ou Sécurité → Hôtes autorisés), puis réessayez.
          </p>
          <p class="error-hint">
            <a href="https://partner.ratehawk.com" target="_blank" rel="noopener">partner.ratehawk.com</a> → Profil → Paramètres → API / Sécurité.
          </p>
        </template>
        <template v-else>
          {{ pageError }}
        </template>
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <table class="orders-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Order ID (ETG)</th>
              <th>Partner order id</th>
              <th>Hôtel</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Nuits</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="o in orders"
              :key="o.order_id"
            >
              <td>{{ formatDate(o.created_at) }}</td>
              <td><code>{{ o.order_id ?? '—' }}</code></td>
              <td><code>{{ partnerOrderId(o) }}</code></td>
              <td>{{ hotelName(o) }}</td>
              <td>{{ formatDate(o.checkin_at) }}</td>
              <td>{{ formatDate(o.checkout_at) }}</td>
              <td>{{ o.nights ?? '—' }}</td>
              <td>{{ formatAmount(o) }}</td>
              <td><span :class="['badge', 'badge--' + statusClass(o.status)]">{{ o.status ?? '—' }}</span></td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="orders.length === 0 && !loading"
          class="muted no-data"
        >
          Aucune commande complétée.
        </p>
        <p
          v-else-if="orders.length > 0"
          class="pagination-info"
        >
          {{ total_orders }} commande(s) affichée(s)
        </p>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const pageError = ref('')
const orders = ref([])
const total_orders = ref(0)
const etgEnv = ref('')
const etgEnvLabel = ref('')
const etgBaseUrl = ref('')
const etgPartnerId = ref('')

const isTestEnv = computed(() => String(route.query.sys || '').toLowerCase() === 'test')

const switchEnvRoute = computed(() =>
  isTestEnv.value
    ? { path: '/show/etg' }
    : { path: '/show/etg', query: { sys: 'test' } }
)

const switchEnvButtonLabel = computed(() =>
  isTestEnv.value ? 'Switch to PROD' : 'Switch to TEST'
)

function formatDate(val) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? val : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

function partnerOrderId(o) {
  const partner = o.partner_data
  if (!partner || typeof partner !== 'object') return '—'
  return partner.partner_order_id ?? partner.order_comment ?? partner.order_id ?? '—'
}

function hotelName(o) {
  const h = o.hotel_data
  if (!h || typeof h !== 'object') return '—'
  return h.name ?? h.hotel_name ?? (h.hid ? `Hotel ${h.hid}` : '—')
}

function formatAmount(o) {
  const amt = o.amount_sell ?? o.amount_payable
  const obj = amt && typeof amt === 'object' ? amt : null
  const amount = obj?.amount ?? amt
  const currency = obj?.currency_code ?? o.currency_code ?? 'EUR'
  if (amount == null) return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)} ${currency}`
}

function statusClass(status) {
  if (!status) return 'muted'
  const s = String(status).toLowerCase()
  if (s === 'completed' || s === 'confirmed') return 'success'
  if (s === 'cancelled' || s === 'failed' || s === 'rejected') return 'error'
  return 'muted'
}

async function fetchOrders() {
  loading.value = true
  pageError.value = ''
  const sysParam = isTestEnv.value ? '?sys=test' : ''
  try {
    const res = await fetch(`${API_BASE}/api/etg-orders${sysParam}`)
    const data = await res.json()
    if (res.status === 404 || (data && data.error === 'not_found')) {
      router.replace('/')
      return
    }
    if (!res.ok) {
      pageError.value = data?.error || data?.message || `HTTP ${res.status}`
      orders.value = []
      return
    }
    orders.value = data.orders || []
    total_orders.value = data.total_orders ?? orders.value.length
    if (data.etgEnv != null) etgEnv.value = data.etgEnv
    if (data.etgEnvLabel != null) etgEnvLabel.value = data.etgEnvLabel
    if (data.etgBaseUrl != null) etgBaseUrl.value = data.etgBaseUrl
    if (data.etgPartnerId != null) etgPartnerId.value = data.etgPartnerId
  } catch (e) {
    pageError.value = e?.message || String(e)
    orders.value = []
  } finally {
    loading.value = false
  }
}

function setEnvFromRoute() {
  etgEnv.value = isTestEnv.value ? 'sandbox' : 'prod'
  etgEnvLabel.value = isTestEnv.value ? 'TEST (Sandbox)' : 'LIVE (Production)'
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/config`)
    const data = await res.json()
    if (!data || data.autofill !== true) {
      router.replace('/')
      return
    }
    setEnvFromRoute()
  } catch {
    router.replace('/')
    return
  }
  fetchOrders()
})

watch(
  () => route.query.sys,
  () => {
    setEnvFromRoute()
    fetchOrders()
  }
)
</script>

<style scoped>
.etg-orders-view {
  padding-top: 1rem;
}

.etg-orders-view h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.etg-env-bar {
  margin: 0.5rem 0 0 0;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-switch-env {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid #0ea5e9;
  background: #f0f9ff;
  color: #0369a1;
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
}

.btn-switch-env:hover {
  background: #e0f2fe;
}

.etg-env--live {
  color: #166534;
}

.etg-env--test {
  color: #92400e;
}

.etg-config-bar {
  margin: 0.5rem 0 0 0;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.etg-config-bar code {
  background: #e2e8f0;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.etg-config-bar .endpoint-url {
  word-break: break-all;
}

.etg-hint {
  margin: 0.5rem 0 0 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 6px;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 1rem;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.orders-table th,
.orders-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.orders-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
}

.orders-table code {
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
  text-align: left;
}

.error-state .error-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.9rem;
  color: #475569;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.error-state .error-hint a {
  color: #0369a1;
}

.no-data {
  padding: 1.5rem;
  text-align: center;
}

.pagination-info {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #64748b;
}

button.mini {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
}
</style>
