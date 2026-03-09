<template>
  <article v-if="post" class="blog-post">
    <header class="blog-post__hero">
      <p class="blog-post__eyebrow">BedTrip Blog · {{ post.destination }} · {{ post.city }}</p>
      <h1>{{ post.title }}</h1>
      <p class="blog-post__meta">
        Published: {{ post.publishedAt }} · Author: {{ post.author }}
      </p>
      <p>{{ post.intro }}</p>
    </header>

    <section class="blog-post__panel">
      <h2>Best periods to visit Istanbul</h2>
      <div class="period-grid">
        <article
          v-for="item in post.bestPeriods"
          :key="item.period"
          class="period-card"
        >
          <h3>{{ item.period }}</h3>
          <p>{{ item.reason }}</p>
        </article>
      </div>
    </section>

    <section class="blog-post__panel">
      <h2>Major events calendar</h2>
      <div class="event-list">
        <article
          v-for="event in post.events"
          :key="event.name"
          class="event-card"
          :class="{ 'event-card--image': !!event.image }"
          :style="event.image ? { backgroundImage: `url(${event.image})` } : null"
        >
          <div class="event-card__content">
            <h3>{{ event.name }}</h3>
            <p class="event-time">Period: {{ event.when }}</p>
            <p>{{ event.highlight }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="blog-post__panel">
      <h2>Booking tips for agencies</h2>
      <ul>
        <li v-for="tip in post.tips" :key="tip">{{ tip }}</li>
      </ul>
    </section>

    <section class="blog-post__panel">
      <h2>FAQ</h2>
      <article
        v-for="item in post.faq"
        :key="item.q"
        class="faq-item"
      >
        <h3>{{ item.q }}</h3>
        <p>{{ item.a }}</p>
      </article>
    </section>
  </article>

  <section v-else class="blog-post blog-post--missing">
    <h1>Blog post not found</h1>
    <p>This article is not available.</p>
    <RouterLink class="blog-post__link" to="/">Return to home</RouterLink>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBlogPostBySlug } from '../data/blogPosts'
import { absoluteUrl, removeJsonLd, setPageSeo } from '../utils/seo'

const route = useRoute()
const currentJsonLdId = ref('')

const post = computed(() => getBlogPostBySlug(route.params.slug))

function applySeo() {
  if (currentJsonLdId.value) {
    removeJsonLd(currentJsonLdId.value)
    currentJsonLdId.value = ''
  }

  if (!post.value) {
    setPageSeo({
      title: 'Blog not found | BedTrip',
      description: 'This blog article does not exist.',
      canonical: absoluteUrl(route.fullPath),
      robots: 'noindex,follow',
    })
    return
  }

  const canonical = absoluteUrl(`/blog/${post.value.slug}`)
  const description = post.value.excerpt
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.value.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }

  setPageSeo({
    title: `${post.value.title} | BedTrip Blog`,
    description,
    canonical,
    robots: 'index,follow',
    keywords:
      'Istanbul events, best time to visit Istanbul, Istanbul Tulip Festival, Istanbul Film Festival, Istanbul Jazz Festival, Istanbul Marathon, Turkey travel planning',
    type: 'article',
    jsonLdId: `blog-${post.value.slug}-faq`,
    jsonLd: faqJsonLd,
  })
  currentJsonLdId.value = `blog-${post.value.slug}-faq`
}

onMounted(() => {
  applySeo()
})

watch(
  () => route.params.slug,
  () => {
    applySeo()
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

.period-grid,
.event-list {
  display: grid;
  gap: 0.7rem;
}

.period-card,
.event-card,
.faq-item {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.8rem;
  padding: 0.85rem;
  background: #f8fafc;
}

.event-card {
  position: relative;
  overflow: hidden;
}

.event-card--image {
  min-height: 220px;
  background-size: cover;
  background-position: center;
  border: none;
  display: flex;
  align-items: flex-end;
}

.event-card--image::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(2, 6, 23, 0.1) 0%,
    rgba(2, 6, 23, 0.45) 55%,
    rgba(2, 6, 23, 0.88) 100%
  );
}

.event-card__content {
  position: relative;
  z-index: 1;
}

.event-card--image .event-card__content h3,
.event-card--image .event-card__content p {
  color: #f8fafc;
}

.event-time {
  color: #7f1d1d;
  font-weight: 600;
}

.event-card--image .event-time {
  color: #fcd34d;
}

ul {
  margin: 0;
  padding-left: 1rem;
}

li + li {
  margin-top: 0.4rem;
}

.blog-post__link {
  color: #a5141e;
}

.blog-post--missing {
  text-align: center;
}
</style>
