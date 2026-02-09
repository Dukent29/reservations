<!--
  SystempayTestView
  =================
  Optional view corresponding to front/systempay-test.html.

  Responsibilities (to implement later if Systempay test flow is still needed):
  - Render a minimal interface to test Systempay card payments:
    - Display reference to the related booking/prebook.
    - Provide a button or form to simulate Systempay payment.
  - Show technical/debug information to help with integration testing.
  - Possibly redirect back to booking or payment success/error views.
-->

<template>
  <section class="workspace__content systempay-test-view">
    <section class="card booking-panel">
      <section class="card booking-form" aria-live="polite">
        <h3>Paiement Systempay</h3>
        <p class="muted" style="font-size:.8rem;">
          Ce formulaire est hébergé par Systempay (mode test) et utilise un formToken généré par l’API interne.
        </p>
        <form id="systempay-payment-form">
          <div class="row">
            <div class="muted" style="font-size:.75rem;">
              Référence commande partenaire :
              <strong>{{ partnerOrderId || '-' }}</strong>
            </div>
          </div>
          <div
            class="kr-embedded"
            id="kr-embedded-form"
          ></div>
          <div class="row" style="margin-top:1rem;">
            <button type="submit" class="primary">
              Payer
            </button>
          </div>
        </form>
      </section>

      <section class="card booking-raw">
        <h3>Réponse create-order (debug)</h3>
        <pre class="booking-raw__pre">
{{ debugText }}
        </pre>
      </section>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const route = useRoute()

const partnerOrderId = ref('')
const customerEmail = ref('')
const debugText = ref('// en attente de l’appel /api/payments/systempay/create-order…')
const insurancePayload = ref(null)

function loadInsurancePayload() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.sessionStorage.getItem('booking:extras')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      insurancePayload.value = parsed
    }
  } catch {
    insurancePayload.value = null
  }
}

function ensureKryptonCss() {
  if (typeof document === 'undefined') return
  const resetHref =
    'https://static.systempay.fr/static/js/krypton-client/V4.0/ext/classic-reset.css'
  const themeHref =
    'https://static.systempay.fr/static/js/krypton-client/V4.0/ext/classic.css'

  const hasReset = !!document.querySelector(
    `link[data-systempay-css="reset"]`,
  )
  const hasTheme = !!document.querySelector(
    `link[data-systempay-css="theme"]`,
  )

  if (!hasReset) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = resetHref
    link.setAttribute('data-systempay-css', 'reset')
    document.head.appendChild(link)
  }
  if (!hasTheme) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = themeHref
    link.setAttribute('data-systempay-css', 'theme')
    document.head.appendChild(link)
  }
}

function loadKryptonScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.KR) {
      resolve(window.KR)
      return
    }
    if (typeof document === 'undefined') {
      reject(new Error('Document not available'))
      return
    }
    const existing = document.querySelector(
      'script[data-systempay-kr="1"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(window.KR))
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Systempay script')),
      )
      return
    }
    const script = document.createElement('script')
    script.src =
      'https://static.systempay.fr/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js'
    script.async = true
    script.setAttribute('data-systempay-kr', '1')
    script.setAttribute(
      'kr-public-key',
      '41017804:testpublickey_ElYhgVXipj5FWVoRCTRGPWaFVcVB4h5EomXmjYwfpdVGf',
    )
    const backendBase =
      API_BASE && API_BASE.length
        ? API_BASE.replace(/\/$/, '')
        : window.location.origin.replace(/\/$/, '')
    script.setAttribute(
      'kr-post-url-success',
      `${backendBase}/payment/success?ui=bedtrip`,
    )
    script.setAttribute(
      'kr-post-url-refused',
      `${backendBase}/payment/error?ui=bedtrip`,
    )

    script.onload = () => {
      if (window.KR) resolve(window.KR)
      else reject(new Error('Systempay KR object not available'))
    }
    script.onerror = () =>
      reject(new Error('Failed to load Systempay script'))

    document.head.appendChild(script)
  })
}

async function initPaymentForm() {
  partnerOrderId.value =
    String(route.query.partner_order_id || '').trim()
  customerEmail.value =
    String(route.query.email || 'sample@example.com').trim()

  if (!partnerOrderId.value) {
    debugText.value =
      'Missing partner_order_id in URL. Ouvrez cette page via le flux de réservation.'
    return
  }

  ensureKryptonCss()

  const endpoint = `${API_BASE}/api/payments/systempay/create-order`
  const payload = {
    partner_order_id: partnerOrderId.value,
    customerEmail: customerEmail.value,
  }
  if (insurancePayload.value) {
    payload.insurance = insurancePayload.value
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    debugText.value = JSON.stringify(data, null, 2)

    if (!data.success || !data.formToken) {
      // Keep the debug visible, show alert in browser
      try {
        // eslint-disable-next-line no-alert
        alert(
          'Erreur lors de la création du paiement Systempay. Consultez le debug.',
        )
      } catch {
        // ignore alert failures
      }
      return
    }

    const formToken = data.formToken
    const KR = await loadKryptonScript()

    KR.setFormConfig({
      formToken,
      'kr-language': 'fr-FR',
    })

    KR.addForm('#systempay-payment-form', '#kr-embedded-form')
  } catch (err) {
    debugText.value = `Erreur lors de l’appel à /api/payments/systempay/create-order : ${
      err?.message || String(err || '')
    }`
  }
}

onMounted(() => {
  loadInsurancePayload()
  initPaymentForm().catch((err) => {
    debugText.value = `Erreur d’initialisation du formulaire Systempay : ${
      err?.message || String(err || '')
    }`
  })
})
</script>

<style scoped>
.booking-raw__pre {
  margin: 0;
  font-size: 0.75rem;
}
</style>
