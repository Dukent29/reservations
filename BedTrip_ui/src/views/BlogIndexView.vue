<template>
  <section class="blog-index">
    <header class="blog-index__hero">
      <p class="blog-index__eyebrow">BedTrip Blog</p>
      <h1>Destination Blog</h1>
      <p>
        Central hub for destination articles, travel periods, and event-driven hotel planning insights.
      </p>
    </header>

    <section class="blog-index__grid">
      <article
        v-for="post in posts"
        :key="post.slug"
        class="blog-card"
      >
        <p class="blog-card__meta">{{ post.destination }} · {{ post.city }} · {{ post.publishedAt }}</p>
        <h2>{{ post.title }}</h2>
        <p>{{ post.excerpt }}</p>
        <RouterLink class="blog-card__link" :to="`/blog/${post.slug}`">Read article</RouterLink>
      </article>
    </section>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import { BLOG_POSTS } from '../data/blogPosts'
import { absoluteUrl, setPageSeo } from '../utils/seo'

const posts = BLOG_POSTS

onMounted(() => {
  setPageSeo({
    title: 'Destination Blog | BedTrip',
    description:
      'Explore BedTrip destination blog posts with major events, seasonal periods, and travel planning insights.',
    canonical: absoluteUrl('/blog'),
    robots: 'index,follow',
    keywords: 'destination blog, travel events, best time to visit, BedTrip blog',
  })
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

.blog-card__meta {
  color: #64748b;
  font-size: 0.85rem;
}

.blog-card h2 {
  margin: 0.2rem 0 0.45rem;
}

.blog-card__link {
  color: #a5141e;
  font-weight: 600;
  text-decoration: none;
}
</style>
