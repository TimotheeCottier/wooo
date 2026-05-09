/* =========================================================
   WOOO Ciné — Recherche de film/série
   ---------------------------------------------------------
   - Recherche live TMDB (debounce 300ms)
   - Affichage : poster rectangulaire + titre + réalisateur
   - "Choisir" → confirm-cine.html
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo search-cine.js] version 6 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack       = $('btn-back');
  const btnClose      = $('btn-close');
  const progressDots  = $('progress-dots');
  const themeTitleEl  = $('search-theme');
  const searchInput   = $('search-input');
  const btnSearch     = $('btn-search');
  const emptyState    = $('search-empty');
  const resultsList   = $('search-results');
  const btnLoadMore   = $('btn-load-more');
  const loadingEl     = $('search-loading');

  const DEBOUNCE_MS = 300;


  // ======= SESSION =======
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
  let currentPage = 1;
  let allLoaded = [];
  let abortController = null;
  let debounceTimer = null;
  let totalPages = 1;


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


  // ======= RECHERCHE LIVE =======
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      if (abortController) abortController.abort();
      currentQuery = '';
      allLoaded = [];
      resultsList.hidden = true;
      btnLoadMore.hidden = true;
      loadingEl.hidden = true;
      emptyState.hidden = false;
      emptyState.innerHTML = '<p class="search-empty__emoji">🍿</p><p class="search-empty__text">On sait, c\'est difficile<br>d\'en choisir un seul&nbsp;!</p>';
      return;
    }
    debounceTimer = setTimeout(() => performNewSearch(), DEBOUNCE_MS);
  });

  btnSearch.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    if (searchInput.value.trim().length >= 2) performNewSearch();
  });

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
    currentPage = 1;
    allLoaded = [];

    emptyState.hidden = true;
    resultsList.hidden = true;
    btnLoadMore.hidden = true;
    loadingEl.hidden = false;

    Wooo.api.searchTmdb(query, abortController.signal, { page: 1 })
      .then(data => {
        loadingEl.hidden = true;
        const items = Array.isArray(data) ? data : (data.results || []);
        if (items.length === 0) {
          emptyState.hidden = false;
          emptyState.innerHTML = '<p class="search-empty__emoji">😅</p><p class="search-empty__text">Aucun résultat pour cette recherche.<br>Essaie autre chose !</p>';
          return;
        }
        allLoaded = items;
        renderResults(allLoaded);
        // On peut continuer la pagination
        btnLoadMore.hidden = false;
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error(err);
        loadingEl.hidden = true;
        emptyState.hidden = false;
        emptyState.innerHTML = '<p class="search-empty__emoji">😱</p><p class="search-empty__text">Erreur de recherche, réessaie plus tard.</p>';
      });
  }


  btnLoadMore.addEventListener('click', () => {
    if (!currentQuery) return;
    currentPage++;
    btnLoadMore.disabled = true;
    btnLoadMore.textContent = 'Chargement…';

    Wooo.api.searchTmdb(currentQuery, null, { page: currentPage })
      .then(items => {
        if (!items || items.length === 0) {
          btnLoadMore.hidden = true;
        } else {
          allLoaded = allLoaded.concat(items);
          renderResults(allLoaded);
          if (items.length < 10) btnLoadMore.hidden = true;
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


  function renderResults(items) {
    if (items.length === 0) {
      resultsList.hidden = true;
      emptyState.hidden = false;
      return;
    }

    resultsList.innerHTML = items.map((item, i) => `
      <li class="song-bloc" data-index="${i}">
        <div class="song-bloc__cover">
          <img src="${escapeHtml(item.poster_small || item.poster || '')}" alt="" loading="lazy" onerror="this.style.display='none'" />
        </div>
        <div class="song-bloc__info">
          <p class="song-bloc__title">${escapeHtml(item.title)}${item.year ? ' (' + escapeHtml(item.year) + ')' : ''}</p>
          <p class="song-bloc__artist">${escapeHtml(item.director || (item.type === 'tv' ? 'Série' : 'Film'))}</p>
        </div>
        <button type="button" class="song-bloc__choose" data-action="choose">Choisir</button>
      </li>
    `).join('');

    resultsList.querySelectorAll('.song-bloc').forEach((el, i) => { el._item = items[i]; });
    resultsList.hidden = false;
  }


  resultsList.addEventListener('click', (e) => {
    const block = e.target.closest('.song-bloc');
    if (!block) return;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'choose' && block._item) {
      goToConfirm(block._item);
    }
  });


  function goToConfirm(item) {
    const payload = {
      theme_index: themeIndex,
      tmdb_id:     String(item.id),
      tmdb_type:   item.type,
      title:       item.title,
      year:        item.year,
      director:    item.director || '',
      poster:      item.poster || item.poster_small || '',
      overview:    item.overview || '',
    };
    sessionStorage.setItem('wooo:pending-pick-cine', JSON.stringify(payload));
    window.location.href = 'confirm-cine.html?theme=' + themeIndex;
  }


  btnBack.addEventListener('click', () => {
    const editReturn = sessionStorage.getItem('wooo:edit-return');
    if (editReturn === 'validate') {
      sessionStorage.removeItem('wooo:edit-return');
      window.location.href = 'validate-cine.html';
      return;
    }
    if (themeIndex > 0) {
      window.location.href = 'search-cine.html?theme=' + (themeIndex - 1);
    } else {
      window.location.href = session.is_creator ? 'index-cine.html' : 'lobby-invite.html';
    }
  });

  btnClose.addEventListener('click', () => {
    if (confirm('Tu veux vraiment arrêter ? Tes choix actuels seront sauvegardés.')) {
      window.location.href = 'index-cine.html';
    }
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  setTimeout(() => searchInput.focus(), 100);

})();
