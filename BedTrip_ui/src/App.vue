<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShell from './layouts/AppShell.vue'
import PageProgressBar from './components/PageProgressBar.vue'

const route = useRoute()
const usesPublicShell = computed(() => route.meta?.appShell !== false)
</script>

<template>
  <div id="bedtrip-app">
    <PageProgressBar />
    <RouterView v-slot="{ Component }">
      <AppShell v-if="usesPublicShell">
        <component :is="Component" />
      </AppShell>
      <component :is="Component" v-else />
    </RouterView>
  </div>
</template>

<style scoped>
/* Minimal placeholder styling can be added here if necessary. */
</style>
