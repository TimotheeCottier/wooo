/* =========================================================
   WOOO — Recherche de chanson
   ---------------------------------------------------------
   - Recherche LIVE (debounce 300ms après que l'utilisateur arrête de taper)
   - Pagination (charger plus, par 10)
   - Preview audio en cliquant sur la pochette
   - "Choisir" REDIRIGE vers confirm.html (avec les données de la chanson)
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo search.js] version 4 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack          = $('btn-back');
  const btnClose         = $('btn-close');
  const progressDots     = $('progress-dots');
  const themeTitleEl     = $('search-theme');
  const searchInput      = $('search-input');
  const btnSearch        = $('btn-search');
  const emptyState       = $('search-empty');
  const resultsList      = $('search-results');
  const btnLoadMore      = $('btn-load-more');
  const loadingEl        = $('search-loading');
  const audio            = $('audio-player');

  const PAGE_SIZE = 10;
  const DEBOUNCE_MS = 300;


  // ======= LECTURE SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  const themeName = (session.themes && session.themes[themeIndex]) || '';
  const totalThemes = (session.themes || []).length;

  themeTitleEl.textContent = themeName.toUpperCase();
  renderProgressDots();


  // ======= ÉTAT =======
  let currentQuery = '';
  let currentIndex = 0;
  let allLoadedTracks = [];
  let abortController = null;
  let currentPlayingId = null;
  let debounceTimer = null;


  // ======= PROGRESS DOTS =======
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


  // ======= RECHERCHE LIVE (debounce) =======
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      // Trop court → reset
      if (abortController) abortController.abort();
      currentQuery = '';
      allLoadedTracks = [];
      resultsList.hidden = true;
      btnLoadMore.hidden = true;
      loadingEl.hidden = true;
      emptyState.hidden = false;
      emptyState.innerHTML = '<p class="search-empty__emoji">🥹</p><p class="search-empty__text">On sait, c\'est difficile<br>d\'en choisir une seule&nbsp;!</p>';
      return;
    }
    debounceTimer = setTimeout(() => performNewSearch(), DEBOUNCE_MS);
  });

  // Le bouton loupe relance immédiatement (sans debounce)
  btnSearch.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    if (searchInput.value.trim().length >= 2) performNewSearch();
  });

  // Entrée déclenche immédiatement
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      if (searchInput.value.trim().length >= 2) performNewSearch();
    }
  });


  function performNewSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) return;

    if (abortController) abortController.abort();
    abortController = new AbortController();

    currentQuery = query;
    currentIndex = 0;
    allLoadedTracks = [];

    emptyState.hidden = true;
    resultsList.hidden = true;
    btnLoadMore.hidden = true;
    loadingEl.hidden = false;

    Wooo.api.searchDeezer(query, abortController.signal, { index: 0, limit: PAGE_SIZE })
      .then(tracks => {
        loadingEl.hidden = true;
        if (tracks.length === 0) {
          emptyState.hidden = false;
          emptyState.innerHTML = '<p class="search-empty__emoji">😅</p><p class="search-empty__text">Aucun résultat pour cette recherche.<br>Essaie autre chose !</p>';
          return;
        }
        allLoadedTracks = tracks;
        currentIndex = tracks.length;
        renderResults(allLoadedTracks);
        btnLoadMore.hidden = (tracks.length < PAGE_SIZE);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error(err);
        loadingEl.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = '<p class="search-empty__emoji">😱</p><p class="search-empty__text">Erreur de recherche, réessaie plus tard.</p>';
      });
  }


  // ======= CHARGER PLUS =======
  btnLoadMore.addEventListener('click', () => {
    if (!currentQuery) return;
    btnLoadMore.disabled = true;
    btnLoadMore.textContent = 'Chargement…';

    Wooo.api.searchDeezer(currentQuery, null, { index: currentIndex, limit: PAGE_SIZE })
      .then(tracks => {
        if (tracks.length === 0) {
          btnLoadMore.hidden = true;
        } else {
          allLoadedTracks = allLoadedTracks.concat(tracks);
          currentIndex += tracks.length;
          renderResults(allLoadedTracks);
          if (tracks.length < PAGE_SIZE) btnLoadMore.hidden = true;
        }
      })
      .catch(err => {
        console.error(err);
        btnLoadMore.hidden = true;
      })
      .finally(() => {
        btnLoadMore.disabled = false;
        btnLoadMore.textContent = 'Charger plus de résultats';
      });
  });


  // ======= RENDU RÉSULTATS =======
  function renderResults(tracks) {
    const playable = tracks.filter(t => t.preview && t.preview.length > 0);
    if (playable.length === 0) {
      resultsList.hidden = true;
      emptyState.hidden = false;
      emptyState.innerHTML = '<p class="search-empty__emoji">🤐</p><p class="search-empty__text">Aucun extrait audio disponible pour ces résultats.<br>Essaie un autre mot-clé !</p>';
      return;
    }

    resultsList.innerHTML = playable.map((track, i) => `
      <li class="song-bloc" data-index="${i}">
        <div class="song-bloc__cover" data-action="play">
          <img src="${escapeHtml(track.album.cover_medium || '')}" alt="" loading="lazy" onerror="this.style.display='none'" />
          <button type="button" class="song-bloc__play" aria-label="Écouter l'extrait">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          </button>
        </div>
        <div class="song-bloc__info">
          <p class="song-bloc__title">${escapeHtml(track.title)}</p>
          <p class="song-bloc__artist">${escapeHtml(track.artist.name)}</p>
        </div>
        <button type="button" class="song-bloc__choose" data-action="choose">Choisir</button>
      </li>
    `).join('');

    resultsList.querySelectorAll('.song-bloc').forEach((el, i) => { el._track = playable[i]; });
    resultsList.hidden = false;
  }


  // ======= CLIC SUR UN RÉSULTAT =======
  resultsList.addEventListener('click', (e) => {
    const item = e.target.closest('.song-bloc');
    if (!item) return;
    const track = item._track;
    if (!track) return;

    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'play') {
      togglePlay(track);
    } else if (action === 'choose') {
      goToConfirm(track);
    }
  });


  function togglePlay(track) {
    if (currentPlayingId === track.id) {
      audio.pause();
      currentPlayingId = null;
      updatePlayingState();
    } else {
      audio.src = track.preview;
      audio.play();
      currentPlayingId = track.id;
      updatePlayingState();
    }
  }

  audio.addEventListener('ended', () => {
    currentPlayingId = null;
    updatePlayingState();
  });

  function updatePlayingState() {
    resultsList.querySelectorAll('.song-bloc').forEach(el => {
      const isPlaying = el._track && el._track.id === currentPlayingId;
      const playBtn = el.querySelector('.song-bloc__play');
      if (playBtn) playBtn.classList.toggle('is-active', isPlaying);
    });
  }


  // ======= REDIRECTION VERS CONFIRM =======
  function goToConfirm(track) {
    audio.pause();
    // On stocke le track sélectionné dans sessionStorage pour le passer à confirm.html
    const payload = {
      theme_index: themeIndex,
      deezer_id:   String(track.id),
      title:       track.title,
      artist:      track.artist.name,
      cover:       track.album.cover_big || track.album.cover_medium || '',
      preview:     track.preview,
    };
    sessionStorage.setItem('wooo:pending-pick', JSON.stringify(payload));
    window.location.href = 'confirm.html?theme=' + themeIndex;
  }


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    // Si on était en mode édition (depuis validate.html), retour à validate
    const editReturn = sessionStorage.getItem('wooo:edit-return');
    if (editReturn === 'validate') {
      sessionStorage.removeItem('wooo:edit-return');
      window.location.href = 'validate.html';
      return;
    }

    if (themeIndex > 0) {
      window.location.href = 'search.html?theme=' + (themeIndex - 1);
    } else {
      window.location.href = session.is_creator ? 'lobby.html' : 'lobby-invite.html';
    }
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ? Tes choix actuels seront sauvegardés.')) {
      window.location.href = 'index.html';
    }
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // Focus auto au chargement
  setTimeout(() => searchInput.focus(), 100);

})();
