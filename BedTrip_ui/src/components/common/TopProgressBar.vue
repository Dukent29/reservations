<!--
  TopProgressBar
  ==============
  Component representing the top loading bar (`#top-progress-bar`)
  currently controlled via DOM helpers in front scripts.

  Responsibilities:
  - Render a fixed bar at top of viewport.
  - React to a boolean or state prop (e.g. `loadingCount`) to start/stop animation.
  - Implement width/opacity transitions similar to startTopProgress/finishTopProgress.
  - Provide a simple interface:
    - Props: `activeRequests` (number) or `loading` (boolean).
    - Watch changes and animate accordingly.
-->

<template>
  <div id="top-progress-bar">
    <!-- Visual behavior controlled by props and CSS transitions. -->
  </div>
</template>

<script setup>
// Future props and watchers will replicate the logic of:
// - startTopProgress()
// - finishTopProgress()
</script>

<style scoped>
/* This component will reuse styles similar to `#top-progress-bar` defined
   in front/public/style.css (height, background, transitions). */
</style>

