/* =========================================================
   WOOO MUSIQUE — Recherche musicale
   ---------------------------------------------------------
   - Recherche via Edge Function Supabase (relai Deezer)
   - Pagination : 10 morceaux à la fois, "Charger plus" pour 10 de plus
   - Bouton "Choisir" (rouge, en pilule) pour valider un morceau
   - Lecture audio des extraits 30 sec
   ========================================================= */

(function () {
  'use strict';

  const PAGE_SIZE = 10;
  const DEBOUNCE_MS = 350;
  const REQUEST_TIMEOUT_MS = 10000;


  const $ = (id) => document.getElementById(id);

  const input         = $('search-input');
  const resultsList   = $('results');
  const loadMoreBtn   = $('load-more');
  const audioPlayer   = $('audio-player');

  const stateIdle     = $('state-idle');
  const stateEmpty    = $('state-empty');
  const stateError    = $('state-error');

  const stepSearch    = $('step-search');
  const stepConfirm   = $('step-confirm');
  const actionsSearch = $('actions-search');
  const actionsConfirm = $('actions-confirm');

  const themeTitleEl    = $('theme-title');
  const themeBadgeNum   = document.querySelector('.theme-badge strong');
  const themeBadgeTotal = document.querySelector('.theme-badge em');
  const demoBanner      = $('demo-banner');

  const confirmCover    = $('confirm-cover');
  const confirmTitle    = $('confirm-title');
  const confirmArtist   = $('confirm-artist');
  const confirmPlay     = $('confirm-play');
  const btnNextTheme    = $('btn-next-theme');
  const btnBackToSearch = $('btn-back-to-search');


  // ======= LECTURE DE LA SESSION =======
  const session = Wooo.session.get();
  if (!session || !session.partie_id || !session.joueur_id) {
    window.location.replace('index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const themeIndex = parseInt(params.get('theme') || '0', 10);
  if (themeIndex < 0 || themeIndex >= session.themes.length) {
    window.location.replace('search.html?theme=0');
    return;
  }

  themeTitleEl.textContent = session.themes[themeIndex];
  themeBadgeNum.textContent = `Thème ${themeIndex + 1}`;
  themeBadgeTotal.textContent = `sur ${session.themes.length}`;
  if (demoBanner) demoBanner.hidden = true;


  // ======= ÉTAT =======
  let debounceTimer = null;
  let currentRequest = null;
  let currentlyPlaying = null;
  let selectedTrack = null;
  // Pagination
  let currentQuery = '';
  let allLoadedTracks = [];      // accumulés au fil des "Charger plus"


  // ======= UTILITAIRES =======
  function setState(state) {
    [stateIdle, stateEmpty, stateError].forEach(el => {
      el.hidden = true;
    });
    if (state === 'results') {
      // En mode résultats, on ne touche pas à la liste, juste on cache les états
      return;
    }
    resultsList.innerHTML = '';
    loadMoreBtn.hidden = true;
    if      (state === 'idle')    stateIdle.hidden    = false;
    else if (state === 'empty')   stateEmpty.hidden   = false;
    else if (state === 'error')   stateError.hidden   = false;
    // 'loading' : on ne change rien (pas de loader visible) ;
    // les résultats précédents restent affichés en attendant les nouveaux
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= RECHERCHE =======

  /**
   * Première recherche : on remet à zéro et on charge les 10 premiers.
   */
  async function performNewSearch(query) {
    currentQuery = query;
    allLoadedTracks = [];

    if (currentRequest) currentRequest.abort();
    currentRequest = new AbortController();

    // On masque les hints et on garde la liste vide en attendant les résultats
    [stateIdle, stateEmpty, stateError].forEach(el => { el.hidden = true; });
    resultsList.innerHTML = '';
    loadMoreBtn.hidden = true;

    const timer = setTimeout(() => currentRequest.abort(), REQUEST_TIMEOUT_MS);

    try {
      const tracks = await Wooo.api.searchDeezer(query, currentRequest.signal, {
        index: 0, limit: PAGE_SIZE,
      });
      clearTimeout(timer);
      currentRequest = null;

      if (tracks.length === 0) {
        setState('empty');
      } else {
        allLoadedTracks = tracks;
        renderResults(allLoadedTracks);
        loadMoreBtn.hidden = (tracks.length < PAGE_SIZE);
      }
    } catch (err) {
      clearTimeout(timer);
      currentRequest = null;
      if (err.name === 'AbortError') return;
      console.error('Recherche échouée :', err);
      setState('error');
    }
  }

  /**
   * "Charger plus" : on prend la suite avec un index décalé.
   */
  async function loadMore() {
    if (!currentQuery) return;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Chargement…';

    try {
      const tracks = await Wooo.api.searchDeezer(currentQuery, null, {
        index: allLoadedTracks.length,
        limit: PAGE_SIZE,
      });

      if (tracks.length === 0) {
        // Plus rien à charger
        loadMoreBtn.hidden = true;
      } else {
        // On filtre les doublons éventuels (par id Deezer)
        const existingIds = new Set(allLoadedTracks.map(t => t.id));
        const newTracks = tracks.filter(t => !existingIds.has(t.id));
        allLoadedTracks = allLoadedTracks.concat(newTracks);
        renderResults(allLoadedTracks);

        // Cache le bouton si on n'a clairement plus rien
        if (tracks.length < PAGE_SIZE) loadMoreBtn.hidden = true;
      }
    } catch (err) {
      console.error('Charger plus échoué :', err);
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Charger plus';
    }
  }


  // ======= RENDU DE LA LISTE =======
  function renderResults(tracks) {
    setState('results');
    // Filtre : on n'affiche QUE les morceaux qui ont un extrait audio jouable.
    // (Deezer renvoie parfois des morceaux sans preview à cause des droits.)
    const playableTracks = tracks.filter(t => t.preview && t.preview.length > 0);

    resultsList.innerHTML = playableTracks.map((track, i) => `
      <li class="result" data-index="${i}">
        <div class="result__cover">
          <img src="${escapeHtml(track.album.cover_medium || '')}"
               alt="" loading="lazy" onerror="this.style.display='none'" />
          <button type="button" class="play-btn" aria-label="Écouter un extrait" data-action="play">
            <svg class="play-btn__icon play-btn__icon--play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
            <svg class="play-btn__icon play-btn__icon--pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
          </button>
        </div>
        <div class="result__info">
          <p class="result__title">${escapeHtml(track.title)}</p>
          <p class="result__artist">${escapeHtml(track.artist.name)}</p>
        </div>
        <button type="button" class="result__pick" aria-label="Choisir cette musique" data-action="pick">
          Choisir
        </button>
      </li>
    `).join('');
    resultsList.querySelectorAll('.result').forEach((el, i) => { el._track = playableTracks[i]; });
  }


  // ======= LECTURE AUDIO =======
  function togglePlay(resultEl, track) {
    if (!track.preview) return;
    if (currentlyPlaying === resultEl) {
      audioPlayer.pause();
      resultEl.classList.remove('is-playing');
      currentlyPlaying = null;
      return;
    }
    if (currentlyPlaying) currentlyPlaying.classList.remove('is-playing');
    audioPlayer.src = track.preview;
    audioPlayer.play().catch(err => console.error('Lecture impossible :', err));
    resultEl.classList.add('is-playing');
    currentlyPlaying = resultEl;
  }

  audioPlayer.addEventListener('ended', () => {
    if (currentlyPlaying) currentlyPlaying.classList.remove('is-playing');
    currentlyPlaying = null;
    confirmPlay.classList.remove('is-playing');
    if (confirmCover && confirmCover.parentElement) {
      confirmCover.parentElement.classList.remove('is-playing');
    }
  });


  // ======= CHOIX D'UN MORCEAU → CONFIRMATION =======
  function pickTrack(track) {
    selectedTrack = track;
    if (currentlyPlaying) {
      audioPlayer.pause();
      currentlyPlaying.classList.remove('is-playing');
      currentlyPlaying = null;
    }
    confirmCover.src = track.album.cover_big || track.album.cover_medium || '';
    confirmCover.alt = track.title;
    confirmTitle.textContent = track.title;
    confirmArtist.textContent = track.artist.name;

    const isLastTheme = (themeIndex === session.themes.length - 1);
    btnNextTheme.textContent = isLastTheme ? 'J\'ai tout choisi !' : 'Passer au tour suivant';

    stepSearch.hidden = true;
    stepConfirm.hidden = false;
    actionsSearch.hidden = true;
    actionsConfirm.hidden = false;
  }

  confirmPlay.addEventListener('click', () => {
    if (!selectedTrack || !selectedTrack.preview) return;
    if (confirmPlay.classList.contains('is-playing')) {
      audioPlayer.pause();
      confirmPlay.classList.remove('is-playing');
      confirmCover.parentElement.classList.remove('is-playing');
    } else {
      audioPlayer.src = selectedTrack.preview;
      audioPlayer.play().catch(err => console.error(err));
      confirmPlay.classList.add('is-playing');
      confirmCover.parentElement.classList.add('is-playing');
    }
  });

  btnBackToSearch.addEventListener('click', () => {
    audioPlayer.pause();
    confirmPlay.classList.remove('is-playing');
    if (confirmCover && confirmCover.parentElement) {
      confirmCover.parentElement.classList.remove('is-playing');
    }
    stepConfirm.hidden = true;
    stepSearch.hidden = false;
    actionsConfirm.hidden = true;
    actionsSearch.hidden = false;
  });


  // ======= VALIDATION DU CHOIX → ENREGISTREMENT EN BASE =======
  btnNextTheme.addEventListener('click', async () => {
    if (!selectedTrack) return;
    btnNextTheme.disabled = true;
    const original = btnNextTheme.textContent;
    btnNextTheme.textContent = 'Enregistrement…';

    try {
      await Wooo.api.savePick(
        session.partie_id,
        session.joueur_id,
        themeIndex,
        selectedTrack
      );

      audioPlayer.pause();
      audioPlayer.src = '';

      const nextIndex = themeIndex + 1;
      if (nextIndex < session.themes.length) {
        window.location.href = `search.html?theme=${nextIndex}`;
      } else {
        window.location.href = 'lobby.html';
      }
    } catch (err) {
      console.error(err);
      btnNextTheme.disabled = false;
      btnNextTheme.textContent = original;
      alert('Oups : ' + err.message);
    }
  });


  // ======= CLIC SUR LA LISTE =======
  resultsList.addEventListener('click', (e) => {
    const resultEl = e.target.closest('.result');
    if (!resultEl) return;
    const action = e.target.closest('[data-action]')?.dataset.action;
    const track = resultEl._track;
    if (!track) return;
    if (action === 'pick') pickTrack(track);
    else                    togglePlay(resultEl, track);
  });

  // ======= CLIC SUR "CHARGER PLUS" =======
  loadMoreBtn.addEventListener('click', loadMore);


  // ======= GESTION DE LA SAISIE =======
  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (query === '') {
      setState('idle');
      return;
    }

    debounceTimer = setTimeout(() => {
      performNewSearch(query);
    }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = input.value.trim();
      if (query) {
        if (debounceTimer) clearTimeout(debounceTimer);
        performNewSearch(query);
      }
    }
  });


  // ======= INIT =======
  setState('idle');
  setTimeout(() => input.focus(), 100);
})();
