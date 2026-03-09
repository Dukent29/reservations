<template>
  <section v-if="destination" class="destination-seo">
    <header class="destination-seo__hero">
      <p class="destination-seo__eyebrow">Destination BedTrip</p>
      <h1>Hôtels en {{ destination.countryFr }} pour particuliers et professionnels</h1>
      <p>{{ destination.heroText }}</p>
      <RouterLink class="destination-seo__cta" to="/">Lancer votre recherche d’hôtel</RouterLink>
    </header>

    <section class="destination-seo__panel">
      <h2>Pourquoi réserver sur BedTrip pour {{ destination.countryFr }}</h2>
      <ul>
        <li>Disponibilités en temps réel et tarifs négociés compétitifs.</li>
        <li>Réservation d’hôtels pour vos vacances, week-ends ou déplacements professionnels.</li>
        <li>Paiement flexible et conditions claires: annulation, prépaiement ou paiement sur place.</li>
      </ul>
    </section>

    <section class="destination-seo__panel">
      <h2>Villes populaires en {{ destination.countryFr }}</h2>
      <div class="chips">
        <component
          v-for="city in destination.topCities"
          :key="city"
          :is="getCityBlogSlug(city) ? 'RouterLink' : 'span'"
          class="chip"
          :class="{ 'chip-link': !!getCityBlogSlug(city) }"
          :to="getCityBlogSlug(city) ? `/blog/${getCityBlogSlug(city)}` : undefined"
        >
          {{ city }}
        </component>
      </div>
    </section>

    <section class="destination-seo__panel">
      <h2>Autres destinations</h2>
      <div class="chips">
        <RouterLink
          v-for="item in otherDestinations"
          :key="item.slug"
          class="chip chip-link"
          :to="`/destinations/${item.slug}`"
        >
          {{ item.country }}
        </RouterLink>
      </div>
    </section>
  </section>

  <section v-else class="destination-seo destination-seo--missing">
    <h1>Destination introuvable</h1>
    <p>Cette page destination n’est pas encore disponible.</p>
    <RouterLink class="destination-seo__cta" to="/">Retour à l’accueil BedTrip</RouterLink>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { DESTINATION_SEO_ITEMS, getDestinationBySlug } from '../data/seoDestinations'
import { BLOG_POSTS } from '../data/blogPosts'
import { absoluteUrl, removeJsonLd, setPageSeo } from '../utils/seo'

const route = useRoute()
const currentJsonLdId = ref('')

const destination = computed(() => getDestinationBySlug(route.params.slug))

const otherDestinations = computed(() => {
  if (!destination.value) return DESTINATION_SEO_ITEMS
  return DESTINATION_SEO_ITEMS.filter((item) => item.slug !== destination.value.slug)
})

const blogSlugByCity = computed(() => {
  const map = new Map()
  if (!destination.value) return map
  BLOG_POSTS
    .filter((post) => post.destination === destination.value.country)
    .forEach((post) => {
      map.set(String(post.city || '').toLowerCase(), post.slug)
    })
  return map
})

function getCityBlogSlug(city) {
  return blogSlugByCity.value.get(String(city || '').toLowerCase()) || ''
}

function applyDestinationSeo() {
  if (currentJsonLdId.value) {
    removeJsonLd(currentJsonLdId.value)
    currentJsonLdId.value = ''
  }

  if (!destination.value) {
    setPageSeo({
      title: 'Destination introuvable | BedTrip',
      description: 'Page destination indisponible. Consultez les destinations BedTrip disponibles.',
      canonical: absoluteUrl(route.fullPath),
      robots: 'noindex,follow',
    })
    return
  }

  const keywordLine = destination.value.focusKeywords.join(', ')
  const canonical = absoluteUrl(`/destinations/${destination.value.slug}`)
  const description = `BedTrip.fr, un site dédié aux particuliers et aux professionnels: réservez vos hôtels en ${destination.value.countryFr} pour vos vacances, week-ends ou déplacements professionnels. Villes clés: ${destination.value.topCities.join(', ')}.`

  setPageSeo({
    title: `Réservation hôtels ${destination.value.countryFr} | BedTrip`,
    description,
    keywords: keywordLine,
    canonical,
    robots: 'index,follow',
    type: 'article',
    jsonLdId: `destination-${destination.value.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: 'BedTrip',
      areaServed: destination.value.countryFr,
      serviceType: 'Hotel booking for leisure and business travelers',
      url: canonical,
    },
  })
  currentJsonLdId.value = `destination-${destination.value.slug}`
}

onMounted(() => {
  applyDestinationSeo()
})

watch(
  () => route.params.slug,
  () => {
    applyDestinationSeo()
  },
)

onBeforeUnmount(() => {
  if (!currentJsonLdId.value) return
  removeJsonLd(currentJsonLdId.value)
  currentJsonLdId.value = ''
})
</script>

<style scoped>
.destination-seo {
  display: grid;
  gap: 1rem;
}

.destination-seo__hero,
.destination-seo__panel {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 1.2rem;
}

.destination-seo__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #a5141e;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: #0f172a;
}

h2 {
  margin: 0 0 0.6rem;
  color: #0f172a;
}

p {
  color: #334155;
}

ul {
  margin: 0;
  padding-left: 1rem;
  color: #334155;
}

li + li {
  margin-top: 0.45rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.32rem 0.7rem;
  background: rgba(165, 20, 30, 0.1);
  color: #7f1d1d;
  font-size: 0.82rem;
  border: 1px solid rgba(165, 20, 30, 0.22);
}

.chip-link {
  text-decoration: none;
}

.destination-seo__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1rem;
  border-radius: 0.75rem;
  text-decoration: none;
  background: #a5141e;
  color: #fff;
  font-weight: 600;
}

.destination-seo--missing {
  text-align: center;
}
</style>
