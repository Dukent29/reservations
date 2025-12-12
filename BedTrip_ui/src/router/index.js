// Vue Router configuration for BedTrip UI.
// Maps legacy pages (front/*.html) to Vue views and
// defines the new flow: search landing → results page.

import { createRouter, createWebHistory } from 'vue-router'

// Views
import BookingView from '../views/BookingView.vue'
import ReservationView from '../views/ReservationView.vue'
import PaymentSuccessView from '../views/PaymentSuccessView.vue'
import PaymentErrorView from '../views/PaymentErrorView.vue'
import SystempayTestView from '../views/SystempayTestView.vue'
import SearchLandingView from '../views/SearchLandingView.vue'

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
    // Booking form (formerly booking.html)
    path: '/booking',
    name: 'booking',
    component: BookingView,
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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // Always scroll to top on route change for clarity.
    return { top: 0 }
  },
})

export default router
