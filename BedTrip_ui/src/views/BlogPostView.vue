<!--
  BlogPostView
  ============
  Public article page for one published BedTrip blog post.

  Main responsibilities:
  - Load a post by slug and render its title, metadata, images and body blocks.
  - Convert supported content syntax into paragraphs, headings, lists and links.
  - Preserve internal RouterLink navigation for BedTrip links.
  - Apply page SEO data for the article route.
-->

<template>
  <article v-if="post" class="blog-post">
    <header class="blog-post__hero">
      <p class="blog-post__eyebrow">BedTrip Blog</p>
      <h1>{{ post.title }}</h1>
      <p class="blog-post__meta">
        Publie le : {{ formatDate(post.publishedAt) }}
        <span v-if="post.authorEmail"> · Auteur : {{ post.authorEmail }}</span>
      </p>
      <p v-if="post.excerpt">{{ post.excerpt }}</p>
      <div v-if="postImages.length" class="blog-post__mosaic">
        <img
          v-for="(image, index) in postImages"
          :key="`${image}-${index}`"
          :src="image"
          :alt="`${post.title} - ${index + 1}`"
          class="blog-post__mosaic-image"
          loading="lazy"
        />
      </div>
    </header>

    <section class="blog-post__panel">
      <h2>Destinations et Hotels</h2>
      <template v-for="(block, index) in contentBlocks" :key="index">
        <p v-if="block.type === 'paragraph'">
          <template v-for="(segment, segmentIndex) in block.segments" :key="segmentIndex">
            <RouterLink
              v-if="segment.type === 'link' && segment.internal"
              :to="segment.href"
              class="blog-post__inline-link"
            >
              {{ segment.text }}
            </RouterLink>
            <a
              v-else-if="segment.type === 'link'"
              :href="segment.href"
              target="_blank"
              rel="noreferrer"
              class="blog-post__inline-link"
            >
              {{ segment.text }}
            </a>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>

        <component
          :is="block.level === 2 ? 'h3' : 'h4'"
          v-else-if="block.type === 'heading'"
        >
          {{ block.text }}
        </component>

        <ul v-else-if="block.type === 'list'" class="blog-post__list">
          <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
            <template v-for="(segment, segmentIndex) in item.segments" :key="segmentIndex">
              <RouterLink
                v-if="segment.type === 'link' && segment.internal"
                :to="segment.href"
                class="blog-post__inline-link"
              >
                {{ segment.text }}
              </RouterLink>
              <a
                v-else-if="segment.type === 'link'"
                :href="segment.href"
                target="_blank"
                rel="noreferrer"
                class="blog-post__inline-link"
              >
                {{ segment.text }}
              </a>
              <template v-else>{{ segment.text }}</template>
            </template>
          </li>
        </ul>
      </template>
    </section>

    <section v-if="post.tags?.length" class="blog-post__panel">
      <h2>Tags</h2>
      <div class="blog-post__tags">
        <span v-for="tag in post.tags" :key="tag" class="blog-post__tag">{{ tag }}</span>
      </div>
    </section>
  </article>

  <section v-else-if="loading" class="blog-post blog-post--missing">
    <p>Chargement de l'article...</p>
  </section>

  <section v-else class="blog-post blog-post--missing">
    <h1>Article introuvable</h1>
    <p>Cet article n'est pas disponible.</p>
    <RouterLink class="blog-post__link" to="/blog">Retour au blog</RouterLink>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublishedPostBySlug } from '../services/blogApi'
import { absoluteUrl, removeJsonLd, setPageSeo } from '../utils/seo'

const route = useRoute()
const loading = ref(false)
const post = ref(null)
const currentJsonLdId = ref('')

function normalizeSafeHref(rawHref) {
  const href = String(rawHref || '').trim()
  if (!href) return ''

  if (href.startsWith('/')) {
    return href.startsWith('//') ? '' : href
  }

  try {
    const parsed = new URL(href)
    const protocol = String(parsed.protocol || '').toLowerCase()
    if (protocol === 'http:' || protocol === 'https:') {
      parsed.username = ''
      parsed.password = ''
      return parsed.toString()
    }
  } catch (_) {
    return ''
  }

  return ''
}

function parseInlineSegments(text) {
  const value = String(text || '')
  if (!value) return [{ type: 'text', text: '' }]

  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const segments = []
  let cursor = 0
  let match

  while ((match = pattern.exec(value)) !== null) {
    const start = match.index
    const end = pattern.lastIndex

    if (start > cursor) {
      segments.push({ type: 'text', text: value.slice(cursor, start) })
    }

    const linkText = String(match[1] || '').trim()
    const href = normalizeSafeHref(match[2])
    if (linkText && href) {
      segments.push({
        type: 'link',
        text: linkText,
        href,
        internal: href.startsWith('/'),
      })
    } else {
      segments.push({ type: 'text', text: value.slice(start, end) })
    }
    cursor = end
  }

  if (cursor < value.length) {
    segments.push({ type: 'text', text: value.slice(cursor) })
  }

  return segments.length ? segments : [{ type: 'text', text: value }]
}

const contentBlocks = computed(() => {
  const rawContent = String(post.value?.content || '')
  const lines = rawContent.split(/\r?\n/)
  const blocks = []
  let paragraphLines = []
  let listItems = []

  function flushParagraph() {
    if (!paragraphLines.length) return
    const text = paragraphLines.join(' ').trim()
    paragraphLines = []
    if (!text) return
    blocks.push({
      type: 'paragraph',
      segments: parseInlineSegments(text),
    })
  }

  function flushList() {
    if (!listItems.length) return
    blocks.push({
      type: 'list',
      items: listItems.map((item) => ({ segments: parseInlineSegments(item) })),
    })
    listItems = []
  }

  for (const line of lines) {
    const trimmed = String(line || '').trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (listMatch && listMatch[1]) {
      flushParagraph()
      listItems.push(String(listMatch[1]).trim())
      continue
    }

    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (headingMatch && headingMatch[2]) {
      flushParagraph()
      flushList()
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: String(headingMatch[2]).trim(),
      })
      continue
    }

    flushList()
    paragraphLines.push(trimmed)
  }

  flushParagraph()
  flushList()

  return blocks
})

const postImages = computed(() => {
  const images = Array.isArray(post.value?.imageUrls) ? post.value.imageUrls : []
  if (images.length) return images
  if (post.value?.coverImageUrl) return [post.value.coverImageUrl]
  return []
})

function formatDate(value) {
  if (!value) return 'Date non disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date non disponible'
  return date.toLocaleDateString('fr-FR')
}

function applySeo() {
  if (currentJsonLdId.value) {
    removeJsonLd(currentJsonLdId.value)
    currentJsonLdId.value = ''
  }

  if (!post.value) {
    setPageSeo({
      title: 'Article introuvable | BedTrip',
      description: "Cet article de blog n'existe pas.",
      canonical: absoluteUrl(route.fullPath),
      robots: 'noindex,follow',
    })
    return
  }

  const canonical = absoluteUrl(`/blog/${post.value.slug}`)

  setPageSeo({
    title: `${post.value.title} | BedTrip Blog`,
    description: post.value.excerpt || String(post.value.content || '').slice(0, 160),
    canonical,
    robots: 'index,follow',
    keywords: 'blog voyage, periodes de voyage, evenements destination, planification hoteliere',
    type: 'article',
    image: post.value.coverImageUrl || undefined,
  })
}

async function loadPost() {
  loading.value = true
  try {
    const response = await fetchPublishedPostBySlug(route.params.slug)
    post.value = response?.post || null
  } catch (_) {
    post.value = null
  } finally {
    loading.value = false
    applySeo()
  }
}

onMounted(async () => {
  await loadPost()
})

watch(
  () => route.params.slug,
  async () => {
    await loadPost()
  },
)

onBeforeUnmount(() => {
  if (!currentJsonLdId.value) return
  removeJsonLd(currentJsonLdId.value)
  currentJsonLdId.value = ''
})
</script>

<style scoped>
.blog-post {
  display: grid;
  gap: 1rem;
}

.blog-post__hero,
.blog-post__panel {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 1.2rem;
}

.blog-post__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #a5141e;
  font-weight: 700;
}

.blog-post__meta {
  color: #64748b;
  font-size: 0.86rem;
}

.blog-post__mosaic {
  margin-top: 0.7rem;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
}

.blog-post__mosaic-image {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: 0.8rem;
}

.blog-post__tags {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.blog-post__list {
  margin: 0;
  padding-left: 1.2rem;
}

.blog-post__list li + li {
  margin-top: 0.35rem;
}

.blog-post__inline-link {
  color: #a5141e;
  font-weight: 600;
  text-decoration: none;
}

.blog-post__inline-link:hover,
.blog-post__inline-link:focus-visible {
  text-decoration: underline;
}

.blog-post__tag {
  background: #f1f5f9;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  padding: 0.18rem 0.6rem;
  font-size: 0.8rem;
}

.blog-post__link {
  color: #a5141e;
}

.blog-post--missing {
  text-align: center;
}
</style>
