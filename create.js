/* =========================================================
   WOOO — Création de partie unifiée
   ---------------------------------------------------------
   Page unique :
   - Pseudo
   - Avatar
   - Catégorie : musique / cinema / serie
   - Thèmes (apparait après sélection de catégorie)
   - Bouton "C'est parti" actif quand : pseudo + avatar + catégorie + 3+ thèmes
   ========================================================= */

(function () {
  'use strict';

  console.log('[Wooo create.js] version 7 chargée ✅');

  const $ = (id) => document.getElementById(id);

  const btnBack         = $('btn-back');
  const pseudoInput     = $('pseudo-input');
  const avatarPicker    = $('avatar-picker');
  const categoryPicker  = $('category-picker');
  const categoryTitle   = $('category-title');
  const themesBlock     = $('themes-block');
  const themesTitle     = $('themes-title');
  const themesIntro     = $('themes-intro');
  const themesList      = $('themes-list');
  const btnAddTheme     = $('btn-add-theme');
  const btnLaunch       = $('btn-launch');
  const themeCount      = $('theme-count');

  // Overlay custom
  const customOverlay   = $('custom-overlay');
  const customLabel     = $('custom-theme-label');
  const customInput     = $('custom-theme-input');
  const customHint      = $('custom-theme-hint');
  const btnAddCustom    = $('btn-add-custom');
  const btnBackCustom   = $('btn-back-custom');


  // ======= CATALOGUES DE THÈMES PAR CATÉGORIE =======
  const THEME_CATALOGS = {
    musique: [
      'Ta préférée all-time',
      'De l\'adolescence',
      'Pour s\'ambiancer',
      'Qui te fait saigner des oreilles',
      'Que tu n\'assumes pas',
      'Qui te fait pleurer',
      'Pour partir en vacances',
    ],
    cinema: [
      'Le meilleur all-time',
      'Tout le monde l\'adore sauf toi',
      'Tu ne l\'assumes pas',
      'Avec la meilleure BO',
      'Tu l\'as abandonné en cours',
      'Avec le meilleur twist',
      'Ça t\'a fait pleurer',
    ],
    serie: [
      'Ta préférée all-time',
      'Que tu binges en cachette',
      'Que tu n\'assumes pas',
      'Avec le meilleur générique',
      'Que tu as abandonnée en cours',
      'Avec le meilleur twist',
      'Qui t\'a fait pleurer',
    ],
  };

  // Labels d'intro selon catégorie
  const CATEGORY_LABELS = {
    musique: { item: 'une chanson', custom: 'Une musique…' },
    cinema:  { item: 'un film',     custom: 'Un film…' },
    serie:   { item: 'une série',   custom: 'Une série…' },
  };


  // ======= ÉTAT =======
  let selectedAvatar = 1;
  let selectedCategory = null;
  let themes = [];


  function pickRandomIndices(max, n) {
    const all = Array.from({ length: max }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, n);
  }


  // ======= AVATARS =======
  function renderAvatars() {
    const colors = (Wooo.config && Wooo.config.PLAYER_COLORS) || [];
    avatarPicker.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const num = i + 1;
      const bg = colors[i % colors.length];
      return `
        <li class="avatar-grid__item ${num === selectedAvatar ? 'is-selected' : ''}"
            data-avatar="${num}"
            style="background: ${bg}">
          <img src="assets/avatar${num}.png" alt="Avatar ${num}" />
        </li>
      `;
    }).join('');
  }

  avatarPicker.addEventListener('click', (e) => {
    const item = e.target.closest('.avatar-grid__item');
    if (!item) return;
    selectedAvatar = parseInt(item.dataset.avatar, 10);
    avatarPicker.querySelectorAll('.avatar-grid__item').forEach(el => {
      el.classList.toggle('is-selected', parseInt(el.dataset.avatar, 10) === selectedAvatar);
    });
  });


  // ======= CATÉGORIE =======
  categoryPicker.addEventListener('click', (e) => {
    const card = e.target.closest('.category-card');
    if (!card) return;
    const cat = card.dataset.category;
    if (selectedCategory === cat) return; // déjà sélectionné

    selectedCategory = cat;

    // Marquer la carte sélectionnée + griser les autres
    categoryPicker.querySelectorAll('.category-card').forEach(el => {
      el.classList.toggle('is-selected', el.dataset.category === cat);
    });

    // Charger les thèmes de cette catégorie
    initThemesForCategory(cat);

    // Afficher le bloc thèmes
    themesBlock.hidden = false;

    // Adapter labels custom
    const labels = CATEGORY_LABELS[cat];
    if (themesIntro && labels) {
      themesIntro.textContent = `Tu devras choisir ${labels.item} pour chacun de ces thèmes.`;
    }
    if (customLabel && labels) {
      customLabel.textContent = labels.custom;
    }

    updateLaunchButton();
  });


  function initThemesForCategory(cat) {
    const catalog = THEME_CATALOGS[cat] || [];
    const indices = pickRandomIndices(catalog.length, 3);
    themes = catalog.map((name, i) => ({
      name,
      custom: false,
      checked: indices.includes(i),
    }));
    renderThemes();
  }


  // ======= THÈMES =======
  function renderThemes() {
    themesList.innerHTML = themes.map((t, idx) => `
      <li>
        <button type="button" class="themed-check ${t.checked ? 'is-checked' : ''}" data-idx="${idx}">
          <span class="themed-check__label">${escapeHtml(t.name)}</span>
          <span class="themed-check__box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
        </button>
      </li>
    `).join('');
    updateLaunchButton();
  }

  themesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.themed-check');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const willCheck = !themes[idx].checked;
    if (willCheck) {
      const checkedCount = themes.filter(t => t.checked).length;
      if (checkedCount >= 6) {
        btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 200 }
        );
        return;
      }
    }
    themes[idx].checked = willCheck;
    btn.classList.toggle('is-checked', willCheck);
    updateLaunchButton();
  });


  function updateLaunchButton() {
    const checked = themes.filter(t => t.checked).length;
    const pseudoOk = pseudoInput.value.trim().length >= 2;
    const categoryOk = !!selectedCategory;
    themeCount.textContent = checked;
    btnLaunch.disabled = !(pseudoOk && categoryOk && checked >= 3 && checked <= 6);
  }


  // ======= PSEUDO LIVE =======
  pseudoInput.addEventListener('input', () => {
    updateLaunchButton();
  });


  // ======= OVERLAY CUSTOM =======
  btnAddTheme.addEventListener('click', () => {
    customInput.value = '';
    customHint.textContent = '0 / 40';
    btnAddCustom.disabled = true;
    customOverlay.hidden = false;
    setTimeout(() => customInput.focus(), 100);
  });

  customInput.addEventListener('input', () => {
    const val = customInput.value.trim();
    customHint.textContent = `${val.length} / 40`;
    btnAddCustom.disabled = (val.length < 2 || val.length > 40);
  });

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnAddCustom.disabled) {
      e.preventDefault();
      addCustomTheme();
    }
  });

  btnAddCustom.addEventListener('click', addCustomTheme);

  function addCustomTheme() {
    const val = customInput.value.trim();
    if (val.length < 2 || val.length > 40) return;
    const checkedCount = themes.filter(t => t.checked).length;
    themes.unshift({ name: val, custom: true, checked: checkedCount < 6 });
    renderThemes();
    closeCustomOverlay();
  }

  function closeCustomOverlay() {
    customOverlay.hidden = true;
  }

  btnBackCustom.addEventListener('click', closeCustomOverlay);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !customOverlay.hidden) closeCustomOverlay();
  });


  // ======= LANCEMENT =======
  btnLaunch.addEventListener('click', async () => {
    const pseudo = pseudoInput.value.trim();
    const chosen = themes.filter(t => t.checked).map(t => t.name);

    if (pseudo.length < 2 || chosen.length < 3 || chosen.length > 6 || !selectedCategory) return;

    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Création…';

    try {
      const partie = await Wooo.api.createPartie(chosen, selectedCategory);
      const joueur = await Wooo.api.addJoueur(partie.id, pseudo, true, selectedAvatar);
      Wooo.session.save({
        partie_id:  partie.id,
        pin_code:   partie.pin_code,
        themes:     partie.themes,
        is_creator: true,
        joueur_id:  joueur.id,
        pseudo:     pseudo,
        avatar:     selectedAvatar,
        produit:    selectedCategory,
      });

      // Redirige vers la bonne page de recherche selon catégorie
      const searchUrl = (selectedCategory === 'musique') ? 'search.html' : 'search-cine.html';
      window.location.href = searchUrl + '?theme=0';
    } catch (err) {
      console.error(err);
      btnLaunch.disabled = false;
      btnLaunch.innerHTML = `C'est parti avec <span id="theme-count">${chosen.length}</span> thèmes !`;
      alert('Oups : ' + err.message);
    }
  });


  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }


  // ======= INIT =======
  renderAvatars();

})();
