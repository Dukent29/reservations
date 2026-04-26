<!--
  AdminBlogListView
  =================
  Editorial back-office page for managing blog content.

  Main responsibilities:
  - Filter posts by status and search query.
  - Paginate all drafts and published articles available to the admin user.
  - Link editors to create, edit and public preview routes.
  - Delete posts when the current role is allowed by the API.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Blog</p>
        <h2>Workflow éditorial</h2>
      </div>

      <RouterLink class="admin-button" to="/admin/blog/create">
        <i class="pi pi-plus" aria-hidden="true"></i>
        <span>Créer un article</span>
      </RouterLink>
    </header>

    <section class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Filtres</p>
          <h3>Rechercher et modérer les articles</h3>
        </div>
      </header>

      <div class="admin-filter-grid admin-blog-list__filters">
        <label>
          Statut
          <select v-model="filters.status" @change="applyFilters">
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
          </select>
        </label>

        <label>
          Recherche
          <input
            v-model.trim="filters.q"
            type="text"
            placeholder="Titre ou slug"
            @keyup.enter="applyFilters"
          />
        </label>

        <button type="button" class="admin-button admin-button--ghost" @click="applyFilters">
          <i class="pi pi-filter" aria-hidden="true"></i>
          <span>Appliquer les filtres</span>
        </button>
      </div>
    </section>

    <section class="admin-surface">
      <header class="admin-surface__head">
        <div>
          <p class="admin-surface__eyebrow">Contenu</p>
          <h3>Tous les articles</h3>
        </div>
      </header>

      <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="admin-inline-note">Chargement des articles...</p>

      <div v-if="!loading && posts.length" class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Slug</th>
              <th>Statut</th>
              <th>Mis à jour</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="post in posts" :key="post.id">
              <td>{{ post.title }}</td>
              <td><code>{{ post.slug }}</code></td>
              <td>
                <span :class="['admin-badge', `admin-badge--${post.status === 'published' ? 'success' : 'warning'}`]">
                  {{ post.status === 'published' ? 'Publié' : 'Brouillon' }}
                </span>
              </td>
              <td>{{ formatDate(post.updatedAt) }}</td>
              <td class="admin-blog-list__actions-cell">
                <RouterLink :to="`/admin/blog/${post.id}/edit`" class="admin-button admin-button--ghost admin-button--small">
                  Modifier
                </RouterLink>
                <RouterLink
                  v-if="post.status === 'published'"
                  :to="`/blog/${post.slug}`"
                  target="_blank"
                  class="admin-button admin-button--ghost admin-button--small"
                >
                  Voir
                </RouterLink>
                <button
                  type="button"
                  class="admin-button admin-button--ghost admin-button--small admin-blog-list__delete"
                  @click="deletePost(post)"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPostsCount > pageSize" class="admin-pagination">
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

      <p v-else-if="!loading" class="admin-inline-note">Aucun article trouve.</p>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteAdminPost, fetchAdminPosts } from '../services/blogApi'
import { getAdminLoginLocation } from '../utils/adminAccess'

const router = useRouter()
const pageSize = 15

const loading = ref(false)
const errorMessage = ref('')
const posts = ref([])
const totalPostsCount = ref(0)
const currentPage = ref(1)

const filters = reactive({
  status: '',
  q: '',
})

const totalPages = computed(() => Math.max(1, Math.ceil(totalPostsCount.value / pageSize)))
const rangeStart = computed(() => (totalPostsCount.value ? (currentPage.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, totalPostsCount.value))
const pageRangeLabel = computed(() => `${rangeStart.value} – ${rangeEnd.value} / ${totalPostsCount.value}`)

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function loadPosts(page = currentPage.value) {
  currentPage.value = Math.max(page, 1)
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchAdminPosts({
      status: filters.status,
      q: filters.q,
      limit: pageSize,
      offset: (currentPage.value - 1) * pageSize,
    })
    posts.value = response?.posts || []
    totalPostsCount.value = Number(response?.pagination?.total || 0)
  } catch (error) {
    if (error?.statusCode === 401) {
      await router.replace(getAdminLoginLocation({ redirect: '/admin/blog' }))
      return
    }
    errorMessage.value = 'Impossible de charger les articles.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  loadPosts(1)
}

function goToPage(page) {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value)
  if (nextPage === currentPage.value) return
  loadPosts(nextPage)
}

async function deletePost(post) {
  const confirmed = window.confirm(`Supprimer l'article "${post.title}" ?`)
  if (!confirmed) return

  try {
    await deleteAdminPost(post.id)
    await loadPosts()
  } catch (error) {
    if (error?.statusCode === 403) {
      errorMessage.value = 'Vous ne pouvez pas supprimer cet article.'
      return
    }
    errorMessage.value = 'Suppression impossible.'
  }
}

onMounted(() => {
  loadPosts()
})
</script>

<style scoped>
.admin-blog-list__filters {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
}

.admin-blog-list__actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.admin-blog-list__delete {
  color: #b42318;
}

@media (max-width: 760px) {
  .admin-blog-list__filters {
    grid-template-columns: 1fr;
  }
}
</style>
