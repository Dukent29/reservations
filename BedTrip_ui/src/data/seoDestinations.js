export const DESTINATION_SEO_ITEMS = [
  {
    slug: 'turkey',
    country: 'Turkey',
    countryFr: 'Turquie',
    focusKeywords: [
      'Turkey hotels',
      'Turquie hotels particuliers professionnels',
      'turquie hotel booking',
      'Istanbul hotels',
    ],
    heroText:
      'Réservez en Turquie pour vos vacances, week-ends ou déplacements professionnels avec disponibilités en temps réel et tarifs négociés.',
    topCities: ['Istanbul', 'Antalya', 'Izmir', 'Ankara', 'Bodrum'],
  },
  {
    slug: 'morocco',
    country: 'Morocco',
    countryFr: 'Maroc',
    focusKeywords: [
      'Morocco hotels',
      'Maroc hôtels particuliers professionnels',
      'maroc hotel booking',
      'Marrakech hotels',
    ],
    heroText:
      'Trouvez les meilleurs hôtels au Maroc pour séjours loisirs et professionnels, avec paiement flexible et confirmation rapide.',
    topCities: ['Marrakech', 'Casablanca', 'Rabat', 'Agadir', 'Fes'],
  },
  {
    slug: 'algeria',
    country: 'Algeria',
    countryFr: 'Algérie',
    focusKeywords: [
      'Algeria hotels',
      'Algérie hôtels particuliers professionnels',
      'Algiers hotels',
      'business travel Algeria',
    ],
    heroText:
      'Réservez des hôtels en Algérie pour vos vacances ou déplacements professionnels, avec conditions claires et service client humain.',
    topCities: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Tlemcen'],
  },
  {
    slug: 'tunisia',
    country: 'Tunisia',
    countryFr: 'Tunisie',
    focusKeywords: [
      'Tunisia hotels',
      'Tunisie hôtels particuliers professionnels',
      'Tunis hotels',
      'Hammamet resorts',
    ],
    heroText:
      'Découvrez des hôtels fiables en Tunisie pour les séjours loisirs et professionnels, avec des offres adaptées à chaque budget.',
    topCities: ['Tunis', 'Hammamet', 'Sousse', 'Djerba', 'Monastir'],
  },
  {
    slug: 'dominican-republic',
    country: 'Dominican Republic',
    countryFr: 'République dominicaine',
    focusKeywords: [
      'Dominican Republic hotels',
      'République dominicaine hôtels',
      'republic domonucano hotels',
      'Punta Cana resorts',
    ],
    heroText:
      'Accédez aux resorts côtiers et hôtels urbains en République dominicaine pour voyages loisirs et professionnels.',
    topCities: ['Punta Cana', 'Santo Domingo', 'Puerto Plata', 'La Romana', 'Samana'],
  },
  {
    slug: 'italy',
    country: 'Italy',
    countryFr: 'Italie',
    focusKeywords: [
      'Italy hotels',
      'Italie hôtels particuliers professionnels',
      'Rome hotels',
      'Milan hotels',
    ],
    heroText:
      'Comparez les hôtels en Italie pour city-breaks, vacances et déplacements professionnels, avec tarifs négociés compétitifs.',
    topCities: ['Rome', 'Milan', 'Venice', 'Florence', 'Naples'],
  },
  {
    slug: 'spain',
    country: 'Spain',
    countryFr: 'Espagne',
    focusKeywords: [
      'Spain hotels',
      'Espagne hôtels particuliers professionnels',
      'Barcelona hotels',
      'Madrid hotels',
    ],
    heroText:
      'Optimisez vos réservations en Espagne avec des conditions transparentes et des hôtels dans les villes les plus demandées.',
    topCities: ['Barcelona', 'Madrid', 'Valencia', 'Seville', 'Malaga'],
  },
  {
    slug: 'egypt',
    country: 'Egypt',
    countryFr: 'Egypte',
    focusKeywords: [
      'Egypt hotels',
      'Egypte hôtels particuliers professionnels',
      'Cairo hotels',
      'Hurghada resorts',
    ],
    heroText:
      'Préparez vos séjours en Égypte avec des hôtels pour city-breaks, mer Rouge et déplacements professionnels.',
    topCities: ['Cairo', 'Hurghada', 'Sharm El-Sheikh', 'Alexandria', 'Luxor'],
  },
]

export function getDestinationBySlug(slug) {
  return DESTINATION_SEO_ITEMS.find((item) => item.slug === slug) || null
}
