<template>
  <div class="results-list results-skeleton">
    <div class="card results-card">
      <div class="skeleton-header">
        <span class="skeleton-line skeleton-line--title shimmer"></span>
        <span class="skeleton-line skeleton-line--meta shimmer"></span>
      </div>
      <ul class="skeleton-list">
        <li
          v-for="n in 3"
          :key="`card-${n}`"
          class="skeleton-card"
        >
          <div class="skeleton-thumb shimmer"></div>
          <div class="skeleton-info">
            <span class="skeleton-line shimmer"></span>
            <span class="skeleton-line shimmer"></span>
            <div class="skeleton-badges">
              <span
                v-for="badge in 3"
                :key="`badge-${n}-${badge}`"
                class="skeleton-pill shimmer"
              ></span>
            </div>
            <div class="skeleton-cta shimmer"></div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.results-skeleton {
  opacity: 0.85;
}

.skeleton-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.skeleton-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-card {
  display: grid;
  grid-template-columns: minmax(200px, 240px) 1fr;
  gap: 0.75rem;
}

.skeleton-thumb {
  width: 100%;
  height: 180px;
  border-radius: 1rem;
  background: rgba(148, 163, 184, 0.15);
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  height: 16px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  display: block;
}

.skeleton-line--title {
  width: 60%;
  height: 20px;
}

.skeleton-line--meta {
  width: 40%;
}

.skeleton-badges {
  display: flex;
  gap: 0.35rem;
}

.skeleton-pill {
  width: 70px;
  height: 18px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
}

.skeleton-cta {
  width: 130px;
  height: 34px;
  border-radius: 0.8rem;
  background: rgba(148, 163, 184, 0.2);
}

.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgba(255, 255, 255, 0.18) 45%,
    transparent 90%
  );
  transform: translateX(-100%);
  animation: shimmer-slide 1.4s infinite;
}

@keyframes shimmer-slide {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 900px) {
  .skeleton-card {
    grid-template-columns: 1fr;
  }

  .skeleton-thumb {
    height: 140px;
  }
}
</style>
