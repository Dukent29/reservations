<!--
  ConditionsView
  ==============
  Conditions page for cancellation and transport-related cases.
-->

<template>
  <section class="workspace__content conditions-view">
    <div class="legal-container">
      <div class="legal-banner conditions-banner" role="presentation">
        <div class="legal-banner__overlay"></div>
        <div class="legal-banner__content">
          <p class="legal-banner__eyebrow">Conditions</p>
          <h2>Conditions de réservation</h2>
        </div>
      </div>

      <div class="card legal-card">
        <section class="legal-section">
          <h3>1. Annulation à l'initiative du client</h3>
          <p>
            Les conditions de remboursement dépendent du type de tarif réservé.
          </p>
          <p><strong>Cas 1 · Tarif avec annulation gratuite annoncé par l'hôtel :</strong></p>
          <p>
            Le client est remboursé du montant payé, après retenue de 10% de frais.
            Les 10% restent acquis et ne sont pas remboursables.
          </p>
          <p><strong>Cas 2 · Tarif non annulable / non remboursable :</strong></p>
          <p>
            En cas d'annulation, le client perd l'intégralité du paiement.
            Aucun remboursement n'est dû.
          </p>
        </section>

        <section class="legal-section">
          <h3>2. Annulation liée au transport</h3>
          <p>
            En cas de problème de transport, BedTrip exige d'être contacté immédiatement
            par téléphone afin d'étudier la situation avec le fournisseur.
          </p>
          <p>
            BedTrip ne peut pas garantir au client le remboursement des nuitées non utilisées
            (no-show, arrivée tardive, départ anticipé, absence de check-in / check-out).
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup>
</script>

<style scoped>
.conditions-banner {
  background-image: url('/images/pexels-jimbear-1458457.jpg');
}

.legal-container {
  width: min(980px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.legal-banner {
  position: relative;
  border-radius: 1.5rem;
  overflow: hidden;
  min-height: 180px;
  display: flex;
  align-items: flex-end;
  padding: 1.5rem;
  background-size: cover;
  background-position: center;
  box-shadow: 0 30px 70px -30px rgba(15, 23, 42, 0.5);
}

.legal-banner__overlay {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
}

.legal-banner__content {
  position: relative;
  z-index: 1;
  color: #f8fafc;
}

.legal-banner__eyebrow {
  margin: 0 0 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.75);
}

.legal-banner h2 {
  margin: 0;
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
}

.legal-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.legal-section h3 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  color: #0f172a;
}

.legal-section p {
  margin: 0 0 0.35rem;
  color: #334155;
  font-size: 0.9rem;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .legal-banner {
    min-height: 150px;
    padding: 1.2rem;
  }
}
</style>
