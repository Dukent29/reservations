<template>
  <div class="admin-shell">
    <div v-if="mobileOpen" class="admin-shell__overlay" @click="mobileOpen = false"></div>

    <aside :class="['admin-shell__sidebar', { 'admin-shell__sidebar--open': mobileOpen }]">
      <div class="admin-shell__brand">
        <span class="admin-shell__brand-mark">B</span>
        <div>
          <strong>BedTrip Admin</strong>
          <p>Pilotage opérationnel</p>
        </div>
      </div>

      <nav class="admin-shell__nav" aria-label="Navigation admin">
        <RouterLink
          v-for="item in visibleItems"
          :key="item.to"
          :to="item.to"
          class="admin-shell__nav-link"
          :class="{ 'is-active': isItemActive(item) }"
        >
          <i :class="item.icon" aria-hidden="true"></i>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button
        v-if="isAuthenticated"
        type="button"
        class="admin-shell__logout admin-shell__logout--danger"
        @click="handleLogout"
        title="Se déconnecter de l'administration"
        aria-label="Se déconnecter de l'administration"
      >
        <i class="pi pi-sign-out" aria-hidden="true"></i>
        <span>Se déconnecter de l'admin</span>
      </button>
    </aside>

    <div class="admin-shell__main">
      <header :class="['admin-shell__topbar', { 'admin-shell__topbar--compact': isHeaderCompact }]">
        <div class="admin-shell__topbar-left">
          <button
            type="button"
            class="admin-shell__menu-toggle"
            aria-label="Ouvrir la navigation"
            @click="mobileOpen = !mobileOpen"
          >
            <i class="pi pi-bars" aria-hidden="true"></i>
          </button>

          <div>
            <p class="admin-shell__eyebrow">{{ route.meta?.adminEyebrow || 'Back-office' }}</p>
            <h1>{{ route.meta?.adminTitle || 'Tableau de bord' }}</h1>
          </div>
        </div>

        <div v-if="isAuthenticated" class="admin-profile">
          <div class="admin-notifications">
            <button
              type="button"
              class="admin-notifications__trigger"
              @click="toggleNotifications"
            >
              <i class="pi pi-bell" aria-hidden="true"></i>
              <span v-if="unreadCount" class="admin-notifications__badge">{{ unreadCount }}</span>
            </button>

            <div v-if="notificationsOpen" class="admin-notifications__panel">
              <div class="admin-notifications__panel-head">
                <strong>Notifications</strong>
                <button type="button" class="admin-profile__menu-item" @click="loadNotifications">Actualiser</button>
              </div>
              <div v-if="notifications.length" class="admin-notifications__list">
                <button
                  v-for="item in notifications"
                  :key="item.id"
                  type="button"
                  class="admin-notifications__item"
                  :class="{ 'is-unread': !item.read_at }"
                  @click="openNotification(item)"
                >
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.message || 'Nouvelle activité admin.' }}</span>
                  <small>{{ formatNotificationDate(item.created_at) }}</small>
                </button>
              </div>
              <p v-else class="admin-inline-note">Aucune notification.</p>
            </div>
          </div>

          <button
            type="button"
            class="admin-profile__trigger"
            @click="menuOpen = !menuOpen"
          >
            <span class="admin-profile__avatar">{{ initials }}</span>
            <span class="admin-profile__meta">
              <strong>{{ me?.email || 'Admin' }}</strong>
              <small>{{ me?.role || 'authentifié' }}</small>
            </span>
            <i class="pi pi-angle-down" aria-hidden="true"></i>
          </button>

          <div v-if="menuOpen" class="admin-profile__menu">
            <RouterLink
              v-if="canManageUsers"
              to="/admin/users"
              class="admin-profile__menu-item"
            >
              Gérer les utilisateurs
            </RouterLink>
            <button type="button" class="admin-profile__menu-item admin-profile__menu-item--danger" @click="handleLogout">
              Se déconnecter de l'admin
            </button>
          </div>
        </div>
      </header>

      <main ref="contentRef" class="admin-shell__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { fetchAdminMe, getAdminToken, logoutAdmin } from '../services/adminAuth'
import { getAdminLoginLocation } from '../utils/adminAccess'
import { fetchAdminNotifications, markAdminNotificationRead } from '../services/adminPanelApi'

const route = useRoute()
const router = useRouter()
const contentRef = ref(null)
const mobileOpen = ref(false)
const menuOpen = ref(false)
const me = ref(window.__BEDTRIP_ADMIN_ME__ || null)
const isHeaderCompact = ref(false)
const notificationsOpen = ref(false)
const notifications = ref([])

const navItems = [
  { label: 'Tableau de bord', to: '/admin', icon: 'pi pi-chart-line', match: ['/admin'] },
  { label: 'Paiements', to: '/admin/payments', icon: 'pi pi-wallet' },
  { label: 'Codes promo', to: '/admin/promo-codes', icon: 'pi pi-percentage' },
  { label: 'Utilisateurs', to: '/admin/users', icon: 'pi pi-users', roles: ['admin'] },
  { label: 'Clients / Réservations', to: '/admin/clients', icon: 'pi pi-briefcase' },
  { label: 'Blog', to: '/admin/blog', icon: 'pi pi-file-edit' },
]

const role = computed(() => String(me.value?.role || '').toLowerCase())
const isAuthenticated = computed(() => Boolean(getAdminToken()))
const canManageUsers = computed(() => role.value === 'admin')
const visibleItems = computed(() =>
  navItems.filter((item) => !item.roles || item.roles.includes(role.value))
)
const initials = computed(() => {
  const email = String(me.value?.email || 'A').trim()
  return email.slice(0, 1).toUpperCase()
})
const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length)

function isItemActive(item) {
  if (item.to === '/admin') {
    return route.path === '/admin'
  }
  return route.path.startsWith(item.to)
}

async function hydrateMe() {
  try {
    const response = await fetchAdminMe()
    me.value = response?.user || null
    window.__BEDTRIP_ADMIN_ME__ = me.value
  } catch (_) {
    me.value = null
  }
}

function formatNotificationDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR')
}

async function loadNotifications() {
  try {
    const response = await fetchAdminNotifications(10)
    notifications.value = response?.notifications || []
  } catch (_) {
    notifications.value = notifications.value || []
  }
}

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
  menuOpen.value = false
  if (notificationsOpen.value) {
    loadNotifications()
  }
}

async function openNotification(item) {
  if (!item?.id) return
  try {
    await markAdminNotificationRead(item.id)
  } catch (_) {
    // ignore
  }

  if (item.entity_type === 'booking' && item.entity_key) {
    await router.push(`/admin/clients?q=${encodeURIComponent(item.entity_key)}`)
  }

  notificationsOpen.value = false
  await loadNotifications()
}

async function handleLogout() {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm("Voulez-vous vraiment vous déconnecter de l'espace administrateur ?")
    if (!confirmed) return
  }
  menuOpen.value = false
  mobileOpen.value = false
  notificationsOpen.value = false
  await logoutAdmin()
  await router.replace(getAdminLoginLocation())
}

function handleContentScroll() {
  const scrollTop = contentRef.value?.scrollTop || 0
  isHeaderCompact.value = scrollTop > 24
}

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
    menuOpen.value = false
    notificationsOpen.value = false
    isHeaderCompact.value = false
    if (contentRef.value) {
      contentRef.value.scrollTop = 0
    }
  }
)

onMounted(() => {
  if (!me.value) {
    hydrateMe()
  }
  loadNotifications()
  if (contentRef.value) {
    contentRef.value.addEventListener('scroll', handleContentScroll, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (contentRef.value) {
    contentRef.value.removeEventListener('scroll', handleContentScroll)
  }
})
</script>
