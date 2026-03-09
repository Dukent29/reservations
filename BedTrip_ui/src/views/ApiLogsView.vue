<template>
  <section class="workspace__content api-logs-view">
    <section class="card">
      <h1>API Logs</h1>
      <p class="muted">
        Journal des appels API (ETG, recherche hôtels, réservations).
      </p>

      <div class="filter-bar">
        <span class="filter-label">Filtrer par URL :</span>
        <button
          type="button"
          :class="['mini', 'filter-btn', { 'filter-btn--active': urlFilter === 'all' }]"
          @click="setUrlFilter('all')"
        >
          Tous
        </button>
        <button
          type="button"
          :class="['mini', 'filter-btn', { 'filter-btn--active': urlFilter === 'sandbox' }]"
          @click="setUrlFilter('sandbox')"
        >
          Sandbox seulement
        </button>
        <button
          type="button"
          :class="['mini', 'filter-btn', { 'filter-btn--active': urlFilter === 'prod' }]"
          @click="setUrlFilter('prod')"
        >
          Prod seulement
        </button>
      </div>

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
        {{ pageError }}
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <table class="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Endpoint</th>
              <th>partner_order_id</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="log in logs"
              :key="log.id"
            >
              <tr>
                <td>{{ log.id }}</td>
                <td>{{ formatDate(log.created_at) }}</td>
                <td><code class="endpoint-cell">{{ log.endpoint }}</code></td>
                <td><code class="endpoint-cell">{{ log.partner_order_id || '—' }}</code></td>
                <td><span :class="['badge', 'badge--' + statusClass(log.status_code)]">{{ log.status_code }}</span></td>
                <td>
                  <button
                    type="button"
                    class="mini"
                    @click="toggleExpand(log.id)"
                  >
                    {{ expandedId === log.id ? 'Masquer' : 'Détails' }}
                  </button>
                  <button
                    v-if="log.partner_order_id"
                    type="button"
                    class="mini mini--etg"
                    :disabled="etgLoadingId === log.id"
                    @click="showEtgInfo(log)"
                  >
                    {{ etgLoadingId === log.id ? '…' : 'Show ETG info' }}
                  </button>
                </td>
              </tr>
              <tr
                v-if="expandedId === log.id"
                class="expand-row"
              >
                <td
                  colspan="6"
                  class="expand-cell"
                >
                  <div class="detail-blocks">
                    <div class="detail-block">
                      <strong>Request</strong>
                      <pre>{{ stringify(log.request) }}</pre>
                    </div>
                    <div class="detail-block">
                      <strong>Response</strong>
                      <pre>{{ stringify(log.response) }}</pre>
                    </div>
                  </div>
                </td>
              </tr>
              <tr
                v-if="etgExpandedId === log.id"
                class="expand-row expand-row--etg"
              >
                <td
                  colspan="6"
                  class="expand-cell"
                >
                  <div
                    v-if="etgErrorFor(log.id)"
                    class="etg-error"
                  >
                    {{ etgErrorFor(log.id) }}
                  </div>
                  <div
                    v-else-if="etgDataFor(log.id)"
                    class="detail-blocks"
                  >
                    <div class="detail-block">
                      <strong>ETG Request</strong>
                      <pre>{{ stringify(etgDataFor(log.id).request) }}</pre>
                    </div>
                    <div class="detail-block">
                      <strong>ETG Response</strong>
                      <pre>{{ stringify(etgDataFor(log.id).response) }}</pre>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="mini mini--close"
                    @click="etgExpandedId = null"
                  >
                    Fermer ETG info
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <p
          v-if="logs.length === 0"
          class="muted no-data"
        >
          Aucun log.
        </p>
        <div
          v-if="total > 0"
          class="pagination-bar"
        >
          <span class="pagination-info">
            {{ rangeStart }} – {{ rangeEnd }} / {{ total }}
          </span>
          <div class="pagination-buttons">
            <button
              type="button"
              class="mini"
              :disabled="page <= 1"
              @click="goPage(page - 1)"
            >
              Précédent
            </button>
            <span class="page-num">Page {{ page }}</span>
            <button
              type="button"
              class="mini"
              :disabled="rangeEnd >= total"
              @click="goPage(page + 1)"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const router = useRouter()
const loading = ref(true)
const pageError = ref('')
const logs = ref([])
const total = ref(0)
const expandedId = ref(null)
const page = ref(1)
const limit = 50
const etgExpandedId = ref(null)
const etgData = ref({})
const etgLoadingId = ref(null)
const etgErrors = ref({})
const urlFilter = ref('all')

const rangeStart = computed(() => Math.min(total.value, (page.value - 1) * limit + 1))
const rangeEnd = computed(() => Math.min(total.value, page.value * limit))

function etgDataFor(logId) {
  return etgData.value[logId] || null
}
function etgErrorFor(logId) {
  return etgErrors.value[logId] || null
}

async function showEtgInfo(log) {
  const id = log.partner_order_id
  if (!id) return
  if (etgData.value[log.id]) {
    etgExpandedId.value = etgExpandedId.value === log.id ? null : log.id
    etgErrors.value[log.id] = null
    return
  }
  etgLoadingId.value = log.id
  etgErrors.value[log.id] = null
  try {
    const res = await fetch(`${API_BASE}/api/etg-order-info?partner_order_id=${encodeURIComponent(id)}`)
    const data = await res.json()
    if (!res.ok) {
      etgErrors.value[log.id] = data?.error || data?.message || `HTTP ${res.status}`
      return
    }
    etgData.value[log.id] = {
      request: data.request || {},
      response: data.response || {}
    }
    etgExpandedId.value = log.id
  } catch (e) {
    etgErrors.value[log.id] = e?.message || String(e)
  } finally {
    etgLoadingId.value = null
  }
}

function formatDate(val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? val : d.toLocaleString('fr-FR')
  } catch {
    return val
  }
}

function statusClass(code) {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 400 && code < 500) return 'warning'
  if (code >= 500) return 'error'
  return 'muted'
}

function stringify(obj) {
  if (obj == null) return '—'
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function setUrlFilter(filter) {
  if (urlFilter.value === filter) return
  urlFilter.value = filter
  page.value = 1
  fetchLogs()
}

async function fetchLogs() {
  loading.value = true
  pageError.value = ''
  try {
    const offset = (page.value - 1) * limit
    const filterParam = urlFilter.value !== 'all' ? `&url_filter=${encodeURIComponent(urlFilter.value)}` : ''
    const res = await fetch(`${API_BASE}/api/apilogs?limit=${limit}&offset=${offset}${filterParam}`)
    const data = await res.json()
    if (res.status === 404 || (data && data.error === 'not_found')) {
      router.replace('/')
      return
    }
    if (!res.ok) {
      pageError.value = data?.error || data?.message || `HTTP ${res.status}`
      logs.value = []
      return
    }
    logs.value = data.logs || []
    total.value = data.total ?? 0
  } catch (e) {
    pageError.value = e?.message || String(e)
    logs.value = []
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  if (p < 1) return
  page.value = p
  fetchLogs()
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
  fetchLogs()
})
</script>

<style scoped>
.api-logs-view {
  padding-top: 1rem;
}

.api-logs-view h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.filter-bar {
  margin: 0.75rem 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.9rem;
  color: #64748b;
  margin-right: 0.25rem;
}

.filter-btn {
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
}

.filter-btn:hover {
  background: #f1f5f9;
}

.filter-btn--active {
  border-color: #0ea5e9;
  background: #f0f9ff;
  color: #0369a1;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 1rem;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.logs-table th,
.logs-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.logs-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
}

.endpoint-cell {
  font-size: 0.8rem;
  background: #f1f5f9;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  max-width: 280px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
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

.expand-row .expand-cell {
  padding: 0;
  vertical-align: top;
  background: #f8fafc;
}

.detail-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
}

.detail-block {
  min-width: 0;
}

.detail-block pre {
  margin: 0.25rem 0 0 0;
  padding: 0.5rem;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow: auto;
}

@media (max-width: 768px) {
  .detail-blocks {
    grid-template-columns: 1fr;
  }
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

.pagination-bar {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.pagination-info {
  color: #64748b;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-num {
  color: #475569;
  font-weight: 500;
}

button.mini {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
  margin-right: 0.25rem;
}

button.mini--etg {
  border-color: #0ea5e9;
  background: #f0f9ff;
  color: #0369a1;
}

button.mini--etg:disabled {
  opacity: 0.7;
  cursor: wait;
}

button.mini--close {
  margin-top: 0.5rem;
}

.expand-row--etg .expand-cell {
  background: #f0fdfa;
}

.etg-error {
  padding: 0.75rem;
  color: #b91c1c;
  font-size: 0.9rem;
}
</style>
