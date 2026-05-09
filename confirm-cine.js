/* =========================================================
   WOOO Ciné — Confirmation d'un film/série
   ---------------------------------------------------------
   - Affiche poster + titre + année + réalisateur
   - Pas de play/pause
   - "Je confirme" → save puis search-cine ou validate-cine
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo confirm-cine.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack       = $('btn-back');
  const btnClose      = $('btn-close');
  const progressDots  = $('progress-dots');
  const themeTitleEl  = $('confirm-theme');
  const posterImg     = $('poster-img');
  const titleEl       = $('film-title');
  const metaEl        = $('film-meta');
  const btnConfirm    = $('btn-confirm');


  // ======= SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('hub.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  const themeName = (session.themes && session.themes[themeIndex]) || '';
  const totalThemes = (session.themes || []).length;

  themeTitleEl.textContent = themeName.toUpperCase();
  renderProgressDots();


  // ======= PENDING PICK =======
  let pending = null;
  try {
    const raw = sessionStorage.getItem('wooo:pending-pick-cine');
    if (raw) pending = JSON.parse(raw);
  } catch (e) {}

  if (!pending || pending.theme_index !== themeIndex) {
    window.location.replace('search-cine.html?theme=' + themeIndex);
    return;
  }

  posterImg.src = pending.poster || '';
  titleEl.textContent = pending.title + (pending.year ? ' (' + pending.year + ')' : '');
  metaEl.textContent = pending.director || (pending.tmdb_type === 'tv' ? 'Série' : 'Film');


  function renderProgressDots() {
    let html = '';
    for (let i = 0; i < totalThemes; i++) {
      if (i === themeIndex) {
        html += `<span class="progress-dot is-current">${i + 1}</span>`;
      } else if (i < themeIndex) {
        html += `<span class="progress-dot is-done"></span>`;
      } else {
        html += `<span class="progress-dot"></span>`;
      }
    }
    progressDots.innerHTML = html;
  }


  // ======= CONFIRMATION =======
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Enregistrement…';

    try {
      // On réutilise savePick avec une "fausse" structure deezer-compatible
      // Champs deezer_id, title, artist, cover, preview_url existent dans la table 'choix'
      // Pour le ciné, on stocke :
      //   - deezer_id = "tmdb:movie:123" ou "tmdb:tv:456"  (préfixé pour distinguer)
      //   - title     = titre + année
      //   - artist    = réalisateur (ou type pour les séries sans réa connu)
      //   - cover     = poster URL
      //   - preview_url = '' (vide, pas de preview audio)
      const compositeId = 'tmdb:' + pending.tmdb_type + ':' + pending.tmdb_id;
      await Wooo.api.savePick(session.partie_id, session.joueur_id, themeIndex, {
        id: compositeId,
        title: pending.title + (pending.year ? ' (' + pending.year + ')' : ''),
        artist: { name: pending.director || (pending.tmdb_type === 'tv' ? 'Série' : 'Film') },
        album: { cover_medium: pending.poster, cover_big: pending.poster },
        preview: '',
      });

      sessionStorage.removeItem('wooo:pending-pick-cine');

      const editReturn = sessionStorage.getItem('wooo:edit-return');
      if (editReturn === 'validate') {
        sessionStorage.removeItem('wooo:edit-return');
        window.location.href = 'validate-cine.html';
        return;
      }

      if (themeIndex + 1 < totalThemes) {
        window.location.href = 'search-cine.html?theme=' + (themeIndex + 1);
      } else {
        window.location.href = 'validate-cine.html';
      }
    } catch (err) {
      console.error(err);
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Je confirme';
      alert('Oups : ' + err.message);
    }
  });


  btnBack.addEventListener('click', () => {
    sessionStorage.removeItem('wooo:pending-pick-cine');
    window.location.href = 'search-cine.html?theme=' + themeIndex;
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ?')) {
      sessionStorage.removeItem('wooo:pending-pick-cine');
      window.location.href = 'index-cine.html';
    }
  });

})();
