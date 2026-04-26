// Vue Router configuration for BedTrip UI.
// Maps legacy pages (front/*.html) to Vue views and
// defines the new flow: search landing → results page.

import { createRouter, createWebHistory } from 'vue-router'
import {
  failPageLoading,
  startPageLoading,
  stopPageLoading,
} from '../services/pageLoader'
import { fetchAdminMe } from '../services/adminAuth'
import { ADMIN_LOGIN_PATH } from '../utils/adminAccess'

// Eager-loaded views (critical for initial load)
import SearchLandingView from '../views/SearchLandingView.vue'
import ReservationView from '../views/ReservationView.vue'
import HotelDetailView from '../views/HotelDetailView.vue'
import BookingView from '../views/BookingView.vue'
import AdminPanelLayout from '../layouts/AdminPanelLayout.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import UnauthorizedView from '../views/UnauthorizedView.vue'

// Lazy-loaded views (admin & less critical pages)
const AdminClientsReservationsView = () => import(/* webpackChunkName: "admin-clients" */ '../views/AdminClientsReservationsView.vue')
const AdminDashboardView = () => import(/* webpackChunkName: "admin-dashboard" */ '../views/AdminDashboardView.vue')
const AdminPaymentsView = () => import(/* webpackChunkName: "admin-payments" */ '../views/AdminPaymentsView.vue')
const AdminPromoCodesView = () => import(/* webpackChunkName: "admin-promos" */ '../views/AdminPromoCodesView.vue')
const AdminBlogListView = () => import(/* webpackChunkName: "admin-blog" */ '../views/AdminBlogListView.vue')
const AdminBlogFormView = () => import(/* webpackChunkName: "admin-blog" */ '../views/AdminBlogFormView.vue')
const AdminUsersView = () => import(/* webpackChunkName: "admin-users" */ '../views/AdminUsersView.vue')
const ApiLogsView = () => import(/* webpackChunkName: "show-pages" */ '../views/ApiLogsView.vue')
const BlogIndexView = () => import(/* webpackChunkName: "blog" */ '../views/BlogIndexView.vue')
const BlogPostView = () => import(/* webpackChunkName: "blog" */ '../views/BlogPostView.vue')
const BookingFinishedView = () => import(/* webpackChunkName: "booking" */ '../views/BookingFinishedView.vue')
const ContactView = () => import(/* webpackChunkName: "contact" */ '../views/ContactView.vue')
const PaymentSuccessView = () => import(/* webpackChunkName: "payment" */ '../views/PaymentSuccessView.vue')
const PaymentErrorView = () => import(/* webpackChunkName: "payment" */ '../views/PaymentErrorView.vue')
const ReservationsListView = () => import(/* webpackChunkName: "show-pages" */ '../views/ReservationsListView.vue')
const EtgOrdersView = () => import(/* webpackChunkName: "show-pages" */ '../views/EtgOrdersView.vue')
const SystempayTestView = () => import(/* webpackChunkName: "show-pages" */ '../views/SystempayTestView.vue')
const ConditionsView = () => import(/* webpackChunkName: "legal" */ '../views/ConditionsView.vue')
const MentionsLegalesView = () => import(/* webpackChunkName: "legal" */ '../views/MentionsLegalesView.vue')
const PolitiqueDeConfidentialiteView = () => import(/* webpackChunkName: "legal" */ '../views/PolitiqueDeConfidentialiteView.vue')
const TooManyRequestsView = () => import(/* webpackChunkName: "error-pages" */ '../views/TooManyRequestsView.vue')
const NotFoundView = () => import(/* webpackChunkName: "error-pages" */ '../views/NotFoundView.vue')

const routes = [
  {
    path: '/',
    name: 'search-landing',
    component: SearchLandingView,
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
    path: '/contact',
    name: 'contact',
    component: ContactView,
  },
  {
    path: ADMIN_LOGIN_PATH,
    name: 'admin-login',
    component: AdminLoginView,
    meta: { appShell: false },
  },
  {
    path: '/401',
    name: 'unauthorized',
    component: UnauthorizedView,
  },
  {
    path: '/429',
    name: 'too-many-requests',
    component: TooManyRequestsView,
  },
  {
    path: '/admin',
    component: AdminPanelLayout,
    meta: { requiresAdmin: true, appShell: false, adminTitle: 'Tableau de bord', adminEyebrow: "Vue d'ensemble" },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: AdminDashboardView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Tableau de bord', adminEyebrow: "Vue d'ensemble" },
      },
      {
        path: 'payments',
        name: 'admin-payments',
        component: AdminPaymentsView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Paiements', adminEyebrow: 'Transactions' },
      },
      {
        path: 'promo-codes',
        name: 'admin-promo-codes',
        component: AdminPromoCodesView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Codes promo', adminEyebrow: 'Promotions' },
      },
      {
        path: 'blog',
        name: 'admin-blog-list',
        component: AdminBlogListView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Blog', adminEyebrow: 'Espace éditorial' },
      },
      {
        path: 'blog/create',
        name: 'admin-blog-create',
        component: AdminBlogFormView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Créer un article', adminEyebrow: 'Espace éditorial' },
      },
      {
        path: 'blog/:id/edit',
        name: 'admin-blog-edit',
        component: AdminBlogFormView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: "Modifier l'article", adminEyebrow: 'Espace éditorial' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: AdminUsersView,
        meta: {
          requiresAdmin: true,
          appShell: false,
          adminTitle: 'Utilisateurs',
          adminEyebrow: 'Permissions',
          allowedAdminRoles: ['admin'],
        },
      },
      {
        path: 'clients',
        name: 'admin-clients',
        component: AdminClientsReservationsView,
        meta: { requiresAdmin: true, appShell: false, adminTitle: 'Clients / Réservations', adminEyebrow: 'Opérations' },
      },
    ],
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

router.beforeEach(async (to, from, next) => {
  startPageLoading()

  if (to.meta?.requiresAdmin) {
    try {
      const meResponse = await fetchAdminMe()
      const role = String(meResponse?.user?.role || '').toLowerCase()
      const allowedAdminRoles = Array.isArray(to.meta?.allowedAdminRoles)
        ? to.meta.allowedAdminRoles.map((item) => String(item || '').toLowerCase())
        : null

      if (role !== 'admin' && role !== 'editor') {
        next({ name: 'unauthorized' })
        return
      }
      if (allowedAdminRoles?.length && !allowedAdminRoles.includes(role)) {
        next({ name: 'unauthorized' })
        return
      }
      window.__BEDTRIP_ADMIN_ME__ = meResponse.user
    } catch (_) {
      next({ name: 'unauthorized' })
      return
    }
  }

  next()
})

router.afterEach(() => {
  stopPageLoading()
})

router.onError(() => {
  failPageLoading()
})

export default router
