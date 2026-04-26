<template>
  <aside
    v-if="isSupported"
    class="chat-widget"
    :class="{ 'chat-widget--open': isOpen }"
    aria-live="polite"
  >
    <button
      v-if="!isOpen"
      type="button"
      class="chat-widget__launcher"
      :class="{ 'chat-widget__launcher--nudge': showNudge }"
      :style="launcherStyle"
      aria-label="Ouvrir l'assistant BedTrip"
      @click="openChat"
    >
      <i class="pi pi-comments" aria-hidden="true"></i>
      <span class="chat-widget__launcher-label">
        {{ showNudge ? "Besoin d'aide ?" : 'Assistant BedTrip' }}
      </span>
    </button>

    <section
      v-else
      class="chat-widget__panel"
      role="dialog"
      aria-label="Assistant BedTrip"
    >
      <header class="chat-widget__header" :style="headerStyle">
        <div>
          <p>{{ config.widget?.subtitle || 'Réponses rapides' }}</p>
          <h2>{{ config.widget?.title || 'Assistant BedTrip' }}</h2>
        </div>
        <button
          type="button"
          class="chat-widget__close"
          aria-label="Fermer l'assistant"
          @click="isOpen = false"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </header>

      <div ref="messagesEl" class="chat-widget__messages">
        <article
          v-for="message in messages"
          :key="message.id"
          :class="['chat-widget__message', `chat-widget__message--${message.role}`]"
        >
          <div class="chat-widget__bubble">
            <p>{{ message.text }}</p>
            <div
              v-if="message.highlights?.length"
              class="chat-widget__highlights"
              aria-label="Informations importantes"
            >
              <a
                v-for="highlight in message.highlights"
                :key="`${highlight.label}-${highlight.text}`"
                :href="highlight.href || undefined"
                :class="[
                  'chat-widget__highlight',
                  `chat-widget__highlight--${highlight.tone || 'info'}`,
                  { 'chat-widget__highlight--link': highlight.href },
                ]"
              >
                <span>{{ highlight.label }}</span>
                <strong>{{ highlight.text }}</strong>
              </a>
            </div>
            <div
              v-if="message.promoCodes?.length"
              class="chat-widget__promos"
              aria-label="Codes promo"
            >
              <article
                v-for="promo in message.promoCodes"
                :key="promo.id || promo.code"
                class="chat-widget__promo"
                :class="{ 'chat-widget__promo--inactive': !promo.isUsable }"
              >
                <div class="chat-widget__promo-copy">
                  <strong>{{ promo.code }}</strong>
                  <span>{{ promo.statusLabel }}</span>
                </div>
                <p>{{ promo.description }}</p>
                <button
                  type="button"
                  class="chat-widget__copy"
                  :aria-label="`Copier le code promo ${promo.code}`"
                  @click="copyPromoCode(promo.code)"
                >
                  <i
                    :class="copiedPromoCode === promo.code ? 'pi pi-check' : 'pi pi-copy'"
                    aria-hidden="true"
                  ></i>
                </button>
              </article>
            </div>
            <div
              v-if="message.links?.length"
              class="chat-widget__links"
              aria-label="Liens utiles"
            >
              <a
                v-for="link in message.links"
                :key="link.href"
                class="chat-widget__link"
                :href="link.href"
              >
                <i v-if="link.icon" :class="link.icon" aria-hidden="true"></i>
                <span>{{ link.label }}</span>
              </a>
            </div>
          </div>
        </article>
        <article v-if="loading" class="chat-widget__message chat-widget__message--bot">
          <div class="chat-widget__bubble">
            <p class="chat-widget__typing">
              <span></span>
              <span></span>
              <span></span>
            </p>
          </div>
        </article>
      </div>

      <div v-if="quickReplies.length" class="chat-widget__quick">
        <button
          v-for="reply in quickReplies"
          :key="reply.message"
          type="button"
          @click="sendQuickReply(reply)"
        >
          {{ reply.label }}
        </button>
      </div>

      <form class="chat-widget__form" @submit.prevent="sendCurrentMessage">
        <input
          v-model.trim="draft"
          type="text"
          :placeholder="config.widget?.placeholder || 'Écrivez votre question...'"
          maxlength="700"
          autocomplete="off"
          :disabled="loading"
        />
        <button
          type="submit"
          :disabled="loading || !draft"
          :style="sendButtonStyle"
          aria-label="Envoyer"
        >
          <i class="pi pi-send" aria-hidden="true"></i>
        </button>
      </form>
    </section>
  </aside>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchChatbotConfig, sendChatbotMessage } from '../../services/chatbotApi'

const route = useRoute()

const config = ref({
  enabled: true,
  widget: {
    quickActions: [],
    supportedRoutes: [],
    colors: {},
  },
})
const messages = ref([])
const quickReplies = ref([])
const draft = ref('')
const loading = ref(false)
const isOpen = ref(false)
const showNudge = ref(false)
const messagesEl = ref(null)
const copiedPromoCode = ref('')
let idCounter = 0

const isSupported = computed(() => {
  if (!config.value.enabled) return false
  const supported = config.value.widget?.supportedRoutes
  if (!Array.isArray(supported) || !supported.length) return true
  return supported.includes(route.name)
})

const primaryColor = computed(() => config.value.widget?.colors?.primary || '#a5141e')
const primaryDark = computed(() => config.value.widget?.colors?.primaryDark || '#7f1017')
const launcherStyle = computed(() => ({ background: primaryColor.value }))
const headerStyle = computed(() => ({
  background: `linear-gradient(135deg, ${primaryColor.value}, ${primaryDark.value})`,
}))
const sendButtonStyle = computed(() => ({ background: primaryColor.value }))

function pushMessage(role, text, extra = {}) {
  messages.value.push({
    id: `${Date.now()}-${idCounter += 1}`,
    role,
    text,
    promoCodes: Array.isArray(extra.promoCodes) ? extra.promoCodes : [],
    highlights: Array.isArray(extra.highlights) ? extra.highlights : [],
    links: Array.isArray(extra.links) ? extra.links : [],
  })
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

function readBookingSummary() {
  try {
    const raw = window.sessionStorage?.getItem('booking:lastPrebook')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function buildContext() {
  const bookingSummary = readBookingSummary()
  return {
    routeName: route.name || '',
    path: route.path,
    query: route.query || {},
    hotelId: route.params?.hid || '',
    hotelName: bookingSummary?.hotel?.name || document.title || '',
    partnerOrderId:
      route.query?.partner_order_id ||
      bookingSummary?.partner_order_id ||
      '',
    roomMeal: bookingSummary?.room?.meal || '',
    roomName: bookingSummary?.room?.name || '',
    bookingSummary,
  }
}

function applyBotResponse(response) {
  pushMessage('bot', response.answer || 'Je n’ai pas trouvé de réponse.', {
    promoCodes: response.promoCodes,
    highlights: response.highlights,
    links: response.links,
  })
  quickReplies.value = Array.isArray(response.quickReplies) ? response.quickReplies : []
}

async function copyPromoCode(code) {
  const value = String(code || '').trim()
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const input = document.createElement('textarea')
      input.value = value
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    copiedPromoCode.value = value
    window.setTimeout(() => {
      if (copiedPromoCode.value === value) copiedPromoCode.value = ''
    }, 1400)
  } catch {
    pushMessage('bot', `Impossible de copier ${value}. Vous pouvez le sélectionner manuellement.`)
  }
}

async function sendMessage(text) {
  const message = String(text || '').trim()
  if (!message || loading.value) return
  pushMessage('user', message)
  draft.value = ''
  loading.value = true
  try {
    const response = await sendChatbotMessage({
      message,
      context: buildContext(),
    })
    applyBotResponse(response)
  } catch {
    pushMessage('bot', "L'assistant est temporairement indisponible. Réessayez dans un instant.")
  } finally {
    loading.value = false
  }
}

function sendCurrentMessage() {
  sendMessage(draft.value)
}

function sendQuickReply(reply) {
  sendMessage(reply?.message || reply?.label || '')
}

function openChat() {
  isOpen.value = true
  showNudge.value = false
  if (!messages.value.length) {
    pushMessage('bot', config.value.widget?.greeting || 'Bonjour. Comment puis-je vous aider ?')
    quickReplies.value = config.value.widget?.quickActions || []
  }
}

onMounted(async () => {
  try {
    const response = await fetchChatbotConfig()
    config.value = response
    quickReplies.value = response.widget?.quickActions || []
    const delay = Number(response.widget?.openDelayMs || 0)
    if (delay > 0) {
      window.setTimeout(() => {
        if (!isOpen.value && isSupported.value) showNudge.value = true
      }, delay)
    }
  } catch {
    config.value.enabled = false
  }
})

watch(
  () => route.name,
  () => {
    showNudge.value = false
    if (!isSupported.value) isOpen.value = false
  },
)
</script>

<style scoped>
.chat-widget {
  position: fixed;
  right: clamp(1rem, 2vw, 1.5rem);
  bottom: clamp(1rem, 2vw, 1.5rem);
  z-index: 80;
  font-family: inherit;
}

.chat-widget__launcher {
  width: auto;
  min-width: 3.25rem;
  height: 3.25rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0 1rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
  cursor: pointer;
  overflow: hidden;
  transition: max-width 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
  max-width: 3.25rem;
}

.chat-widget__launcher i {
  font-size: 1.2rem;
  flex: 0 0 auto;
}

.chat-widget__launcher-label {
  display: inline-block;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  font-weight: 700;
  white-space: nowrap;
  transition: max-width 0.22s ease, opacity 0.18s ease;
}

.chat-widget__launcher:hover,
.chat-widget__launcher:focus-visible,
.chat-widget__launcher--nudge {
  max-width: 12rem;
  box-shadow: 0 22px 52px rgba(15, 23, 42, 0.34);
  transform: translateY(-1px);
}

.chat-widget__launcher:hover .chat-widget__launcher-label,
.chat-widget__launcher:focus-visible .chat-widget__launcher-label,
.chat-widget__launcher--nudge .chat-widget__launcher-label {
  max-width: 9rem;
  opacity: 1;
}

.chat-widget__panel {
  width: min(390px, calc(100vw - 2rem));
  height: min(560px, calc(100vh - 2rem));
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #fff;
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.3);
}

.chat-widget__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  color: #fff;
}

.chat-widget__header p,
.chat-widget__header h2 {
  margin: 0;
}

.chat-widget__header p {
  font-size: 0.74rem;
  opacity: 0.88;
}

.chat-widget__header h2 {
  font-size: 1rem;
}

.chat-widget__close {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
}

.chat-widget__messages {
  overflow-y: auto;
  padding: 1rem;
  background: #f8fafc;
}

.chat-widget__message {
  display: flex;
  margin-bottom: 0.65rem;
}

.chat-widget__bubble {
  max-width: 82%;
}

.chat-widget__message--bot .chat-widget__bubble {
  max-width: 92%;
}

.chat-widget__bubble > p {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.chat-widget__message--bot {
  justify-content: flex-start;
}

.chat-widget__message--bot .chat-widget__bubble > p {
  background: #fff;
  color: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.chat-widget__message--user {
  justify-content: flex-end;
}

.chat-widget__message--user .chat-widget__bubble > p {
  background: #a5141e;
  color: #fff;
}

.chat-widget__highlights {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.chat-widget__highlight {
  display: grid;
  gap: 0.12rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  text-decoration: none;
}

.chat-widget__highlight span {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.chat-widget__highlight strong {
  color: #0f172a;
  font-size: 0.78rem;
  line-height: 1.35;
}

.chat-widget__highlight--info {
  border-color: rgba(37, 99, 235, 0.24);
  background: #eff6ff;
}

.chat-widget__highlight--info span {
  color: #1d4ed8;
}

.chat-widget__highlight--success {
  border-color: rgba(22, 163, 74, 0.24);
  background: #f0fdf4;
}

.chat-widget__highlight--success span {
  color: #15803d;
}

.chat-widget__highlight--warning {
  border-color: rgba(217, 119, 6, 0.28);
  background: #fffbeb;
}

.chat-widget__highlight--warning span {
  color: #b45309;
}

.chat-widget__highlight--danger {
  border-color: rgba(220, 38, 38, 0.24);
  background: #fef2f2;
}

.chat-widget__highlight--danger span {
  color: #b91c1c;
}

.chat-widget__highlight--link:hover {
  filter: brightness(0.98);
}

.chat-widget__promos {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.55rem;
}

.chat-widget__promo {
  position: relative;
  display: grid;
  gap: 0.25rem;
  padding: 0.7rem 2.8rem 0.7rem 0.75rem;
  border: 1px solid rgba(165, 20, 30, 0.24);
  border-radius: 0.5rem;
  background: #fff;
  color: #0f172a;
}

.chat-widget__promo--inactive {
  border-color: rgba(148, 163, 184, 0.35);
  background: #f8fafc;
}

.chat-widget__promo-copy {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.chat-widget__promo-copy strong {
  font-size: 0.86rem;
  letter-spacing: 0;
}

.chat-widget__promo-copy span {
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: rgba(165, 20, 30, 0.1);
  color: #7f1017;
  font-size: 0.68rem;
  font-weight: 700;
}

.chat-widget__promo--inactive .chat-widget__promo-copy span {
  background: #e2e8f0;
  color: #475569;
}

.chat-widget__promo p {
  margin: 0;
  color: #475569;
  font-size: 0.76rem;
  line-height: 1.35;
}

.chat-widget__copy {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  width: 1.85rem;
  height: 1.85rem;
  min-width: 1.85rem;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 0.5rem;
  background: #fff;
  color: #a5141e;
  cursor: pointer;
}

.chat-widget__copy:hover {
  background: #fff5f5;
}

.chat-widget__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.chat-widget__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: auto;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  background: #a5141e;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  text-decoration: none;
}

.chat-widget__link:hover {
  background: #7f1017;
}

.chat-widget__typing {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

.chat-widget__typing span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: #94a3b8;
  animation: chatPulse 1s infinite ease-in-out;
}

.chat-widget__typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.chat-widget__typing span:nth-child(3) {
  animation-delay: 0.3s;
}

.chat-widget__quick {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0.7rem 0.85rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.chat-widget__quick button {
  width: auto;
  white-space: nowrap;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  cursor: pointer;
  font-size: 0.76rem;
}

.chat-widget__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.85rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.chat-widget__form input {
  min-width: 0;
  border-radius: 0.5rem;
}

.chat-widget__form button {
  width: 2.55rem;
  height: 2.55rem;
  min-width: 2.55rem;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  color: #fff;
  cursor: pointer;
}

.chat-widget__form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes chatPulse {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  40% {
    transform: translateY(-2px);
    opacity: 1;
  }
}

@media (max-width: 620px) {
  .chat-widget {
    right: 0.75rem;
    bottom: 0.75rem;
  }

  .chat-widget__panel {
    width: calc(100vw - 1.5rem);
    height: min(540px, calc(100vh - 1.5rem));
  }
}
</style>
