<!--
  AdminLoginView
  ==============
  Authentication screen for BedTrip back-office access.

  Main responsibilities:
  - Submit admin/editor credentials to the admin auth API.
  - Redirect authenticated users to the requested admin route.
  - Handle invalid credentials and rate-limit responses.
  - Keep the public app separate from protected admin routes.
-->

<template>
  <section class="admin-login">
    <div class="admin-login__panel">
      <div class="admin-login__hero">
        <p class="admin-login__eyebrow">BedTrip Admin</p>
        <h1>Pilotez les réservations, les paiements et le contenu éditorial.</h1>
        <p>
          Connectez-vous avec un compte <strong>admin</strong> ou <strong>editor</strong>
          pour accéder au back-office.
        </p>
      </div>

      <div class="admin-login__card">
        <form class="admin-login__form" @submit.prevent="submitLogin">
          <label>
            Email
            <input v-model.trim="email" type="email" autocomplete="email" required />
          </label>

          <label>
            Mot de passe
            <span class="admin-login__password-wrap">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="admin-login__password-toggle"
                :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                :title="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                @click="showPassword = !showPassword"
              >
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
              </button>
            </span>
          </label>

          <p v-if="errorMessage" class="admin-login__error">{{ errorMessage }}</p>

          <button type="submit" class="admin-login__submit" :disabled="loading">
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAdminMe, loginAdmin } from '../services/adminAuth'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

async function redirectAfterLogin() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
  await router.replace(redirect || '/admin')
}

async function submitLogin() {
  loading.value = true
  errorMessage.value = ''
  try {
    await loginAdmin(email.value, password.value)
    await redirectAfterLogin()
  } catch (error) {
    if (error?.statusCode === 429) {
      await router.replace({ name: 'too-many-requests' })
      return
    }
    if (error?.statusCode === 403) {
      errorMessage.value = 'Votre compte ne peut pas accéder au back-office.'
    } else {
      errorMessage.value = 'Email ou mot de passe invalide.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (route.query.reason === 'inactive') {
    errorMessage.value = 'Session fermée après 1 heure sans activité.'
  }

  try {
    const me = await fetchAdminMe()
    const role = String(me?.user?.role || '').toLowerCase()
    if (role === 'admin' || role === 'editor') {
      await redirectAfterLogin()
    }
  } catch (_) {
    // keep login page visible
  }
})
</script>

<style scoped>
.admin-login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle at top left, rgba(245, 176, 65, 0.28), transparent 28%),
    radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.22), transparent 24%),
    linear-gradient(180deg, #f8f3ed 0%, #f1e5d8 100%);
  font-family: 'Manrope', 'Segoe UI', sans-serif;
}

.admin-login__panel {
  width: min(1040px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 420px);
  gap: 1.2rem;
  align-items: stretch;
}

.admin-login__hero,
.admin-login__card {
  border-radius: 1.6rem;
  border: 1px solid rgba(108, 83, 57, 0.12);
  box-shadow: 0 30px 80px -34px rgba(55, 38, 24, 0.24);
}

.admin-login__hero {
  padding: clamp(1.6rem, 5vw, 3rem);
  color: #231815;
  background:
    linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(45, 108, 223, 0.1)),
    rgba(255, 250, 244, 0.84);
}

.admin-login__eyebrow {
  margin: 0 0 0.75rem;
  color: #6f6256;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  font-weight: 800;
}

.admin-login__hero h1 {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 4vw, 3.3rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.admin-login__card {
  padding: 1.4rem;
  background: rgba(255, 250, 244, 0.9);
  backdrop-filter: blur(18px);
}

.admin-login__form {
  display: grid;
  gap: 0.85rem;
}

.admin-login__password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.admin-login__password-wrap input {
  width: 100%;
  padding-right: 2.8rem;
}

.admin-login__password-toggle {
  position: absolute;
  right: 0.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: end;
  border: 0;
  background: transparent;
  color: #6f6256;
  cursor: pointer;
  padding: 0.2rem;
}

.admin-login__error {
  margin: 0;
  color: #b42318;
}

.admin-login__submit {
  width: 100%;
  border: 1px solid rgba(15, 118, 110, 0.12);
  border-radius: 1rem;
  padding: 0.88rem 1rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #2d6cdf 100%);
}

@media (max-width: 860px) {
  .admin-login__panel {
    grid-template-columns: 1fr;
  }
}
</style>
