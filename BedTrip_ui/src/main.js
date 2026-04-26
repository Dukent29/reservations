import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { startAdminInactivityWatcher } from './services/adminAuth'
import './styles/app.css'
import './styles/admin.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

startAdminInactivityWatcher()

app.mount('#app')
