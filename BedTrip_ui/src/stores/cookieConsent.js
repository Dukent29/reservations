import { defineStore } from 'pinia'
import { fetchCookieConsent, saveCookieConsent } from '../services/cookieApi'

/**
 * Stores the user's cookie consent state.
 *
 * Consent is persisted by the backend in a signed cookie. The frontend store
 * only controls UI state and mirrors the current backend response.
 */

export const useCookieConsentStore = defineStore('cookieConsent', {
  state: () => ({
    loaded: false,
    loading: false,
    saving: false,
    error: '',
    hasConsent: false,
    consent: null,
    showBanner: false,
    showPreferences: false,
  }),

  getters: {
    preferencesEnabled: (state) => Boolean(state.consent?.preferences),
  },

  actions: {
    async loadConsent() {
      if (this.loading || this.loaded) return
      this.loading = true
      this.error = ''
      try {
        const response = await fetchCookieConsent()
        this.hasConsent = Boolean(response.hasConsent)
        this.consent = response.consent || null
        this.showBanner = !this.hasConsent
      } catch (error) {
        this.error = error?.message || 'cookie_consent_unavailable'
        this.showBanner = true
      } finally {
        this.loaded = true
        this.loading = false
      }
    },

    openPreferences() {
      this.showPreferences = true
      this.showBanner = false
    },

    closePreferences() {
      this.showPreferences = false
      if (!this.hasConsent) this.showBanner = true
    },

    async saveConsent({ preferences = false, currency = 'EUR', locale = 'fr' } = {}) {
      this.saving = true
      this.error = ''
      try {
        const response = await saveCookieConsent({
          necessary: true,
          preferences,
          analytics: false,
          marketing: false,
          currency,
          locale,
        })
        this.hasConsent = true
        this.consent = response.consent || {
          necessary: true,
          preferences,
          analytics: false,
          marketing: false,
        }
        this.showBanner = false
        this.showPreferences = false
      } catch (error) {
        this.error = error?.message || 'cookie_consent_save_failed'
      } finally {
        this.saving = false
      }
    },

    acceptAll() {
      return this.saveConsent({ preferences: true })
    },

    rejectNonEssential() {
      return this.saveConsent({ preferences: false })
    },
  },
})
