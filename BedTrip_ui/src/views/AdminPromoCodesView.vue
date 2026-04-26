<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Codes promo</p>
        <h2>Promotions</h2>
      </div>
      <div class="promo-admin-header-actions">
        <button type="button" class="admin-button admin-button--ghost" :disabled="loading" @click="loadPromoCodes">
          Actualiser
        </button>
        <button type="button" class="admin-button" @click="openCreateForm">
          Créer un code
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="admin-blog-form__success">{{ successMessage }}</p>

    <section class="admin-stat-grid promo-stats">
      <article class="admin-stat-card">
        <p>Total</p>
        <strong>{{ promoStats.total }}</strong>
        <span>codes enregistrés</span>
      </article>
      <article class="admin-stat-card">
        <p>Actifs</p>
        <strong>{{ promoStats.active }}</strong>
        <span>utilisables maintenant</span>
      </article>
      <article class="admin-stat-card">
        <p>Utilisations</p>
        <strong>{{ promoStats.used }}</strong>
        <span>{{ promoStats.remaining }} restantes</span>
      </article>
      <article class="admin-stat-card">
        <p>Alertes</p>
        <strong>{{ promoStats.expired + promoStats.maxed }}</strong>
        <span>expirés ou épuisés</span>
      </article>
    </section>

    <article class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Liste</p>
          <h3>Codes existants</h3>
        </div>
        <p class="promo-admin-count">{{ promoCodes.length }} code{{ promoCodes.length > 1 ? 's' : '' }}</p>
      </header>

      <p v-if="loading" class="admin-inline-note">Chargement...</p>
      <div v-else-if="promoCodes.length" class="admin-table-wrap">
        <table class="admin-table promo-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Remise</th>
              <th>Statut</th>
              <th>Expiration</th>
              <th>Utilisations</th>
              <th>Restantes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="promo in promoCodes" :key="promo.id">
              <td>
                <div class="promo-code-cell">
                  <code>{{ promo.code }}</code>
                  <span v-if="promo.min_amount" class="admin-table__sub">
                    Min. {{ formatAmount(promo.min_amount) }}
                  </span>
                </div>
              </td>
              <td>{{ formatDiscount(promo) }}</td>
              <td>
                <span :class="['admin-badge', `admin-badge--${statusTone(promo)}`]">
                  {{ statusLabel(promo) }}
                </span>
              </td>
              <td>
                <div>{{ expiryLabel(promo) }}</div>
                <div class="admin-table__sub">{{ formatDate(promo.end_date) }}</div>
              </td>
              <td>
                <div class="promo-usage">
                  <span>{{ usageCount(promo) }} / {{ maxUses(promo) }}</span>
                  <span class="promo-usage__bar">
                    <span :style="{ width: `${usagePercent(promo)}%` }"></span>
                  </span>
                </div>
              </td>
              <td>
                <strong>{{ remainingUses(promo) }}</strong>
              </td>
              <td class="promo-admin-actions">
                <button type="button" class="admin-button admin-button--ghost admin-button--small" @click="editPromo(promo)">
                  Modifier
                </button>
                <button type="button" class="admin-button admin-button--ghost admin-button--small admin-blog-list__delete" @click="removePromo(promo)">
                  Supprimer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="promo-empty">
        <p>Aucun code promo.</p>
        <button type="button" class="admin-button" @click="openCreateForm">
          Créer le premier code
        </button>
      </div>
    </article>

    <form v-if="showEditor" class="admin-surface promo-admin-form" @submit.prevent="savePromoCode">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">{{ editingId ? 'Modification' : 'Création' }}</p>
          <h3>{{ editingId ? 'Modifier le code promo' : 'Créer un code promo' }}</h3>
        </div>
        <button type="button" class="admin-button admin-button--ghost admin-button--small" @click="closeForm">
          Fermer
        </button>
      </header>

      <div class="promo-admin-form__grid">
        <label class="admin-inline-field">
          Code
          <input v-model="form.code" type="text" placeholder="SUMMER10" required />
        </label>
        <label class="admin-inline-field">
          Type
          <select v-model="form.type">
            <option value="percentage">Pourcentage</option>
            <option value="fixed">Montant fixe</option>
          </select>
        </label>
        <label class="admin-inline-field">
          Valeur
          <input v-model.number="form.value" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="admin-inline-field">
          Montant minimum
          <input v-model.number="form.min_amount" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-inline-field">
          Utilisations totales
          <input v-model.number="form.max_uses" type="number" min="1" step="1" />
        </label>
        <label class="admin-inline-field">
          Utilisation par client
          <input v-model.number="form.per_user_limit" type="number" min="1" step="1" />
        </label>
        <label class="admin-inline-field">
          Début
          <input v-model="form.start_date" type="datetime-local" required />
        </label>
        <label class="admin-inline-field">
          Fin
          <input v-model="form.end_date" type="datetime-local" required />
        </label>
        <label class="promo-active-toggle">
          <span>Statut</span>
          <span class="promo-toggle-row">
            <span class="checkbox-wrapper-2">
              <input v-model="form.is_active" type="checkbox" class="promo-toggle-input" />
            </span>
            <strong>{{ form.is_active ? 'Actif' : 'Inactif' }}</strong>
          </span>
        </label>
      </div>

      <div class="promo-form-summary">
        <span>{{ form.type === 'percentage' ? `${Number(form.value || 0)}%` : formatAmount(form.value || 0) }}</span>
        <span>{{ Number(form.max_uses || 20) }} utilisations max</span>
        <span>Expire {{ formatDate(form.end_date) }}</span>
      </div>

      <div class="admin-blog-form__actions">
        <button type="button" class="admin-button admin-button--ghost" :disabled="saving" @click="closeForm">
          Annuler
        </button>
        <button type="submit" class="admin-button" :disabled="saving">
          {{ saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Créer le code' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  createAdminPromoCode,
  deleteAdminPromoCode,
  fetchAdminPromoCodes,
  updateAdminPromoCode,
} from '../services/adminPanelApi'

const promoCodes = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const editingId = ref(null)
const showEditor = ref(false)

function toLocalInputValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(d.getTime())) return ''
  const offsetMs = d.getTimezoneOffset() * 60 * 1000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
}

function defaultEndDate() {
  return toLocalInputValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
}

const form = ref({
  code: '',
  type: 'percentage',
  value: 10,
  min_amount: '',
  max_uses: 20,
  per_user_limit: 1,
  start_date: toLocalInputValue(new Date()),
  end_date: defaultEndDate(),
  is_active: true,
})

const promoStats = computed(() => {
  const rows = promoCodes.value || []
  return rows.reduce(
    (stats, promo) => {
      stats.total += 1
      stats.used += usageCount(promo)
      stats.remaining += remainingUses(promo)
      const state = statusKey(promo)
      if (state === 'active') stats.active += 1
      if (state === 'expired') stats.expired += 1
      if (state === 'maxed') stats.maxed += 1
      return stats
    },
    { total: 0, active: 0, used: 0, remaining: 0, expired: 0, maxed: 0 },
  )
})

function resetForm() {
  editingId.value = null
  form.value = {
    code: '',
    type: 'percentage',
    value: 10,
    min_amount: '',
    max_uses: 20,
    per_user_limit: 1,
    start_date: toLocalInputValue(new Date()),
    end_date: defaultEndDate(),
    is_active: true,
  }
}

function openCreateForm() {
  resetForm()
  showEditor.value = true
  scrollEditorIntoView()
}

function closeForm() {
  showEditor.value = false
  resetForm()
}

function scrollEditorIntoView() {
  nextTick(() => {
    const el = document.querySelector('.promo-admin-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function buildPayload() {
  return {
    code: String(form.value.code || '').trim().toUpperCase(),
    type: form.value.type,
    value: Number(form.value.value),
    min_amount: form.value.min_amount === '' ? undefined : Number(form.value.min_amount),
    max_uses: Number(form.value.max_uses) || 20,
    per_user_limit: Number(form.value.per_user_limit) || 1,
    start_date: new Date(form.value.start_date).toISOString(),
    end_date: new Date(form.value.end_date).toISOString(),
    is_active: form.value.is_active,
  }
}

async function loadPromoCodes() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminPromoCodes({ limit: 100, offset: 0 })
    promoCodes.value = response?.promo_codes || []
  } catch (err) {
    errorMessage.value = err?.message || 'Impossible de charger les codes promo.'
  } finally {
    loading.value = false
  }
}

async function savePromoCode() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = buildPayload()
    if (editingId.value) {
      await updateAdminPromoCode(editingId.value, payload)
      successMessage.value = 'Code promo mis à jour.'
    } else {
      await createAdminPromoCode(payload)
      successMessage.value = 'Code promo créé.'
    }
    closeForm()
    await loadPromoCodes()
  } catch (err) {
    errorMessage.value = err?.data?.error || err?.message || 'Enregistrement impossible.'
  } finally {
    saving.value = false
  }
}

function editPromo(promo) {
  editingId.value = promo.id
  showEditor.value = true
  form.value = {
    code: promo.code || '',
    type: promo.type || 'percentage',
    value: Number(promo.value || 0),
    min_amount: promo.min_amount == null ? '' : Number(promo.min_amount),
    max_uses: Number(promo.max_uses || 20),
    per_user_limit: Number(promo.per_user_limit || 1),
    start_date: toLocalInputValue(promo.start_date),
    end_date: toLocalInputValue(promo.end_date),
    is_active: promo.is_active === true,
  }
  scrollEditorIntoView()
}

async function removePromo(promo) {
  if (!window.confirm(`Supprimer le code ${promo.code} ?`)) return
  try {
    await deleteAdminPromoCode(promo.id)
    await loadPromoCodes()
  } catch (err) {
    errorMessage.value = err?.data?.error || err?.message || 'Suppression impossible.'
  }
}

function usageCount(promo) {
  return Math.max(0, Number(promo?.used_count || 0))
}

function maxUses(promo) {
  return Math.max(1, Number(promo?.max_uses || 0) || 20)
}

function remainingUses(promo) {
  return Math.max(0, maxUses(promo) - usageCount(promo))
}

function usagePercent(promo) {
  return Math.min(100, Math.round((usageCount(promo) / maxUses(promo)) * 100))
}

function statusKey(promo) {
  const now = Date.now()
  const start = Date.parse(promo?.start_date)
  const end = Date.parse(promo?.end_date)
  if (!promo?.is_active) return 'inactive'
  if (Number.isFinite(end) && now > end) return 'expired'
  if (remainingUses(promo) <= 0) return 'maxed'
  if (Number.isFinite(start) && now < start) return 'upcoming'
  return 'active'
}

function statusLabel(promo) {
  const labels = {
    active: 'Actif',
    inactive: 'Inactif',
    expired: 'Expiré',
    maxed: 'Épuisé',
    upcoming: 'À venir',
  }
  return labels[statusKey(promo)] || 'Inconnu'
}

function statusTone(promo) {
  const tones = {
    active: 'success',
    inactive: 'muted',
    expired: 'danger',
    maxed: 'warning',
    upcoming: 'warning',
  }
  return tones[statusKey(promo)] || 'muted'
}

function expiryLabel(promo) {
  const end = new Date(promo?.end_date)
  if (!Number.isFinite(end.getTime())) return '-'
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return `Expiré depuis ${Math.abs(diffDays)} j`
  if (diffDays === 0) return "Expire aujourd'hui"
  return `Expire dans ${diffDays} j`
}

function formatDiscount(promo) {
  const value = Number(promo.value || 0)
  if (promo.type === 'fixed') return formatAmount(value)
  return `${value.toFixed(0)}%`
}

function formatAmount(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

onMounted(loadPromoCodes)
</script>

<style scoped>
.promo-admin-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.promo-stats {
  margin-bottom: 1rem;
}

.promo-admin-count {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 700;
}

.promo-table td {
  vertical-align: middle;
}

.promo-code-cell {
  display: grid;
  gap: 0.2rem;
}

.promo-code-cell code {
  width: max-content;
  border-radius: 0.4rem;
  background: #eef2ff;
  color: #263b77;
  padding: 0.18rem 0.42rem;
  font-weight: 800;
}

.promo-usage {
  display: grid;
  gap: 0.35rem;
  min-width: 110px;
}

.promo-usage__bar {
  height: 0.45rem;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.promo-usage__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #376bb0;
}

.promo-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.promo-empty {
  display: grid;
  justify-items: start;
  gap: 0.7rem;
  color: #64748b;
}

.promo-empty p {
  margin: 0;
}

.promo-admin-form {
  margin-top: 1rem;
}

.promo-admin-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.85rem;
  align-items: end;
}

.promo-active-toggle {
  min-height: 42px;
  display: grid;
  gap: 0.45rem;
  align-content: end;
  color: #334155;
  font-size: 0.82rem;
  font-weight: 800;
}

.promo-toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.promo-toggle-row strong {
  color: #0f172a;
  font-size: 0.86rem;
}

.checkbox-wrapper-2 {
  display: inline-flex;
  align-items: center;
}

.checkbox-wrapper-2 .promo-toggle-input {
  appearance: none;
  background-color: #dfe1e4;
  border-radius: 72px;
  border-style: none;
  flex-shrink: 0;
  height: 20px;
  margin: 0;
  position: relative;
  width: 30px;
}

.checkbox-wrapper-2 .promo-toggle-input::before {
  bottom: -6px;
  content: "";
  left: -6px;
  position: absolute;
  right: -6px;
  top: -6px;
}

.checkbox-wrapper-2 .promo-toggle-input,
.checkbox-wrapper-2 .promo-toggle-input::after {
  transition: all 100ms ease-out;
}

.checkbox-wrapper-2 .promo-toggle-input::after {
  background-color: #fff;
  border-radius: 50%;
  content: "";
  height: 14px;
  left: 3px;
  position: absolute;
  top: 3px;
  width: 14px;
}

.checkbox-wrapper-2 input[type="checkbox"] {
  cursor: pointer;
}

.checkbox-wrapper-2 .promo-toggle-input:hover {
  background-color: #c9cbcd;
  transition-duration: 0s;
}

.checkbox-wrapper-2 .promo-toggle-input:checked {
  background-color: #376bb0;
}

.checkbox-wrapper-2 .promo-toggle-input:checked::after {
  background-color: #fff;
  left: 13px;
}

.checkbox-wrapper-2 .promo-toggle-input:focus-visible {
  outline: 2px solid rgba(55, 107, 176, 0.35);
  outline-offset: 3px;
}

.checkbox-wrapper-2 .promo-toggle-input:checked:hover {
  background-color: #263b77;
}

.promo-form-summary {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.promo-form-summary span {
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  padding: 0.32rem 0.62rem;
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 700px) {
  .promo-admin-header-actions {
    justify-content: stretch;
  }

  .promo-admin-header-actions .admin-button {
    width: 100%;
  }
}
</style>
