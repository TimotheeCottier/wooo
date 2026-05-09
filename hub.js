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
      const queries = ['top hits', 'pop 2024', 'rap fr', 'rock classics', 'electro'];
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


  // ======= CINÉ : on utilise une liste hardcodée de top films/séries =======
  // (TMDB sans clé n'est pas dispo, OMDb demande aussi une clé.
  //  On utilise une liste statique d'URLs d'affiches publiques.)
  async function loadCineMosaic() {
    // Liste curatée d'affiches de films cultes (URLs CDN publiques de TMDB).
    // Si une URL casse, on n'affiche juste pas la cellule (pas de souci visuel).
    const covers = [
      'https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg', // The Godfather
      'https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', // Pulp Fiction
      'https://image.tmdb.org/t/p/w500/aiy35Evcofzl7hASZZvsfQrbXIC.jpg', // The Shawshank Redemption
      'https://image.tmdb.org/t/p/w500/fjS3DmlGXTKw9QqAUluzLNMfvk7.jpg', // Schindler's List
      'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', // The Godfather Part II
      'https://image.tmdb.org/t/p/w500/oU7Oq2kFAAlGqbU4VoAE36g4hoI.jpg', // The Dark Knight
      'https://image.tmdb.org/t/p/w500/eBP6mTXhDr9C8kRxxZX1tQR5xKJ.jpg', // Inception
      'https://image.tmdb.org/t/p/w500/jeAQdDX9nguP6YOX6QSWKDPkbBw.jpg', // Forrest Gump
      'https://image.tmdb.org/t/p/w500/9O7gLzmreU0nGkIB6K3BsJbzvNv.jpg', // The Matrix
      'https://image.tmdb.org/t/p/w500/79y4kReVqUiwSiCwS3Bch1XgUBP.jpg', // Goodfellas
      'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // Lord of the Rings
      'https://image.tmdb.org/t/p/w500/3WHetfJBxpBDBkWS8YMfjP5GqAZ.jpg', // Fight Club
      'https://image.tmdb.org/t/p/w500/yP7KhIz1FVyuNLEdvSwjrDPNZGY.jpg', // Spirited Away
      'https://image.tmdb.org/t/p/w500/ftD1QOwbLRvZbThA8a6PpZqvnSW.jpg', // Parasite
      'https://image.tmdb.org/t/p/w500/r4B5sQBbo8GtMKKxgjnHiaCVNg2.jpg', // Interstellar
      'https://image.tmdb.org/t/p/w500/9O1Iy9od7uG14gPy3eFBuBLklrG.jpg', // Avatar
      'https://image.tmdb.org/t/p/w500/30bn5Hh4alGePqr2P4iLEAh75DH.jpg', // Game of Thrones
      'https://image.tmdb.org/t/p/w500/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg', // Stranger Things
      'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',  // Breaking Bad
      'https://image.tmdb.org/t/p/w500/9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg', // The Office
      'https://image.tmdb.org/t/p/w500/qztOZCFlkHjcj6n2H4sMPENSpgT.jpg', // Better Call Saul
      'https://image.tmdb.org/t/p/w500/lBYOKAMcc0R3wWVnPnIcF4DC8Wx.jpg', // Squid Game
      'https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg', // Friends
      'https://image.tmdb.org/t/p/w500/4DSpPF9JhLWuAvrJUtGWosBXmGr.jpg', // Lupin
    ];

    renderMosaic(mosaicCine, covers.slice(0, MOSAIC_CELLS));
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
