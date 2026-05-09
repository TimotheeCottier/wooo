/* =========================================================
   WOOO — Recherche de chanson
   ---------------------------------------------------------
   - Recherche Deezer via Edge Function
   - Pagination (charger plus, par 10)
   - Preview audio en cliquant sur la pochette
   - "Choisir" enregistre le pick et passe au thème suivant
   ========================================================= */

(function () {
  'use strict';

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


  // ======= RECHERCHE =======
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

  btnSearch.addEventListener('click', performNewSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performNewSearch();
    }
  });


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
    // Filtre les morceaux sans extrait audio
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
  resultsList.addEventListener('click', async (e) => {
    const item = e.target.closest('.song-bloc');
    if (!item) return;
    const track = item._track;
    if (!track) return;

    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'play') {
      togglePlay(track);
    } else if (action === 'choose') {
      await choose(track);
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


  // ======= CHOISIR LA CHANSON =======
  async function choose(track) {
    audio.pause();
    try {
      await Wooo.api.savePick(session.partie_id, session.joueur_id, themeIndex, track);

      // Aller au thème suivant ou au lobby
      if (themeIndex + 1 < totalThemes) {
        window.location.href = 'search.html?theme=' + (themeIndex + 1);
      } else {
        window.location.href = 'lobby.html';
      }
    } catch (err) {
      console.error(err);
      alert('Oups : ' + err.message);
    }
  }


  // ======= NAVIGATION =======
  btnBack.addEventListener('click', () => {
    if (themeIndex > 0) {
      window.location.href = 'search.html?theme=' + (themeIndex - 1);
    } else {
      // Si créateur → invite, sinon → join
      window.location.href = session.is_creator ? 'invite.html' : 'lobby.html';
    }
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ? Tes choix actuels seront sauvegardés.')) {
      window.location.href = 'index.html';
    }
  });


  // ======= UTILITAIRE =======
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // Focus auto au chargement
  setTimeout(() => searchInput.focus(), 100);

})();
