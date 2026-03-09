// Vue Router configuration for BedTrip UI.
// Maps legacy pages (front/*.html) to Vue views and
// defines the new flow: search landing → results page.

import { createRouter, createWebHistory } from 'vue-router'
import {
  failPageLoading,
  startPageLoading,
  stopPageLoading,
} from '../services/pageLoader'

// Views
import ApiLogsView from '../views/ApiLogsView.vue'
import BlogIndexView from '../views/BlogIndexView.vue'
import BlogPostView from '../views/BlogPostView.vue'
import BookingFinishedView from '../views/BookingFinishedView.vue'
import BookingView from '../views/BookingView.vue'
import ConditionsView from '../views/ConditionsView.vue'
import DestinationSeoView from '../views/DestinationSeoView.vue'
import HotelDetailView from '../views/HotelDetailView.vue'
import MentionsLegalesView from '../views/MentionsLegalesView.vue'
import PaymentErrorView from '../views/PaymentErrorView.vue'
import PaymentSuccessView from '../views/PaymentSuccessView.vue'
import PolitiqueDeConfidentialiteView from '../views/PolitiqueDeConfidentialiteView.vue'
import ReservationView from '../views/ReservationView.vue'
import EtgOrdersView from '../views/EtgOrdersView.vue'
import ReservationsListView from '../views/ReservationsListView.vue'
import SearchLandingView from '../views/SearchLandingView.vue'
import SystempayTestView from '../views/SystempayTestView.vue'

const routes = [
  {
    path: '/',
    name: 'search-landing',
    component: SearchLandingView,
  },
  {
    path: '/destinations/:slug',
    name: 'destination-seo',
    component: DestinationSeoView,
  },
  {
    path: '/blog',
    name: 'blog-index',
    component: BlogIndexView,
  },
  {
    path: '/blog/:slug',
    name: 'blog-post',
    component: BlogPostView,
  },
  {
    // Results + filters (formerly reservation.html search list)
    path: '/results',
    name: 'search-results',
    component: ReservationView,
  },
  {
    // Hotel detail page
    path: '/hotel/:hid',
    name: 'hotel-detail',
    component: HotelDetailView,
  },
  {
    // Booking form (formerly booking.html)
    path: '/booking',
    name: 'booking',
    component: BookingView,
  },
  {
    // Confirmation landing after booking finish
    path: '/booking/finished',
    name: 'booking-finished',
    component: BookingFinishedView,
  },
  {
    // Payment success confirmation (formerly payment-success.html)
    path: '/payment/success',
    name: 'payment-success',
    component: PaymentSuccessView,
  },
  {
    // Legacy HTML-style success URL used by payment providers
    path: '/payment-success.html',
    name: 'payment-success-legacy',
    component: PaymentSuccessView,
  },
  {
    // Payment error (formerly payment-error.html)
    path: '/payment/error',
    name: 'payment-error',
    component: PaymentErrorView,
  },
  {
    // Legacy HTML-style error URL used by payment providers
    path: '/payment-error.html',
    name: 'payment-error-legacy',
    component: PaymentErrorView,
  },
  {
    path: '/show/reservations',
    name: 'show-reservations',
    component: ReservationsListView,
  },
  {
    path: '/show/apilogs',
    name: 'show-apilogs',
    component: ApiLogsView,
  },
  {
    path: '/show/etg',
    name: 'show-etg',
    component: EtgOrdersView,
  },
  {
    // Optional Systempay test page (formerly systempay-test.html)
    path: '/systempay-test',
    name: 'systempay-test',
    component: SystempayTestView,
  },
  {
    // Legal notice page
    path: '/mentions-legales',
    name: 'mentions-legales',
    component: MentionsLegalesView,
  },
  {
    // Privacy policy page
    path: '/politique-de-confidentialite',
    name: 'politique-de-confidentialite',
    component: PolitiqueDeConfidentialiteView,
  },
  {
    // Booking conditions page
    path: '/conditions',
    name: 'conditions',
    component: ConditionsView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // Always scroll to top on route change for clarity.
    return { top: 0 }
  },
})

router.beforeEach((to, from, next) => {
  startPageLoading()
  next()
})

router.afterEach(() => {
  stopPageLoading()
})

router.onError(() => {
  failPageLoading()
})

export default router
