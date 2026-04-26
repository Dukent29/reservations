<!--
  BlogIndexView
  =============
  Public blog landing page listing published destination articles.

  Main responsibilities:
  - Fetch published posts from the public blog API.
  - Render loading, empty and error states for the article list.
  - Build article cards with metadata, excerpts and available images.
  - Apply SEO metadata for the blog index route.
-->

<template>
  <section class="blog-index">
    <header class="blog-index__hero">
      <p class="blog-index__eyebrow">BedTrip Blog</p>
      <h1>Blog destinations</h1>
      <p>
        Articles publies par l'equipe editoriale: destinations, tendances et conseils de planification.
      </p>
    </header>

    <section class="blog-index__grid">
      <p v-if="loading">Chargement des articles...</p>
      <p v-else-if="errorMessage" class="blog-index__error">{{ errorMessage }}</p>
      <p v-else-if="!posts.length">Aucun article publie pour le moment.</p>

      <article
        v-for="post in posts"
        :key="post.id"
        class="blog-card"
      >
        <div v-if="getPostImages(post).length" class="blog-card__mosaic">
          <img
            v-for="(image, index) in getPostImages(post)"
            :key="`${image}-${index}`"
            :src="image"
            :alt="`${post.title} - ${index + 1}`"
            class="blog-card__cover"
            loading="lazy"
          />
        </div>
        <p class="blog-card__meta">
          {{ post.category || 'Blog' }} · {{ formatDate(post.publishedAt) }}
        </p>
        <h2>{{ post.title }}</h2>
        <p>{{ post.excerpt || summarize(post.content) }}</p>
        <RouterLink class="blog-card__link" :to="`/blog/${post.slug}`">Lire l'article</RouterLink>
      </article>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { fetchPublishedPosts } from '../services/blogApi'
import { absoluteUrl, setPageSeo } from '../utils/seo'

const loading = ref(false)
const errorMessage = ref('')
const posts = ref([])

function summarize(text, max = 180) {
  const value = String(text || '').trim()
  if (!value) return ''
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function formatDate(value) {
  if (!value) return 'Date non disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date non disponible'
  return date.toLocaleDateString('fr-FR')
}

function getPostImages(post) {
  const list = Array.isArray(post?.imageUrls) ? post.imageUrls : []
  if (list.length) return list.slice(0, 4)
  if (post?.coverImageUrl) return [post.coverImageUrl]
  return []
}

async function loadPosts() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchPublishedPosts({ limit: 100, offset: 0 })
    posts.value = response?.posts || []
  } catch (_) {
    errorMessage.value = 'Le blog est temporairement indisponible.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  setPageSeo({
    title: 'Blog destinations | BedTrip',
    description:
      'Explorez les articles blog BedTrip avec evenements majeurs, periodes saisonnieres et conseils de planification voyage.',
    canonical: absoluteUrl('/blog'),
    robots: 'index,follow',
    keywords: 'blog destinations, periodes de voyage, evenements voyage, blog BedTrip',
  })

  await loadPosts()
})
</script>

<style scoped>
.blog-index {
  display: grid;
  gap: 1rem;
}

.blog-index__hero,
.blog-card {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 1.2rem;
}

.blog-index__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #a5141e;
  font-weight: 700;
}

.blog-index__grid {
  display: grid;
  gap: 0.85rem;
}

.blog-card__mosaic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 0.65rem;
}

.blog-card__cover {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 0.7rem;
}

.blog-card__meta {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 0;
}

.blog-card h2 {
  margin: 0.2rem 0 0.45rem;
}

.blog-card__link {
  color: #a5141e;
  font-weight: 600;
  text-decoration: none;
}

.blog-index__error {
  color: #b91c1c;
}
</style>
