import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(router)

app.mount('#app')
