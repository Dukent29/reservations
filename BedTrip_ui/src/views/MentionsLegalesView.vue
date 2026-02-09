<!--
  MentionsLegalesView
  ===================
  Simple placeholder legal notice page (French).
-->

<template>
  <section class="workspace__content legal-view">
    <div class="legal-container">
      <div class="legal-banner" role="presentation">
        <div class="legal-banner__overlay"></div>
        <div class="legal-banner__content">
          <p class="legal-banner__eyebrow">Informations juridiques</p>
          <h2>Mentions légales</h2>
        </div>
      </div>

      <div class="card legal-card">
        <section class="legal-section">
          <h3>Éditeur du site</h3>
          <div class="legal-grid">
            <div>
              <p><strong>Raison sociale :</strong> Kotan Voyages</p>
              <p><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p>
              <p><strong>Capital social :</strong> 7 500 €</p>
              <p><strong>Siège social :</strong> 29, Avenue Jean Jaurès - 76140 LE PETIT QUEVILLY</p>
              <p><strong>Numéro TVA :</strong> FR92751385436</p>
              <p><strong>Tél :</strong> +33 2 35 08 22 49</p>
            </div>
            <div>
              <p><strong>Directeur de la publication :</strong> Taner KOTAN</p>
              <p><strong>Garant :</strong> APST</p>
              <p><strong>Assureur :</strong> Helvetia</p>
              <p>
                <strong>Immatriculation :</strong> Agence de voyages en ligne en France (Atout France)
              </p>
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h3>Hébergeur</h3>
          <div class="legal-grid">
            <div>
              <p><strong>Hébergeur :</strong> OVH</p>
              <p><strong>Forme de la société :</strong> SAS</p>
              <p><strong>Capital social :</strong> 10 174 560 €</p>
              <p><strong>Numéro RCS :</strong> Lille 537 407 926</p>
            </div>
            <div>
              <p><strong>Lieu d'hébergement des données :</strong></p>
              <p>OVH GRAVELINES, RTE DE LA FERME MASSON 59820 GRAVELINES</p>
              <p><strong>Conception et réalisation :</strong> Kotan Computer-Systems</p>
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h3>Propriété intellectuelle</h3>
          <p>
            Ce site Internet, sa structure générale, ainsi que les textes, images animées
            ou non et tout autre élément composant le site sont la propriété exclusive de
            la SARL KOTAN-VOYAGES.
          </p>
          <p>
            Toute reproduction ou représentation totale ou partielle de ce site, par quelque
            procédé que ce soit, sans l'autorisation expresse de la SARL KOTAN-VOYAGES est
            interdite.
          </p>
          <p>
            À défaut d'autorisation expresse, la SARL KOTAN-VOYAGES se réserve la possibilité
            de poursuivre tout acte de contrefaçon de ses droits de propriété intellectuelle.
          </p>
        </section>

        <section class="legal-section">
          <h3>Droit applicable - compétence</h3>
          <p>
            Le site et son contenu sont régis par le droit français et tout litige éventuel
            s'y rapportant sera soumis à la compétence des tribunaux français.
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup>
</script>

<style scoped>
.legal-banner {
  position: relative;
  border-radius: 1.5rem;
  overflow: hidden;
  min-height: 180px;
  display: flex;
  align-items: flex-end;
  padding: 1.5rem;
  background-image: url('/images/pexels-donaldtong94-189296.jpg');
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

.legal-container {
  width: min(980px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.legal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem 2rem;
}

@media (max-width: 720px) {
  .legal-banner {
    min-height: 150px;
    padding: 1.2rem;
  }
}
</style>
