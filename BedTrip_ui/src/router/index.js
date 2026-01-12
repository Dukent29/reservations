// Vue Router configuration for BedTrip UI.
// Maps legacy pages (front/*.html) to Vue views and
// defines the new flow: search landing → results page.

import { createRouter, createWebHistory } from 'vue-router'
import {
  startPageLoading,
  stopPageLoading,
  failPageLoading,
} from '../services/pageLoader'

// Views
import BookingView from '../views/BookingView.vue'
import BookingFinishedView from '../views/BookingFinishedView.vue'
import ReservationView from '../views/ReservationView.vue'
import HotelDetailView from '../views/HotelDetailView.vue'
import PaymentSuccessView from '../views/PaymentSuccessView.vue'
import PaymentErrorView from '../views/PaymentErrorView.vue'
import SystempayTestView from '../views/SystempayTestView.vue'
import SearchLandingView from '../views/SearchLandingView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import ServerDownView from '../views/ServerDownView.vue'

const routes = [
  {
    path: '/',
    name: 'search-landing',
    component: SearchLandingView,
  },
  {
    // Results + filters + hotel details (formerly reservation.html full page)
    path: '/results',
    name: 'search-results',
    component: ReservationView,
  },
  {
    // Hotel details and room selection
    path: '/results/:hid',
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
    // Optional Systempay test page (formerly systempay-test.html)
    path: '/systempay-test',
    name: 'systempay-test',
    component: SystempayTestView,
  },
  {
    path: '/server-down',
    name: 'server-down',
    component: ServerDownView,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
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
