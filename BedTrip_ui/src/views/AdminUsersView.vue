<!--
  AdminUsersView
  ==============
  Back-office page for admin account and role management.

  Main responsibilities:
  - List admin users with pagination.
  - Show the current signed-in account in the users table.
  - Allow permitted admins to update other users' roles.
  - Prevent risky self-role changes from the UI.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Utilisateurs</p>
        <h2>Comptes et gestion des rôles</h2>
      </div>
      <button type="button" class="admin-button admin-button--ghost" @click="loadUsers" :disabled="loading">
        <i class="pi pi-refresh" aria-hidden="true"></i>
        <span>{{ loading ? 'Actualisation...' : 'Actualiser' }}</span>
      </button>
    </header>

    <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>

    <article class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Équipe</p>
          <h3>Rôles administrateur, éditeur et lecture</h3>
        </div>
      </header>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rôle</th>
              <th>Créé le</th>
              <th>Mis à jour le</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                {{ user.email }}
                <span v-if="String(me?.id || '') === String(user.id)" class="admin-inline-note">Vous</span>
              </td>
              <td>
                <select v-model="draftRoles[user.id]" :disabled="savingUserId === user.id || isSelf(user)">
                  <option value="admin">Administrateur</option>
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecture</option>
                </select>
              </td>
              <td>{{ formatDate(user.created_at || user.createdAt) }}</td>
              <td>{{ formatDate(user.updated_at || user.updatedAt) }}</td>
              <td>
                <button
                  type="button"
                  class="admin-button admin-button--small"
                  :disabled="savingUserId === user.id || isSelf(user) || draftRoles[user.id] === user.role"
                  @click="saveRole(user)"
                >
                  {{ savingUserId === user.id ? 'Enregistrement...' : 'Enregistrer le rôle' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalUsersCount > pageSize" class="admin-pagination">
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
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchAdminUsers, updateAdminUserRole } from '../services/adminPanelApi'

const pageSize = 15
const me = ref(window.__BEDTRIP_ADMIN_ME__ || null)
const users = ref([])
const loading = ref(false)
const errorMessage = ref('')
const savingUserId = ref('')
const draftRoles = reactive({})
const totalUsersCount = ref(0)
const currentPage = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(totalUsersCount.value / pageSize)))
const rangeStart = computed(() => (totalUsersCount.value ? (currentPage.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, totalUsersCount.value))
const pageRangeLabel = computed(() => `${rangeStart.value} – ${rangeEnd.value} / ${totalUsersCount.value}`)

function isSelf(user) {
  return String(me.value?.id || '') === String(user.id || '')
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('fr-FR')
}

async function loadUsers(page = currentPage.value) {
  currentPage.value = Math.max(page, 1)
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminUsers({
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
    })
    users.value = response?.users || []
    totalUsersCount.value = Number(response?.pagination?.total || 0)
    for (const user of users.value) {
      draftRoles[user.id] = user.role
    }
  } catch (error) {
    errorMessage.value = error?.statusCode === 403
      ? 'Seul un admin peut gérer les utilisateurs.'
      : 'Impossible de charger les utilisateurs.'
  } finally {
    loading.value = false
  }
}

function goToPage(page) {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value)
  if (nextPage === currentPage.value) return
  loadUsers(nextPage)
}

async function saveRole(user) {
  savingUserId.value = user.id
  errorMessage.value = ''
  try {
    const response = await updateAdminUserRole(user.id, draftRoles[user.id])
    const updated = response?.user
    if (updated) {
      const index = users.value.findIndex((entry) => String(entry.id) === String(updated.id))
      if (index >= 0) {
        users.value[index] = updated
        draftRoles[updated.id] = updated.role
      }
    }
  } catch (error) {
    errorMessage.value = error?.data?.error === 'cannot_update_own_role'
      ? 'Vous ne pouvez pas modifier votre propre rôle.'
      : 'Mise à jour du rôle impossible.'
  } finally {
    savingUserId.value = ''
  }
}

onMounted(() => {
  loadUsers()
})
</script>
