<!--
  AdminBlogFormView
  =================
  Back-office editor used to create and update blog posts.

  Main responsibilities:
  - Build the article form from route state, including edit mode detection.
  - Save drafts or published posts through the admin blog API.
  - Manage article metadata, image URLs, uploaded images and validation state.
  - Return editors to the blog list after successful create/update actions.
-->

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Blog</p>
        <h2>{{ isEditMode ? "Modifier l'article" : 'Créer un article' }}</h2>
      </div>

      <RouterLink class="admin-button admin-button--ghost" to="/admin/blog">
        <i class="pi pi-arrow-left" aria-hidden="true"></i>
        <span>Retour aux articles</span>
      </RouterLink>
    </header>

    <form class="admin-surface admin-blog-form" @submit.prevent="submitWithStatus(form.status)">
      <div class="admin-blog-form__grid">
        <label>
          Titre
          <input v-model.trim="form.title" type="text" required />
        </label>

        <label>
          Slug
          <input v-model.trim="form.slug" type="text" required @input="onSlugInput" />
        </label>

        <label>
          Catégorie
          <input v-model.trim="form.category" type="text" placeholder="Destination" />
        </label>

        <label>
          Tags (séparés par des virgules)
          <input v-model="form.tagsInput" type="text" placeholder="voyage, conseil" />
        </label>

        <label class="admin-blog-form__full">
          Extrait
          <textarea v-model.trim="form.excerpt" rows="3" placeholder="Résumé court"></textarea>
        </label>

        <label>
          URL de l'image de couverture
          <input v-model.trim="form.coverImageUrl" type="url" placeholder="https://..." />
        </label>

        <label>
          Statut
          <select v-model="form.status">
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
          </select>
        </label>

        <div class="admin-blog-form__full">
          <label>
            URLs d'images (plusieurs, séparées par virgule ou ligne)
            <textarea
              v-model="form.imageUrlsInput"
              rows="3"
              placeholder="https://site.com/1.jpg&#10;https://site.com/2.jpg"
            ></textarea>
          </label>
          <button type="button" class="admin-button admin-button--ghost admin-button--small" @click="appendImageUrlsFromInput">
            Ajouter ces URLs
          </button>
        </div>

        <div class="admin-blog-form__full">
          <label>
            Téléverser des images
            <input type="file" accept="image/*" multiple @change="onFileChange" />
          </label>
          <p v-if="uploadState.loading" class="admin-inline-note">Upload en cours...</p>
          <p v-if="uploadState.error" class="admin-alert admin-alert--error">{{ uploadState.error }}</p>
        </div>
      </div>

      <label>
        Contenu
        <textarea v-model="form.content" rows="16" required placeholder="Contenu de l'article"></textarea>
      </label>

      <img v-if="form.coverImageUrl" :src="form.coverImageUrl" alt="Aperçu" class="admin-blog-form__preview" />
      <div v-if="form.imageUrls.length" class="admin-blog-form__gallery">
        <article v-for="(url, index) in form.imageUrls" :key="`${url}-${index}`" class="admin-blog-form__gallery-item">
          <img :src="url" :alt="`Image ${index + 1}`" />
          <button type="button" class="admin-button admin-button--ghost admin-button--small" @click="removeImage(index)">
            Retirer
          </button>
        </article>
      </div>

      <p v-if="errorMessage" class="admin-alert admin-alert--error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="admin-blog-form__success">{{ successMessage }}</p>

      <div class="admin-blog-form__actions">
        <button type="button" class="admin-button admin-button--ghost" :disabled="saving" @click="submitWithStatus('draft')">
          {{ saving && pendingStatus === 'draft' ? 'Enregistrement...' : 'Enregistrer le brouillon' }}
        </button>
        <button type="button" class="admin-button" :disabled="saving" @click="submitWithStatus('published')">
          {{ saving && pendingStatus === 'published' ? 'Publication...' : "Publier l'article" }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createAdminPost,
  fetchAdminPost,
  updateAdminPost,
  uploadAdminBlogCover,
} from '../services/blogApi'
import { getAdminLoginLocation } from '../utils/adminAccess'

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => Boolean(route.params.id))

const form = reactive({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  imageUrls: [],
  imageUrlsInput: '',
  category: '',
  tagsInput: '',
  status: 'draft',
})

const saving = ref(false)
const pendingStatus = ref('draft')
const errorMessage = ref('')
const successMessage = ref('')
const hasCustomSlug = ref(false)

const uploadState = reactive({
  loading: false,
  error: '',
})

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function toTagsArray(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function parseImageUrlsInput(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function collectAllImageUrls() {
  const urls = [...form.imageUrls]
  for (const url of parseImageUrlsInput(form.imageUrlsInput)) {
    if (!urls.includes(url)) urls.push(url)
  }
  return urls
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('file_read_failed'))
    reader.readAsDataURL(file)
  })
}

async function onFileChange(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return

  uploadState.loading = true
  uploadState.error = ''

  try {
    for (const file of files) {
      const contentBase64 = await readFileAsDataUrl(file)
      const response = await uploadAdminBlogCover(file.name, contentBase64)
      const url = String(response?.file?.url || '').trim()
      if (!url) continue
      if (!form.imageUrls.includes(url)) {
        form.imageUrls.push(url)
      }
    }
    if (!form.coverImageUrl && form.imageUrls.length) {
      form.coverImageUrl = form.imageUrls[0]
    }
  } catch (_) {
    uploadState.error = 'Upload impossible (format ou taille invalide).'
  } finally {
    uploadState.loading = false
    event.target.value = ''
  }
}

function removeImage(index) {
  form.imageUrls.splice(index, 1)
  if (!form.imageUrls.length) {
    form.coverImageUrl = ''
    return
  }
  if (!form.imageUrls.includes(form.coverImageUrl)) {
    form.coverImageUrl = form.imageUrls[0]
  }
}

function appendImageUrlsFromInput() {
  const urls = parseImageUrlsInput(form.imageUrlsInput)
  if (!urls.length) return

  for (const url of urls) {
    if (!form.imageUrls.includes(url)) {
      form.imageUrls.push(url)
    }
  }
  form.imageUrlsInput = ''

  if (!form.coverImageUrl && form.imageUrls.length) {
    form.coverImageUrl = form.imageUrls[0]
  }
}

function buildPayload(statusOverride) {
  const imageUrls = collectAllImageUrls()
  const coverImageUrl = form.coverImageUrl || imageUrls[0] || ''

  return {
    title: form.title,
    slug: slugify(form.slug),
    excerpt: form.excerpt,
    content: form.content,
    coverImageUrl,
    imageUrls,
    category: form.category,
    tags: toTagsArray(form.tagsInput),
    status: statusOverride || form.status,
  }
}

function onSlugInput() {
  hasCustomSlug.value = true
}

async function submitWithStatus(status) {
  saving.value = true
  pendingStatus.value = status
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = buildPayload(status)
    let response

    if (isEditMode.value) {
      response = await updateAdminPost(route.params.id, payload)
    } else {
      response = await createAdminPost(payload)
    }

    const postId = response?.post?.id
    successMessage.value = status === 'published' ? 'Article publié.' : 'Brouillon enregistré.'

    if (!isEditMode.value && postId) {
      await router.replace(`/admin/blog/${postId}/edit`)
    }
  } catch (error) {
    if (error?.statusCode === 401) {
      await router.replace(getAdminLoginLocation({ redirect: route.fullPath }))
      return
    }
    if (error?.statusCode === 409) {
      errorMessage.value = 'Ce slug est deja utilise.'
      return
    }
    errorMessage.value = 'Sauvegarde impossible.'
  } finally {
    saving.value = false
  }
}

async function loadPost() {
  if (!isEditMode.value) return

  try {
    const response = await fetchAdminPost(route.params.id)
    const post = response?.post
    if (!post) return

    form.title = post.title || ''
    form.slug = post.slug || ''
    form.excerpt = post.excerpt || ''
    form.content = post.content || ''
    form.coverImageUrl = post.coverImageUrl || ''
    form.imageUrls = Array.isArray(post.imageUrls) ? post.imageUrls.slice() : []
    if (!form.imageUrls.length && form.coverImageUrl) {
      form.imageUrls = [form.coverImageUrl]
    }
    form.imageUrlsInput = ''
    form.category = post.category || ''
    form.tagsInput = Array.isArray(post.tags) ? post.tags.join(', ') : ''
    form.status = post.status || 'draft'
    hasCustomSlug.value = true
  } catch (error) {
    if (error?.statusCode === 401) {
      await router.replace(getAdminLoginLocation({ redirect: route.fullPath }))
      return
    }
    if (error?.statusCode === 404) {
      errorMessage.value = 'Article introuvable.'
      return
    }
    errorMessage.value = 'Chargement impossible.'
  }
}

watch(
  () => form.title,
  (value) => {
    if (hasCustomSlug.value) return
    form.slug = slugify(value)
  }
)

watch(
  () => route.params.id,
  async () => {
    errorMessage.value = ''
    successMessage.value = ''

    if (!isEditMode.value) {
      form.title = ''
      form.slug = ''
      form.excerpt = ''
      form.content = ''
      form.coverImageUrl = ''
      form.imageUrls = []
      form.imageUrlsInput = ''
      form.category = ''
      form.tagsInput = ''
      form.status = 'draft'
      hasCustomSlug.value = false
      return
    }

    await loadPost()
  },
  { immediate: true },
)
</script>

<style scoped>
.admin-blog-form {
  display: grid;
  gap: 1rem;
}

.admin-blog-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.admin-blog-form__full {
  grid-column: 1 / -1;
}

.admin-blog-form textarea {
  min-height: 7rem;
}

.admin-blog-form__preview {
  width: min(420px, 100%);
  border-radius: 1.25rem;
  border: 1px solid rgba(108, 83, 57, 0.14);
}

.admin-blog-form__gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
}

.admin-blog-form__gallery-item {
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem;
  border: 1px solid rgba(108, 83, 57, 0.14);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.55);
}

.admin-blog-form__gallery-item img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 0.9rem;
}

.admin-blog-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.admin-blog-form__success {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: #dff7ed;
  color: #166534;
}

@media (max-width: 820px) {
  .admin-blog-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
