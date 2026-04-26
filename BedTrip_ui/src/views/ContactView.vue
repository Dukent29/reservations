<template>
  <section class="contact-view">
    <div class="contact-visual" aria-hidden="true">
      <img
        src="/images/pexels-donaldtong94-189296.jpg"
        alt=""
      />
      <div class="contact-visual__caption">
        <span>BedTrip</span>
        <strong>Une équipe disponible pour votre séjour.</strong>
      </div>
    </div>

    <div class="contact-panel">
      <RouterLink class="contact-close" to="/" aria-label="Retour accueil">
        <i class="pi pi-times" aria-hidden="true"></i>
        <span>Fermer</span>
      </RouterLink>

      <div class="contact-heading">
        <p>Contact</p>
        <h2>Contactez-nous</h2>
        <span>
          Une question sur une réservation, un paiement ou votre séjour?
          Envoyez votre demande avec les informations utiles.
        </span>
      </div>

      <div class="contact-options" aria-label="Type de demande">
        <button
          v-for="option in topicOptions"
          :key="option.value"
          type="button"
          class="contact-option"
          :class="{ 'is-active': form.topic === option.value }"
          @click="selectTopic(option.value)"
        >
          <i :class="option.icon" aria-hidden="true"></i>
          <span>{{ option.label }}</span>
        </button>
      </div>

      <form class="contact-form" @submit.prevent="submitContact">
        <div class="form-row form-row--split">
          <label>
            <span>Nom complet</span>
            <input
              v-model.trim="form.name"
              type="text"
              name="name"
              autocomplete="name"
              required
              maxlength="120"
            />
          </label>

          <label>
            <span>Email</span>
            <input
              v-model.trim="form.email"
              type="email"
              name="email"
              autocomplete="email"
              required
              maxlength="320"
            />
          </label>
        </div>

        <div class="form-row form-row--split">
          <label>
            <span>Téléphone</span>
            <input
              v-model.trim="form.phone"
              type="tel"
              name="phone"
              autocomplete="tel"
              maxlength="40"
            />
          </label>

          <label>
            <span>Objet</span>
            <input
              v-model.trim="form.subject"
              type="text"
              name="subject"
              maxlength="160"
            />
          </label>
        </div>

        <div
          v-if="form.topic === 'reservation'"
          class="reservation-fields"
        >
          <label>
            <span>Raison</span>
            <select
              v-model="form.reservation_reason"
              name="reservation_reason"
              required
            >
              <option
                v-for="reason in reservationReasonOptions"
                :key="reason.value"
                :value="reason.value"
              >
                {{ reason.label }}
              </option>
            </select>
          </label>

          <label>
            <span>Référence de réservation</span>
            <input
              v-model.trim="form.reservation_reference"
              type="text"
              name="reservation_reference"
              maxlength="120"
              placeholder="Ex: BT-123456"
            />
          </label>
        </div>

        <label class="form-row">
          <span>Votre question</span>
          <textarea
            v-model.trim="form.message"
            name="message"
            required
            maxlength="3000"
            rows="6"
          ></textarea>
        </label>

        <label class="consent-row">
          <input
            v-model="form.consent"
            type="checkbox"
            name="consent"
            required
          />
          <span>J'accepte que BedTrip utilise ces informations pour répondre à ma demande.</span>
        </label>

        <p
          v-if="statusMessage"
          class="form-status"
          :class="`form-status--${statusKind}`"
          role="status"
        >
          {{ statusMessage }}
        </p>

        <button
          class="send-button"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Envoi en cours...' : 'Envoyer le message' }}
        </button>
      </form>

      <div class="contact-details">
        <a href="tel:+33235082249">
          <i class="pi pi-phone" aria-hidden="true"></i>
          <span>02 35 08 22 49</span>
        </a>
        <a href="mailto:kotanvoyages@outlook.com">
          <i class="pi pi-envelope" aria-hidden="true"></i>
          <span>kotanvoyages@outlook.com</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { sendContactRequest } from '../services/contactApi.js'
import { absoluteUrl, setPageSeo } from '../utils/seo'

const topicOptions = [
  { value: 'reservation', label: 'Une réservation', icon: 'pi pi-calendar' },
  { value: 'payment', label: 'Paiement', icon: 'pi pi-credit-card' },
  { value: 'cancellation', label: 'Annulation', icon: 'pi pi-refresh' },
  { value: 'general', label: 'Question', icon: 'pi pi-comment' },
  { value: 'partnership', label: 'Professionnels', icon: 'pi pi-briefcase' },
]

const reservationReasonOptions = [
  { value: 'information', label: 'Informations sur une réservation' },
  { value: 'modify_booking', label: 'Modifier une réservation' },
  { value: 'cancel_refund', label: 'Annulation ou remboursement' },
  { value: 'voucher_confirmation', label: 'Voucher ou confirmation' },
  { value: 'payment_invoice', label: 'Paiement ou facture' },
  { value: 'arrival_time', label: 'Arrivée tardive ou check-in' },
  { value: 'other', label: 'Autre demande' },
]

const form = reactive({
  topic: 'reservation',
  reservation_reason: 'information',
  reservation_reference: '',
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
  consent: false,
})

const isSubmitting = ref(false)
const statusMessage = ref('')
const statusKind = ref('info')

function selectTopic(topic) {
  form.topic = topic
  if (topic === 'reservation' && !form.reservation_reason) {
    form.reservation_reason = 'information'
  }
}

function resetForm() {
  form.topic = 'reservation'
  form.reservation_reason = 'information'
  form.reservation_reference = ''
  form.name = ''
  form.email = ''
  form.phone = ''
  form.subject = ''
  form.message = ''
  form.consent = false
}

async function submitContact() {
  if (isSubmitting.value) return

  isSubmitting.value = true
  statusMessage.value = ''
  statusKind.value = 'info'

  try {
    const payload = {
      topic: form.topic,
      reservation_reason:
        form.topic === 'reservation' ? form.reservation_reason : undefined,
      reservation_reference:
        form.topic === 'reservation' && form.reservation_reference
          ? form.reservation_reference
          : undefined,
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      subject: form.subject || undefined,
      message: form.message,
      consent: form.consent,
    }

    await sendContactRequest(payload)
    statusKind.value = 'success'
    statusMessage.value = 'Votre message a bien été envoyé. Nous vous répondrons rapidement.'
    resetForm()
  } catch (error) {
    statusKind.value = 'error'
    if (error?.statusCode === 429) {
      statusMessage.value = 'Trop de demandes envoyées. Réessayez dans quelques minutes.'
    } else if (error?.message === 'contact_mail_not_configured') {
      statusMessage.value = "L'envoi email n'est pas encore configuré. Appelez l'agence pour une demande urgente."
    } else {
      statusMessage.value = "Le message n'a pas pu être envoyé. Réessayez ou contactez l'agence par téléphone."
    }
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  setPageSeo({
    title: 'Contact BedTrip',
    description:
      'Contactez BedTrip pour une réservation, un paiement, une annulation ou une question sur votre séjour.',
    canonical: absoluteUrl('/contact'),
  })
})
</script>

<style scoped>
.contact-view {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(420px, 1.05fr);
  min-height: calc(100vh - 180px);
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 26px 70px -38px rgba(15, 23, 42, 0.5);
}

.contact-visual {
  position: relative;
  min-height: 720px;
  overflow: hidden;
  background: #dbe4ec;
}

.contact-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(0.95) contrast(1.04);
}

.contact-visual::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(9, 30, 45, 0.06), rgba(9, 30, 45, 0.44)),
    linear-gradient(90deg, rgba(248, 250, 252, 0), rgba(248, 250, 252, 0.12));
}

.contact-visual__caption {
  position: absolute;
  left: clamp(1.25rem, 3vw, 2rem);
  right: clamp(1.25rem, 3vw, 2rem);
  bottom: clamp(1.25rem, 3vw, 2rem);
  z-index: 1;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-shadow: 0 16px 42px rgba(2, 6, 23, 0.45);
}

.contact-visual__caption span {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.contact-visual__caption strong {
  max-width: 26rem;
  font-size: clamp(1.5rem, 2.7vw, 2.35rem);
  line-height: 1.08;
}

.contact-panel {
  padding: clamp(1.5rem, 4vw, 4rem);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96)),
    #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.4rem;
}

.contact-close {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #334155;
  font-size: 0.82rem;
  text-decoration: none;
}

.contact-close:hover,
.contact-close:focus-visible {
  color: #a5141e;
}

.contact-heading {
  max-width: 34rem;
}

.contact-heading p {
  margin: 0 0 0.35rem;
  color: #a5141e;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.contact-heading h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(2rem, 4vw, 4.2rem);
  line-height: 1;
  font-weight: 500;
}

.contact-heading span {
  display: block;
  margin-top: 0.9rem;
  color: #475569;
  font-size: 0.94rem;
  line-height: 1.55;
}

.contact-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.contact-option {
  width: auto;
  min-height: 2.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  font-weight: 700;
}

.contact-option.is-active {
  border-color: #a5141e;
  background: #a5141e;
  color: #ffffff;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row,
.form-row label,
.reservation-fields label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-row--split,
.reservation-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.contact-form label > span,
.consent-row span {
  color: #475569;
  font-size: 0.78rem;
  font-weight: 700;
}

.contact-form input,
.contact-form select,
.contact-form textarea {
  width: 100%;
  border-radius: 8px;
  border: 0;
  border-bottom: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  padding: 0.75rem 0;
  font: inherit;
  outline: none;
}

.contact-form input:focus,
.contact-form select:focus,
.contact-form textarea:focus {
  border-bottom-color: #a5141e;
  box-shadow: 0 1px 0 #a5141e;
}

.contact-form textarea {
  min-height: 8.5rem;
  resize: vertical;
}

.consent-row {
  display: grid;
  grid-template-columns: 1.1rem minmax(0, 1fr);
  align-items: flex-start;
  gap: 0.65rem;
}

.consent-row input {
  width: 1rem;
  height: 1rem;
  margin: 0.15rem 0 0;
  accent-color: #a5141e;
}

.form-status {
  margin: 0;
  border-radius: 8px;
  padding: 0.75rem 0.85rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.form-status--success {
  background: #dcfce7;
  color: #166534;
}

.form-status--error {
  background: #fee2e2;
  color: #991b1b;
}

.send-button {
  width: fit-content;
  min-width: 11rem;
  border-radius: 8px;
  border: 1px solid #111827;
  background: #111827;
  color: #ffffff;
  padding: 0.8rem 1rem;
  font-weight: 800;
  cursor: pointer;
}

.send-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.contact-details {
  margin-top: 1.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.4rem;
  color: #475569;
  font-size: 0.78rem;
}

.contact-details a {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.contact-details a:hover,
.contact-details a:focus-visible {
  color: #a5141e;
}

@media (max-width: 980px) {
  .contact-view {
    grid-template-columns: 1fr;
  }

  .contact-visual {
    min-height: 300px;
  }

  .contact-panel {
    padding: 1.5rem;
  }
}

@media (max-width: 640px) {
  .contact-view {
    min-height: auto;
    border-left: 0;
    border-right: 0;
    margin-left: calc(-1 * var(--shell-pad, 1rem));
    margin-right: calc(-1 * var(--shell-pad, 1rem));
  }

  .contact-visual {
    min-height: 220px;
  }

  .form-row--split,
  .reservation-fields {
    grid-template-columns: 1fr;
  }

  .contact-option,
  .send-button {
    width: 100%;
    justify-content: center;
  }

  .contact-heading h2 {
    font-size: 2.15rem;
  }
}
</style>
