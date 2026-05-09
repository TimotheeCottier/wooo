/* =========================================================
   WOOO — Validation finale des choix
   ---------------------------------------------------------
   - Affiche tous les choix du joueur connecté
   - Bouton "Modifier" → retour vers search.html?theme=X
   - Bouton "Je valide !" → redirige vers invite.html (créateur) ou lobby.html (invité)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo validate.js] version 4 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack          = $('btn-back');
  const myAvatar         = $('my-avatar');
  const themesList       = $('validate-themes');
  const loadingEl        = $('validate-loading');
  const btnValidate      = $('btn-validate');
  const audio            = $('audio-player');


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  // Avatar du joueur
  const av = session.avatar || 1;
  myAvatar.innerHTML = `<img src="assets/avatar${av}.png" alt="" />`;

  let currentPlayingId = null;


  // ======= CHARGEMENT DES PICKS =======
  async function load() {
    try {
      const allPicks = await Wooo.api.getPicksForPartie(session.partie_id);
      const myPicks = allPicks.filter(p => p.joueur_id === session.joueur_id);
      // Trier par theme_index
      myPicks.sort((a, b) => a.theme_index - b.theme_index);
      renderList(myPicks);
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'Erreur de chargement.';
    }
  }


  function renderList(picks) {
    loadingEl.hidden = true;

    themesList.innerHTML = (session.themes || []).map((themeName, idx) => {
      const pick = picks.find(p => p.theme_index === idx);
      const songHtml = pick ? `
        <div class="validate-song" data-track-id="${pick.id}" data-preview="${escapeHtml(pick.preview_url || '')}">
          <div class="validate-song__cover" data-action="play">
            <img src="${escapeHtml(pick.cover || '')}" alt="" onerror="this.style.display='none'" />
            <button type="button" class="validate-song__play" aria-label="Écouter">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
            </button>
          </div>
          <div class="validate-song__info">
            <p class="validate-song__title">${escapeHtml(pick.title)}</p>
            <p class="validate-song__artist">${escapeHtml(pick.artist)}</p>
          </div>
          <button type="button" class="validate-song__edit" data-action="edit" data-theme="${idx}">Modifier</button>
        </div>
      ` : `
        <div class="validate-song">
          <div class="validate-song__info">
            <p class="validate-song__title" style="color: var(--color-error);">Pas de chanson choisie</p>
          </div>
          <button type="button" class="validate-song__edit" data-action="edit" data-theme="${idx}">Choisir</button>
        </div>
      `;
      return `
        <li class="validate-theme">
          <div class="validate-theme__head">
            <span class="validate-theme__num">${idx + 1}</span>
            <span class="validate-theme__name">${escapeHtml(themeName)}</span>
          </div>
          ${songHtml}
        </li>
      `;
    }).join('');

    // Désactive le bouton Valider si tous les thèmes ne sont pas choisis
    const allChosen = (session.themes || []).every((_, idx) => picks.find(p => p.theme_index === idx));
    btnValidate.disabled = !allChosen;
  }


  // ======= INTERACTIONS =======
  themesList.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'edit') {
      const themeIdx = e.target.closest('[data-action]').dataset.theme;
      // Marque qu'on est en mode "édition" : confirm.html devra revenir ici
      sessionStorage.setItem('wooo:edit-return', 'validate');
      window.location.href = 'search.html?theme=' + themeIdx;
    } else if (action === 'play') {
      const songEl = e.target.closest('.validate-song');
      const trackId = songEl.dataset.trackId;
      const preview = songEl.dataset.preview;
      togglePlay(trackId, preview);
    }
  });


  function togglePlay(trackId, preview) {
    if (!preview) return;
    if (currentPlayingId === trackId) {
      audio.pause();
      currentPlayingId = null;
    } else {
      audio.src = preview;
      audio.play();
      currentPlayingId = trackId;
    }
    updatePlayingState();
  }

  audio.addEventListener('ended', () => {
    currentPlayingId = null;
    updatePlayingState();
  });

  function updatePlayingState() {
    themesList.querySelectorAll('.validate-song').forEach(el => {
      const isPlaying = el.dataset.trackId === currentPlayingId;
      const playBtn = el.querySelector('.validate-song__play');
      if (playBtn) playBtn.classList.toggle('is-active', isPlaying);
    });
  }


  // ======= VALIDATION =======
  btnValidate.addEventListener('click', () => {
    audio.pause();
    // Créateur ET invité vont au lobby (pas d'écran intermédiaire pour le créateur)
    window.location.href = 'lobby.html';
  });


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    audio.pause();
    // Retour au dernier thème
    const lastIdx = (session.themes || []).length - 1;
    window.location.href = 'search.html?theme=' + Math.max(0, lastIdx);
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  load();

})();
