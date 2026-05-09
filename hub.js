/* =========================================================
   WOOO — Hub : choix entre Musique et Ciné/Séries
   ---------------------------------------------------------
   - Charge une mosaïque de pochettes Deezer (top chart)
   - Charge une mosaïque d'affiches de films/séries (TMDB)
   - Les images sont en background des 2 cartes (opacité 40%)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo hub.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const mosaicMusique = $('mosaic-musique');
  const mosaicCine    = $('mosaic-cine');

  // Nombre de cellules à remplir (assez pour couvrir l'écran).
  // En desktop : 4 colonnes × ~6 lignes = 24
  // En mobile : 3 colonnes × ~5 lignes = 15
  // On en met 24 pour être large, le grid auto-rows fera le reste
  const MOSAIC_CELLS = 24;


  // ======= MUSIQUE : top tracks Deezer via edge function =======
  async function loadMusicMosaic() {
    try {
      // On utilise notre edge function existante avec des recherches "tendance"
      // Plusieurs requêtes pour avoir un mix varié
      const queries = ['pop 2024', 'rap fr', 'rock classics', 'electro', 'r&b', 'indie'];
      const allCovers = new Set();

      for (const q of queries) {
        try {
          const tracks = await Wooo.api.searchDeezer(q, null, { index: 0, limit: 8 });
          tracks.forEach(t => {
            const cover = t.album && (t.album.cover_medium || t.album.cover_big);
            if (cover) allCovers.add(cover);
          });
          if (allCovers.size >= MOSAIC_CELLS) break;
        } catch (e) { /* on ignore les erreurs ponctuelles */ }
      }

      const covers = Array.from(allCovers).slice(0, MOSAIC_CELLS);
      renderMosaic(mosaicMusique, covers);
    } catch (err) {
      console.warn('[Wooo hub] erreur chargement Musique :', err);
      // Fallback : juste une couleur unie (l'overlay orange suffira)
    }
  }


  // ======= CINÉ : top trending TMDB =======
  async function loadCineMosaic() {
    try {
      // On veut beaucoup d'affiches → on charge plusieurs pages
      const allPosters = new Set();
      for (let page = 1; page <= 3; page++) {
        try {
          const items = await Wooo.api.topTmdb(null);
          items.forEach(i => {
            if (i.poster) allPosters.add(i.poster);
          });
          // topTmdb ne pagine pas par défaut, mais on peut s'en sortir avec une recherche élargie
          if (allPosters.size >= MOSAIC_CELLS) break;
        } catch (e) { /* ignore */ }
        // Pas de pagination native ici → on sort après 1 itération
        break;
      }

      // Si on n'a pas assez : on lance des recherches "tendance" générique
      if (allPosters.size < MOSAIC_CELLS) {
        const fallbackQueries = ['marvel', 'netflix', 'disney', 'hbo'];
        for (const q of fallbackQueries) {
          try {
            const results = await Wooo.api.searchTmdb(q, null, { page: 1 });
            results.forEach(r => { if (r.poster) allPosters.add(r.poster); });
            if (allPosters.size >= MOSAIC_CELLS) break;
          } catch (e) { /* ignore */ }
        }
      }

      const posters = Array.from(allPosters).slice(0, MOSAIC_CELLS);
      renderMosaic(mosaicCine, posters);
    } catch (err) {
      console.warn('[Wooo hub] erreur chargement Ciné :', err);
    }
  }


  // ======= RENDU MOSAÏQUE =======
  function renderMosaic(container, urls) {
    container.innerHTML = '';
    // S'il manque des images on remplit avec des cellules vides
    for (let i = 0; i < MOSAIC_CELLS; i++) {
      const url = urls[i];
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => {
          // Si une image plante, on la remplace par une cellule unie
          const cell = document.createElement('div');
          cell.className = 'mosaic-cell';
          if (img.parentNode) img.parentNode.replaceChild(cell, img);
        });
        container.appendChild(img);
      } else {
        const cell = document.createElement('div');
        cell.className = 'mosaic-cell';
        container.appendChild(cell);
      }
    }
  }


  // ======= INIT =======
  loadMusicMosaic();
  loadCineMosaic();

})();
