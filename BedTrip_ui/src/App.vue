<script setup>
import AppShell from './layouts/AppShell.vue'
import PageProgressBar from './components/PageProgressBar.vue'
import { RouterView } from 'vue-router'
</script>

<template>
  <div id="bedtrip-app">
    <PageProgressBar />
    <AppShell>
      <RouterView />
    </AppShell>
  </div>
</template>

<style scoped>
/* Minimal placeholder styling can be added here if necessary. */
</style>
